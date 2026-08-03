"""
Supabase REST + Storage client for the Deck Studio backend (v3).

Decks live as immutable HTML versions in Supabase (see
.scratch/deck-app/hybrid-editor/report_and_implementation.md). This module is
the thin server-side client the CLI deck tools share. It uses the SECRET key and
therefore bypasses RLS: it is server-side only and must never run in a browser.

Env (from .env at the repo root):
  SUPABASE_URL         https://<project>.supabase.co
  SUPABASE_SECRET_KEY  sb_secret_... (or a legacy service_role JWT)

PostgREST tables live under {URL}/rest/v1/<table>; Storage objects under
{URL}/storage/v1/object/<bucket>/<path>.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parents[1]
BUCKET = "deck-files"


def load_env() -> dict:
    """Parse the repo .env (tiny: split on first '=', skip blank/# lines).
    Real values live only here; nothing committed carries a key."""
    env = {}
    p = REPO_ROOT / ".env"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    # Real environment overrides the file.
    for k in ("SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY"):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


_HAS_OP = re.compile(
    r"^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|fts|plfts|phfts|wfts|not)\."
)


class Supa:
    def __init__(self):
        env = load_env()
        self.url = (env.get("SUPABASE_URL") or "").rstrip("/")
        self.key = env.get("SUPABASE_SECRET_KEY") or ""
        if not self.url or not self.key:
            raise SystemExit(
                "ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env "
                "(see .env.example). The deck backend is unavailable without them."
            )
        self.rest = f"{self.url}/rest/v1"
        self.storage = f"{self.url}/storage/v1"
        self._h = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    # --- PostgREST ----------------------------------------------------------
    def select(self, table: str, params: dict | None = None) -> list:
        r = requests.get(f"{self.rest}/{table}", headers=self._h, params=params or {}, timeout=30)
        r.raise_for_status()
        return r.json()

    def insert(self, table: str, rows) -> list:
        h = {**self._h, "Prefer": "return=representation"}
        r = requests.post(f"{self.rest}/{table}", headers=h, json=rows, timeout=30)
        if not r.ok:
            raise SystemExit(f"ERROR inserting into {table}: {r.status_code} {r.text[:400]}")
        return r.json()

    def update(self, table: str, match: dict, values: dict) -> list:
        h = {**self._h, "Prefer": "return=representation"}
        # A match value may already carry a PostgREST operator ("neq.deck",
        # "in.(a,b)"). Prefixing eq. onto those produced "eq.neq.deck", which
        # matches nothing and updates zero rows WITHOUT erroring — a silent
        # no-op that reads exactly like success. Pass operators through.
        params = {k: (v if _HAS_OP.match(str(v)) else f"eq.{v}") for k, v in match.items()}
        r = requests.patch(f"{self.rest}/{table}", headers=h, params=params, json=values, timeout=30)
        if not r.ok:
            raise SystemExit(f"ERROR updating {table}: {r.status_code} {r.text[:400]}")
        return r.json()

    def upsert(self, table: str, rows, on_conflict: str) -> list:
        h = {**self._h, "Prefer": "return=representation,resolution=merge-duplicates"}
        r = requests.post(f"{self.rest}/{table}", headers=h, params={"on_conflict": on_conflict}, json=rows, timeout=30)
        if not r.ok:
            raise SystemExit(f"ERROR upserting {table}: {r.status_code} {r.text[:400]}")
        return r.json()

    # --- Storage ------------------------------------------------------------
    def upload(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload bytes to deck-files/<path>, overwriting. Returns the object path."""
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}",
             "Content-Type": content_type, "x-upsert": "true"}
        r = requests.post(f"{self.storage}/object/{BUCKET}/{path}", headers=h, data=data, timeout=120)
        if not r.ok:
            raise SystemExit(f"ERROR uploading {path}: {r.status_code} {r.text[:400]}")
        return path

    def download(self, path: str) -> bytes:
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}"}
        r = requests.get(f"{self.storage}/object/{BUCKET}/{path}", headers=h, timeout=120)
        r.raise_for_status()
        return r.content

    def copy(self, src: str, dst: str) -> None:
        """Server-side copy inside the bucket (used when a personalized deck
        inherits its master's assets without a round trip through the client)."""
        h = {**self._h}
        r = requests.post(f"{self.storage}/object/copy", headers=h,
                          json={"bucketId": BUCKET, "sourceKey": src, "destinationKey": dst}, timeout=60)
        if not r.ok:
            # copy is best-effort; a re-upload path exists in the caller
            raise SystemExit(f"ERROR copying {src} -> {dst}: {r.status_code} {r.text[:300]}")


CONTENT_TYPES = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
    ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
    ".pdf": "application/pdf", ".html": "text/html; charset=utf-8",
    # A stylesheet served as octet-stream is refused outright by browsers, and a
    # .zip served as one is what makes a downloaded brand kit arrive unopenable.
    ".css": "text/css; charset=utf-8", ".json": "application/json",
    ".txt": "text/plain; charset=utf-8", ".zip": "application/zip",
}


def content_type_for(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return CONTENT_TYPES.get(ext, "application/octet-stream")
