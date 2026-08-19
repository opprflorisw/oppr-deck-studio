#!/usr/bin/env python3
"""Publish a built article (and its hero image) into the one artifact model.

An article folder built by `tools/build-article.py` holds:

    index.html        the article document      -> kind=article, page_format=none
    hero/index.html   the 1200x627 banner       -> kind=image,   page_format=hero-1200x627
    post.txt          the LinkedIn post copy    -> decks.post_text on the article

Both become rows in `decks` + `deck_versions`, which is what gives them the
editor, the version history, verify and print-on-demand PDF. This publishes
straight into that model rather than through `social_outputs`, which is the
legacy registry `import-social.py` exists to drain.

Re-runnable and version-correct: a slug already in `decks` gets a NEW immutable
version, never an overwrite and never a `-v2` slug.

    python tools/publish-article.py --article social/linkedin/<date>_<slug>
    python tools/publish-article.py --all
    python tools/publish-article.py --all --dry-run   # build + verify, no writes
"""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import verifylib
from snapshot_html import inject_meta, snapshot_document
from supa import Supa

REPO = Path(__file__).resolve().parent.parent

# What each document in an article folder becomes. The hero is a separate
# artifact rather than page one of the article because it has a different job
# and a different geometry: it is the image you attach to the post, and it has
# to be printable at exactly 1200x627 while the article is a column of prose.
PARTS = [
    {"file": "index.html",      "kind": "article", "page_format": "none",          "suffix": ""},
    {"file": "hero/index.html", "kind": "image",   "page_format": "hero-1200x627", "suffix": "-hero"},
]


def verified(html: str, assets: dict, customers: list) -> verifylib.Report:
    """Run the real gate on the snapshot, from a materialized copy. Same
    function the app and the CLI both call, so nothing ships here that
    verify-deck.py would reject."""
    tmp = Path(tempfile.mkdtemp(prefix="oppr-article-"))
    try:
        (tmp / "index.html").write_text(html, encoding="utf-8")
        if assets:
            (tmp / "assets").mkdir()
            for name, meta in assets.items():
                (tmp / "assets" / name).write_bytes(meta["bytes"])
        return verifylib.verify_snapshot(tmp, customers=customers)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def publish_part(sb: Supa, adir: Path, part: dict, title: str, slug: str,
                 post_text: str, customers: list, dry: bool) -> bool:
    doc = adir / part["file"]
    if not doc.is_file():
        print(f"  skip     {slug + part['suffix']:<52} no {part['file']}")
        return True

    # Relative refs in hero/index.html resolve against hero/, not the folder.
    html, assets = snapshot_document(doc.read_text(encoding="utf-8"), doc.parent)
    html = inject_meta(html, title=title, kind=part["kind"],
                       page_format=part["page_format"], allowed=["public"], assets=assets)

    r = verified(html, assets, customers)
    full_slug = slug + part["suffix"]
    if r.fails:
        print(f"  FAIL     {full_slug}")
        for m in r.fails:
            print(f"           {m}")
        return False
    for m in r.warns:
        if "no PDF" in m:      # expected: the app prints the version on demand
            continue
        print(f"  warn     {full_slug}: {m}")

    print(f"  ok       {full_slug:<52} {part['kind']:<8} {len(assets):>2} assets  {len(html):>7} bytes")
    if dry:
        return True

    existing = sb.select("decks", {"slug": f"eq.{full_slug}", "select": "id,current_version_n"})
    if existing:
        did = existing[0]["id"]
        n = int(existing[0]["current_version_n"] or 0) + 1
        sb.update("decks", {"id": f"eq.{did}"},
                  {"current_version_n": n, "title": title, "post_text": post_text})
    else:
        did = sb.insert("decks", {
            "slug": full_slug,
            "title": title,
            "type": part["kind"],
            "kind": part["kind"],
            "channel": "linkedin",
            "category": part["kind"],
            "page_format": part["page_format"],
            "is_master": False,
            "audience_kind": "general",
            # Social is public by definition (social/CLAUDE.md). This is what the
            # artifact is ALLOWED to carry, never what it happens to contain.
            "allowed_entitlements": ["public"],
            "current_version_n": 1,
            "created_by": "publish-article",
            "post_text": post_text,
        })[0]["id"]
        n = 1

    for name, meta in assets.items():
        obj = f"decks/{did}/assets/{name}"
        sb.upload(obj, meta["bytes"], meta["content_type"])
        sb.upsert("deck_assets", [{
            "deck_id": did, "filename": name, "storage_object": obj,
            "entitlement": meta["entitlement"], "sha256": meta["sha256"],
        }], "deck_id,filename")

    sb.insert("deck_versions", {
        "deck_id": did, "n": n, "html": html,
        "change_note": f"published by publish-article from social/{adir.name}",
        "author": "publish-article", "pdf_object": None,
    })
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--article", help="folder holding the built article")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.all:
        dirs = sorted(p.parent for p in (REPO / "social").rglob("article.yaml"))
    elif args.article:
        dirs = [(REPO / args.article).resolve()]
    else:
        ap.error("need --article or --all")

    sb = Supa()
    # The name-leak gate watches registered customers too, so it has to be fed
    # the same list the app feeds it (root CLAUDE.md, "customers table drives
    # clearance"). Social is public, so a customer name here is a real leak.
    try:
        customers = sb.select("customers", {"select": "slug,name"})
    except Exception as e:  # noqa: BLE001
        print(f"WARN could not read customers ({e}); checking built-in scopes only")
        customers = []

    ok = True
    for d in dirs:
        import yaml
        data = yaml.safe_load((d / "article.yaml").read_text(encoding="utf-8")) or {}
        title = data.get("title", d.name)
        post_text = (d / "post.txt").read_text(encoding="utf-8") if (d / "post.txt").is_file() else ""
        print(d.relative_to(REPO).as_posix())
        for part in PARTS:
            ok &= publish_part(sb, d, part, title, d.name, post_text, customers, args.dry_run)

    print("\ndry run, nothing written" if args.dry_run else "\npublished")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
