#!/usr/bin/env python
"""
Fetch a published deck version from the backend into a local folder so CLI
workflows can read an edited deck as content source (Deck Studio v3, §4.3,
reproduction: "based on <deck>, build X for Y").

    python tools/fetch-deck.py <deck-slug> [--version N] [--out DIR]

Writes index.html + assets/ into DIR (default .scratch/fetched/<slug>-v<N>/).
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds
from supa import Supa


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--version", type=int)
    ap.add_argument("--out")
    args = ap.parse_args()

    sb = Supa()
    decks = sb.select("decks", {"slug": f"eq.{args.slug}", "select": "id,current_version_n,title"})
    if not decks:
        raise SystemExit(f"ERROR: no deck with slug '{args.slug}'")
    deck_id = decks[0]["id"]
    n = args.version or decks[0]["current_version_n"]

    versions = sb.select("deck_versions", {"deck_id": f"eq.{deck_id}", "n": f"eq.{n}", "select": "html"})
    if not versions:
        raise SystemExit(f"ERROR: no version {n} of '{args.slug}'")
    html = versions[0]["html"]

    out = Path(args.out) if args.out else ds.REPO_ROOT / ".scratch" / "fetched" / f"{args.slug}-v{n}"
    (out / "assets").mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html, encoding="utf-8")

    # download every asset the html references
    refs = set(re.findall(r'assets/([^"\')]+)', html))
    assets = sb.select("deck_assets", {"deck_id": f"eq.{deck_id}", "select": "filename,storage_object"})
    by_name = {a["filename"]: a["storage_object"] for a in assets}
    got = 0
    for fn in refs:
        obj = by_name.get(fn)
        if obj:
            (out / "assets" / fn).write_bytes(sb.download(obj))
            got += 1
    print(f"fetched '{args.slug}' v{n} -> {out} ({got} assets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
