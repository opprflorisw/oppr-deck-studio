#!/usr/bin/env python
"""
Regenerate brand/img/index.html — a contact sheet of every image asset, showing
each image's manifest description, entitlement and suggested-use from
brand/img/library.json, and WARNING on drift (any file with no manifest entry,
any manifest entry with no file). That drift warning is the whole sync mechanism.

Entry point is tools/build-asset-index.ps1 (a thin shim); or run directly:
    python tools/build_asset_index.py
"""
from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMG_ROOT = ROOT / "brand" / "img"
OUT = IMG_ROOT / "index.html"
MANIFEST = IMG_ROOT / "library.json"

EXomit = {".html", ".json"}
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"}
BADGE = {"public": "#55745e", "named-customer": "#a65032", "mutares-family": "#3e6874"}

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Oppr deck assets</title>
<style>
  body { font-family: Arial, sans-serif; background: #f2f2ed; color: #15201e; margin: 0; padding: 32px 40px; }
  h1 { letter-spacing: -0.03em; } h1 b { color: #a65032; }
  h2 { font-size: 15px; font-family: Consolas, monospace; letter-spacing: 0.04em; margin: 36px 0 10px; border-bottom: 1px solid #c8ceca; padding-bottom: 6px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  figure { margin: 0; width: 220px; background: #fcfbf7; border: 1px solid #c8ceca; border-radius: 8px; padding: 8px; display:flex; flex-direction:column; }
  figure img { width: 100%; height: 130px; object-fit: contain; display: block; background: repeating-conic-gradient(#e8e8e2 0% 25%, #fff 0% 50%) 0 0/16px 16px; border-radius: 4px; }
  .fn { font-family: Consolas, monospace; font-size: 9.5px; color: #5f6965; margin-top: 6px; word-break: break-all; }
  .desc { font-size: 12px; line-height:1.35; margin-top: 6px; color:#15201e; }
  .su { font-size: 10.5px; color:#5f6965; margin-top:5px; font-style:italic; }
  .ent { display:inline-block; font-family:Consolas,monospace; font-size:9px; letter-spacing:0.06em; text-transform:uppercase; color:#fff; padding:1px 6px; border-radius:3px; margin-top:6px; align-self:flex-start; }
  .nomatch { outline:2px solid #a65032; }
  .warn { color:#a65032; }
</style>
</head>
<body>
<h1>oppr<b>.</b> deck assets</h1>
"""


def relkey(p: Path) -> str:
    return p.relative_to(IMG_ROOT).as_posix()


def main() -> int:
    meta = {}
    if MANIFEST.exists():
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        for m in data.get("images", []):
            meta[m["file"]] = m
    else:
        print("WARNING: no library.json — captions show filenames only", file=sys.stderr)

    files = sorted(
        (p for p in IMG_ROOT.rglob("*") if p.is_file() and p.suffix.lower() in IMG_EXT),
        key=lambda p: relkey(p),
    )
    on_disk = {relkey(p) for p in files}

    missing_from_manifest = sorted(on_disk - set(meta))
    missing_from_disk = sorted(set(meta) - on_disk)
    for x in missing_from_manifest:
        print(f"WARNING DRIFT: image on disk has no manifest entry -> {x}", file=sys.stderr)
    for x in missing_from_disk:
        print(f"WARNING DRIFT: manifest entry has no file on disk -> {x}", file=sys.stderr)
    drift = len(missing_from_manifest) + len(missing_from_disk)

    parts = [HEAD]
    note = "manifest in sync" if drift == 0 else f"<span class='warn'>{drift} drift warning(s)</span>"
    parts.append(
        "<p style='font-family:Consolas,monospace;font-size:12px;color:#5f6965;'>"
        f"{len(files)} images &middot; {note} &middot; regenerate with tools\\build-asset-index.ps1</p>"
    )

    # group by parent folder
    groups: dict[str, list[Path]] = {}
    for p in files:
        key = p.parent.relative_to(IMG_ROOT).as_posix() or "(root)"
        groups.setdefault(key, []).append(p)

    for group in sorted(groups):
        parts.append(f"<h2>{html.escape(group)}</h2><div class='grid'>")
        for p in groups[group]:
            rel = relkey(p)
            m = meta.get(rel)
            cls = "" if m else " class='nomatch'"
            fig = [f"<figure{cls}><img loading='lazy' src='{rel}'>",
                   f"<div class='fn'>{html.escape(rel)}</div>"]
            if m:
                fig.append(f"<div class='desc'>{html.escape(m['description'])}</div>")
                if m.get("suggested_use"):
                    fig.append("<div class='su'>" +
                               html.escape(" · ".join(m["suggested_use"])) + "</div>")
                col = BADGE.get(m.get("entitlement", ""), "#5f6965")
                fig.append(f"<span class='ent' style='background:{col}'>"
                           f"{html.escape(m.get('entitlement',''))}</span>")
            else:
                fig.append("<div class='su warn'>no manifest entry</div>")
            fig.append("</figure>")
            parts.append("".join(fig))
        parts.append("</div>")

    parts.append("</body></html>")
    OUT.write_text("\n".join(parts), encoding="utf-8")
    print(f"Gallery written: {OUT} ({len(files)} images, {drift} drift warning(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
