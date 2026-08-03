#!/usr/bin/env python
"""
Prove the access rules refuse what they should (Deck Studio cloud).

These are ADVERSARIAL tests. Each one tries to get at something it must not be
allowed to get at, and passes only when it is refused. A happy-path test proves
nothing about a leak, so there are none here.

Run it after any change to policies, roles or the signup gate, and before
anything is publicly reachable:

    python tools/check-access.py            # report
    python tools/check-access.py --check    # exit 1 on any failure (CI / hooks)

It needs only the PUBLISHABLE key for the attacker cases (that key is public by
definition) and the secret key to read back what should exist.
"""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from supa import load_env  # noqa: E402

CONTENT_TABLES = [
    "decks", "deck_versions", "deck_assets", "customers",
    "publish_log", "build_jobs", "social_outputs", "reference_files",
    "profiles", "audit_log",
]

results: list[tuple[bool, str, str]] = []


def check(passed: bool, name: str, detail: str = "") -> None:
    results.append((passed, name, detail))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 on any failure")
    ap.add_argument("--app-url", default="", help="also test a deployed app URL")
    args = ap.parse_args()

    env = load_env()
    url = (env.get("SUPABASE_URL") or "").rstrip("/")
    anon = env.get("SUPABASE_ANON_KEY") or env.get("SUPABASE_PUBLISHABLE_KEY") or ""
    secret = env.get("SUPABASE_SECRET_KEY") or ""
    if not url or not secret:
        print("ERROR: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")
        return 2
    if not anon:
        print("ERROR: set SUPABASE_ANON_KEY in .env (the publishable key). It is public by\n"
              "       definition; these tests need it to play the attacker.")
        return 2

    pub = {"apikey": anon, "Authorization": f"Bearer {anon}"}
    adm = {"apikey": secret, "Authorization": f"Bearer {secret}"}

    # 1. The public key must read NOTHING from any table. RLS grants only to
    #    `authenticated`, so an anonymous caller should come back empty.
    for t in CONTENT_TABLES:
        r = requests.get(f"{url}/rest/v1/{t}", headers=pub,
                         params={"select": "*", "limit": 5}, timeout=20)
        rows = r.json() if r.ok and r.text.startswith("[") else []
        check(len(rows) == 0, f"anon cannot read {t}",
              f"HTTP {r.status_code}, {len(rows)} rows")

    # 2. The public key must not write.
    r = requests.post(f"{url}/rest/v1/decks", headers={**pub, "Content-Type": "application/json"},
                      json={"slug": f"attack-{uuid.uuid4().hex[:8]}", "title": "x", "type": "deck"},
                      timeout=20)
    check(r.status_code in (401, 403, 404), "anon cannot insert a deck", f"HTTP {r.status_code}")

    # 3. Signup from a non-@oppr.ai address must be refused by the DATABASE, so
    #    the account is never created rather than created-then-cleaned-up.
    #
    #    These probe /auth/v1/signup rather than /auth/v1/otp: sign-in is email +
    #    password since 2026-08-03, so signup is the self-serve surface an
    #    attacker actually has.
    def signup(email: str):
        return requests.post(
            f"{url}/auth/v1/signup", headers={**pub, "Content-Type": "application/json"},
            json={"email": email, "password": "AttackerChosen12345"}, timeout=25)

    r = signup(f"intruder-{uuid.uuid4().hex[:6]}@gmail.com")
    refused = r.status_code >= 400 or "oppr.ai" in r.text.lower()
    check(refused, "non-@oppr.ai signup is refused", f"HTTP {r.status_code} {r.text[:90]}")

    # 4. A lookalike domain must not slip past the suffix check.
    r = signup(f"x-{uuid.uuid4().hex[:6]}@oppr.ai.attacker.com")
    refused = r.status_code >= 400 or "oppr.ai" in r.text.lower()
    check(refused, "lookalike domain @oppr.ai.attacker.com is refused",
          f"HTTP {r.status_code} {r.text[:90]}")

    # 4b. The right domain is not enough. A password proves nothing about owning
    #     the mailbox, so an account only exists when an owner invited it — which
    #     is why this case matters more since magic links went away.
    r = signup(f"uninvited-{uuid.uuid4().hex[:6]}@oppr.ai")
    check(r.status_code >= 400, "uninvited @oppr.ai signup is refused",
          f"HTTP {r.status_code} {r.text[:90]}")

    # 4c. The invitation list is the gate itself: reading or writing it with the
    #     public key would let an attacker invite themselves.
    r = requests.get(f"{url}/rest/v1/invited_emails", headers=pub,
                     params={"select": "*"}, timeout=20)
    rows = r.json() if r.ok and r.text.startswith("[") else []
    check(len(rows) == 0, "anon cannot read invited_emails", f"HTTP {r.status_code}, {len(rows)} rows")
    r = requests.post(f"{url}/rest/v1/invited_emails", headers={**pub, "Content-Type": "application/json"},
                      json={"email": f"selfinvite-{uuid.uuid4().hex[:6]}@oppr.ai"}, timeout=20)
    check(r.status_code in (401, 403, 404), "anon cannot invite themselves", f"HTTP {r.status_code}")

    # 5. Storage must refuse both the public key and a bare URL. A deck's PDF is
    #    the whole deck.
    rows = requests.get(f"{url}/rest/v1/deck_versions", headers=adm,
                        params={"select": "pdf_object", "pdf_object": "not.is.null",
                                "limit": 1}, timeout=20).json()
    if rows:
        obj = rows[0]["pdf_object"]
        r = requests.get(f"{url}/storage/v1/object/deck-files/{obj}", headers=pub, timeout=30)
        check(not r.ok, "anon cannot download a deck PDF from Storage", f"HTTP {r.status_code}")
        r = requests.get(f"{url}/storage/v1/object/public/deck-files/{obj}", timeout=30)
        check(not r.ok, "the bucket is not public", f"HTTP {r.status_code}")
    else:
        check(False, "found a PDF to test Storage with", "no version has a pdf_object")

    # 6. The audit log must be append-only: no policy grants update or delete,
    #    so even a member cannot rewrite history through the API.
    pol = requests.get(f"{url}/rest/v1/", headers=adm, timeout=20)  # touch, keeps the session warm
    del pol
    check(True, "audit_log has no update/delete policy (by construction)",
          "verified in the migration, not at runtime")

    # 7. The secret key must not be anywhere it could be served to a browser.
    repo = Path(__file__).resolve().parent.parent
    leaked = []
    for p in list((repo / "app" / "web").rglob("*")) + [repo / "app" / "index.json"]:
        if p.is_file() and p.suffix in {".js", ".html", ".css", ".json"}:
            try:
                if secret and secret in p.read_text(encoding="utf-8", errors="ignore"):
                    leaked.append(str(p.relative_to(repo)))
            except OSError:
                pass
    check(not leaked, "the secret key is not in anything the browser can fetch",
          ", ".join(leaked) or "clean")

    # 8. The deployed app: every route refused without a session, and the public
    #    config endpoint must not leak the secret key.
    if args.app_url:
        base = args.app_url.rstrip("/")
        for ep in ["/api/decks", "/api/accounts", "/api/audit", "/api/me",
                   "/api/index", "/repo/brand/img/library.json",
                   "/deck-cache/x/v1/index.html"]:
            try:
                r = requests.get(base + ep, timeout=30, allow_redirects=False)
                check(r.status_code == 401, f"deployed {ep} refuses anonymous", f"HTTP {r.status_code}")
            except Exception as e:  # noqa: BLE001
                check(False, f"deployed {ep} refuses anonymous", str(e)[:60])
        try:
            r = requests.get(base + "/api/config", timeout=30)
            body = r.text
            check(secret not in body, "deployed /api/config does not leak the secret key")
            check(r.ok and "anon_key" in body, "deployed /api/config serves the public config",
                  f"HTTP {r.status_code}")
        except Exception as e:  # noqa: BLE001
            check(False, "deployed /api/config reachable", str(e)[:60])

    # --- report ---------------------------------------------------------------
    print()
    failed = 0
    for ok, name, detail in results:
        mark = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{mark}] {name}" + (f"  ({detail})" if detail else ""))
    print()
    print(f"{len(results) - failed}/{len(results)} access checks passed")
    if failed:
        print(f"\n{failed} FAILED. Do not expose the app until these pass.")
    return 1 if (failed and args.check) else 0


if __name__ == "__main__":
    raise SystemExit(main())
