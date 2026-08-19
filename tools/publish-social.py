#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Publish social output into the backend so the repo stays tool-only.
(Deck Studio v3 cleanup). Uploads:

  social/<channel>/<slug>/*   -> deck-files/social/...   + social_outputs rows
  references/*                -> deck-files/references/.. + reference_files rows

Files are uploaded at their repo-relative path (e.g. deck-files/social/linkedin/
<slug>/index.html), so the agent's /repo fallback can serve them back by the
same path and the app is unchanged. Re-runnable: rows upsert; uploads overwrite.

    python tools/publish-social.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds
from supa import Supa, content_type_for

REPO = ds.REPO_ROOT


def relposix(p: Path) -> str:
    return str(p.resolve().relative_to(REPO)).replace("\\", "/")


def _upload(sb: Supa, f: Path) -> str:
    rel = relposix(f)
    sb.upload(rel, f.read_bytes(), content_type_for(f.name))  # object path == repo-relative path
    return rel


def migrate_social(sb: Supa) -> None:
    root = REPO / "social"
    if not root.exists():
        print("no social/ dir"); return
    rows = []
    for channel in sorted(p for p in root.iterdir() if p.is_dir() and p.name != "drafts"):
        for d in sorted(p for p in channel.iterdir() if p.is_dir()):
            files = [f for f in d.rglob("*") if f.is_file()]
            if not files:
                continue
            for f in files:
                _upload(sb, f)
            index = d / "index.html"
            pdfs = sorted(d.glob("*.pdf"))
            pngs = [p for p in sorted(d.glob("*.png")) if "oppr" in p.name]
            post = d / "post.txt"
            article = d / "article.md"
            if index.exists() and pdfs: kind = "carousel"
            elif index.exists() and pngs: kind = "image"
            elif article.exists(): kind = "article"
            else: kind = "post"
            meta = {}
            my = d / "meta.yaml"
            if my.exists():
                import yaml
                meta = yaml.safe_load(my.read_text(encoding="utf-8")) or {}
            rows.append({
                "channel": channel.name, "slug": d.name, "path": relposix(d),
                "kind": kind, "category": (meta.get("category") or kind),
                "idx_path": relposix(index) if index.exists() else None,
                "pdf_path": relposix(pdfs[0]) if pdfs else None,
                "image_path": relposix(pngs[0]) if pngs else None,
                "post_path": relposix(post) if post.exists() else None,
                "article_path": relposix(article) if article.exists() else None,
            })
    if rows:
        sb.upsert("social_outputs", rows, on_conflict="channel,slug")
    print(f"social: uploaded + registered {len(rows)} outputs")


def migrate_references(sb: Supa) -> None:
    root = REPO / "references"
    if not root.exists():
        print("no references/ dir"); return
    rows = []
    for f in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = _upload(sb, f)
        rows.append({"path": rel, "storage_object": rel, "bytes": f.stat().st_size})
    if rows:
        sb.upsert("reference_files", rows, on_conflict="path")
    print(f"references: uploaded + registered {len(rows)} files")


def main() -> int:
    sb = Supa()
    migrate_social(sb)
    migrate_references(sb)
    print("content migration done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
