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
    ("library/slides", {".png"}),              # thumbnails
    ("library/design-system", {".html", ".css"}),
    ("library/icons", {".svg", ".json"}),
    ("templates", {".css"}),
]

STATE = REPO_ROOT / ".scratch" / ".asset-hashes.json"


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
