#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Import social output into the one artifact model (Deck Studio 2.0).

Before: a carousel lived in `social_outputs` as a registry of file paths, with
no versions, no editor, no verify report and a PDF that could never be
regenerated. A deck lived in `decks` + `deck_versions` with all four.

This tool moves each social output into `decks` as a versioned artifact
(kind = carousel | image | article), snapshotting its built HTML so it is
self-contained, bundling its assets, and carrying its existing PDF over as
version 1's PDF. After this, one editor, one verify gate, one build job and one
version history serve every artifact type.

Re-runnable: a slug already present in `decks` is skipped, not duplicated.

    python tools/import-social.py            # migrate everything importable
    python tools/import-social.py --dry-run  # report what would happen
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from snapshot_html import snapshot_document, inject_meta
from supa import Supa, content_type_for

REPO_ROOT = Path(__file__).resolve().parent.parent

# kind -> the page geometry + verify rule set that applies
PAGE_FORMAT = {
    "carousel": "linkedin-4x5",
    "image": "square-1x1",
    "article": "hero-1200x627",
    "post": "none",
}


def title_from_slug(slug: str) -> str:
    core = slug.split("_", 1)[1] if "_" in slug[:11] else slug
    return core.replace("-", " ").strip().capitalize()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sb = Supa()
    rows = sb.select("social_outputs", {"select": "*", "order": "slug.asc"})
    existing = {d["slug"] for d in sb.select("decks", {"select": "slug"})}

    imported, skipped, failed = 0, [], []

    for r in rows:
        slug, kind = r["slug"], r.get("kind") or "post"
        if slug in existing:
            skipped.append((slug, "already an artifact"))
            continue
        if not r.get("idx_path"):
            # An image or a plain post has no HTML document to version. It stays
            # a social_outputs row until its builder emits HTML. Stated, not
            # silently dropped.
            skipped.append((slug, f"no HTML document (kind={kind})"))
            continue

        base_dir = REPO_ROOT / Path(r["path"] if r.get("path") else Path(r["idx_path"]).parent)
        page_format = PAGE_FORMAT.get(kind, "none")
        try:
            html = sb.download(r["idx_path"]).decode("utf-8")
            html, assets = snapshot_document(html, base_dir)
            # verify cannot check an artifact without this manifest, and it is
            # where page_format is declared so the carousel rules get applied.
            html = inject_meta(
                html, title=title_from_slug(slug), kind=kind, page_format=page_format,
                allowed=["public"], assets=assets,
            )
        except Exception as e:  # noqa: BLE001 - report and continue
            failed.append((slug, str(e)[:120]))
            continue

        pages = html.count("<section")
        print(f"  {slug:<50} {kind:<9} {pages:>2} pages  {len(assets):>2} assets  {len(html):>7} bytes")
        if args.dry_run:
            imported += 1
            continue

        # The post copy travels with the artifact. It used to stay behind as a
        # post.txt path in social_outputs, which is how the post editor lost its
        # text when social moved into the artifact model.
        post_text = ""
        for key in ("post_path", "article_path"):
            if r.get(key):
                try:
                    post_text = sb.download(r[key]).decode("utf-8")
                    break
                except Exception:  # noqa: BLE001 - a missing object is not fatal
                    pass

        deck = sb.insert("decks", {
            "slug": slug,
            "title": title_from_slug(slug),
            "type": kind,
            "kind": kind,
            "channel": r.get("channel") or "linkedin",
            "category": r.get("category") or kind,
            "page_format": page_format,
            "is_master": False,
            "audience_kind": "general",
            # Social is public by definition (social/CLAUDE.md), so clearance is
            # always ['public'] — what the artifact is ALLOWED to carry, never
            # what it happens to contain. Setting it to the contents would paper
            # over a leak; this way verify FAILs and the leak surfaces.
            "allowed_entitlements": ["public"],
            "current_version_n": 1,
            "created_by": "import-social",
            "post_text": post_text,
        })[0]
        did = deck["id"]

        for name, meta in assets.items():
            obj = f"decks/{did}/assets/{name}"
            sb.upload(obj, meta["bytes"], meta["content_type"])
            sb.upsert("deck_assets", [{
                "deck_id": did, "filename": name, "storage_object": obj,
                "entitlement": meta["entitlement"], "sha256": meta["sha256"],
            }], "deck_id,filename")

        pdf_object = None
        if r.get("pdf_path"):
            try:
                data = sb.download(r["pdf_path"])
                if data:
                    pdf_object = f"decks/{did}/pdf/v1_{Path(r['pdf_path']).name}"
                    sb.upload(pdf_object, data, "application/pdf")
            except Exception:
                pdf_object = None

        sb.insert("deck_versions", {
            "deck_id": did, "n": 1, "html": html,
            "change_note": f"imported from social_outputs ({r['channel']}/{slug})",
            "author": "import-social", "pdf_object": pdf_object,
        })
        imported += 1

    print()
    print(f"imported: {imported}")
    for slug, why in skipped:
        print(f"  skipped  {slug:<50} {why}")
    for slug, why in failed:
        print(f"  FAILED   {slug:<50} {why}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
