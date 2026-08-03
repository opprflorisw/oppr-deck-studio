#!/usr/bin/env python
"""
Mirror the tool's static assets into Storage (Deck Studio cloud).

The app serves brand images, fonts, slide thumbnails and design-system specimens
under `/repo/...`. Locally those come off disk. Hosted there is no repo on disk,
so they are read from Storage at the SAME relative path — which is why the
browser needs no change and one URL works in both places.

Only what the front-end actually asks for is mirrored. The deck sources, recipes
and knowledge docs stay out: they are the CLI's business and there is no reason
to put them on a server.

    python tools/publish-assets.py            # upload what changed
    python tools/publish-assets.py --force    # upload everything again
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from supa import Supa, content_type_for

REPO_ROOT = Path(__file__).resolve().parent.parent

# (directory, allowed suffixes). Everything else in these trees is skipped.
TREES = [
    ("brand/img", {".png", ".jpg", ".jpeg", ".webp", ".svg", ".json"}),
    ("brand/fonts", {".woff2", ".woff", ".ttf"}),
    ("brand", {".svg"}),                       # wordmark + icon, top level only
    # The shareable brand kit. The Library's Brand tab reads kit.json and then
    # links every file in it, so the whole tree has to be here or the tab is
    # empty everywhere except this laptop — including the .zip, which is the
    # point of the kit.
    ("brand/kit", {".svg", ".png", ".woff2", ".json", ".html", ".txt", ".zip"}),
    ("library/slides", {".png"}),              # thumbnails
    ("library/design-system", {".html", ".css"}),
    ("library/icons", {".svg", ".json"}),
    ("templates", {".css"}),
]

STATE = REPO_ROOT / ".scratch" / ".asset-hashes.json"

# The Knowledge/Config docs. Hosted there is no repo on disk, so without these
# every doc in the app reads "not whitelisted" and the area is empty.
#
# This mirrors knowledgeFiles() in app/server.mjs, which is the rule locally.
# Keep the two in step: a file missing here is a doc that exists on the laptop
# and nowhere else. The manifest is what the hosted server trusts as the
# whitelist, so it can never widen access beyond what is listed.
KNOWLEDGE_MANIFEST = "knowledge/_manifest.json"
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".tmp-verify", ".tmp-catalog"}
FIXED_DOCS = [
    "brand/BRAND.md", ".env.example", "CLAUDE.md",
    ".scratch/deck-tool/SPEC.md", ".scratch/deck-app/APP-SPEC.md",
    ".scratch/deck-app/V2-SPEC.md",
]


def knowledge_files() -> list[str]:
    out: set[str] = set()
    for rel in FIXED_DOCS:
        if (REPO_ROOT / rel).exists():
            out.add(rel)

    def walk(rel_dir: str, depth: int) -> None:
        if depth > 6:
            return
        try:
            entries = sorted((REPO_ROOT / rel_dir).iterdir()) if rel_dir else sorted(REPO_ROOT.iterdir())
        except OSError:
            return
        for p in entries:
            if p.name in SKIP_DIRS:
                continue
            rel = f"{rel_dir}/{p.name}" if rel_dir else p.name
            if p.is_dir():
                walk(rel, depth + 1)
            elif (
                p.name == "CLAUDE.md"
                or (rel.startswith("knowledge/") and p.name.endswith(".md"))
                or (rel.startswith("types/") and p.name == "recipe.md")
                or (rel.startswith(".claude/commands/") and p.name.endswith(".md"))
            ):
                out.add(rel)

    walk("", 0)
    return sorted(out)


def files_to_publish() -> list[Path]:
    out: list[Path] = []
    for rel, suffixes in TREES:
        root = REPO_ROOT / rel
        if not root.exists():
            continue
        top_only = rel == "brand"
        it = root.glob("*") if top_only else root.rglob("*")
        for p in it:
            if p.is_file() and p.suffix.lower() in suffixes:
                out.append(p)
    out += [REPO_ROOT / rel for rel in knowledge_files()]
    # dedupe (brand/img is inside brand)
    seen, uniq = set(), []
    for p in sorted(out):
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    return uniq


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    import json
    prev = {}
    if STATE.exists() and not args.force:
        try: prev = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception: prev = {}

    sb = Supa()
    files = files_to_publish()
    uploaded = skipped = 0
    now = {}

    for p in files:
        rel = p.relative_to(REPO_ROOT).as_posix()
        data = p.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        now[rel] = sha
        if prev.get(rel) == sha:
            skipped += 1
            continue
        sb.upload(rel, data, content_type_for(p.name))
        uploaded += 1
        print(f"  {rel}  ({len(data):,} bytes)")

    # The whitelist the hosted server reads. Written last and always, so it can
    # never name a doc that failed to upload above.
    docs = knowledge_files()
    manifest = json.dumps({"files": docs}, indent=1).encode("utf-8")
    sb.upload(KNOWLEDGE_MANIFEST, manifest, "application/json")
    print(f"  {KNOWLEDGE_MANIFEST}  ({len(docs)} docs)")

    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(now, indent=1, sort_keys=True), encoding="utf-8")

    total = sum(p.stat().st_size for p in files)
    print()
    print(f"{len(files)} assets, {total / 1e6:.1f} MB total — uploaded {uploaded}, unchanged {skipped}")
    print("Verify one landed:")
    if files:
        rel = files[0].relative_to(REPO_ROOT).as_posix()
        try:
            n = len(sb.download(rel))
            print(f"  {rel}: {n:,} bytes read back from Storage")
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED to read {rel} back: {e}")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
