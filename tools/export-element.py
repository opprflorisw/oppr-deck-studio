#!/usr/bin/env python
"""
Export a SINGLE library element as a self-contained file (Deck Studio 2.0).

The Library area could show a slide, a design-system block or an icon, but the
only way to get one out was to build a whole deck around it. This exports one.

Why self-contained HTML and not the raw fragment: a `library/slides/<id>/
slide.html` fragment is useless on its own. It has no stylesheet, so it renders
as unstyled text, and it still carries its `{{deck_footer}}` / `{{total}}` /
`{{asset}}` placeholders, so it renders with visible holes. The export therefore
fills the placeholders, wraps the fragment in a one-page document, inlines
deck.css + showcase.css and bundles every image — the same transform a published
deck gets. The result opens anywhere, offline, and can be printed.

    python tools/export-element.py --kind slide --id why-now --out out.html
    python tools/export-element.py --kind block --id qlist  --out out.html

Entitlement is enforced on the way out: an element that pulls a non-public image
refuses to export unless --allow <slug> names that clearance, so a bare element
cannot leak what a deck would have blocked.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from snapshot_html import snapshot_document, inject_meta

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = REPO_ROOT / "templates"

# Placeholder values for a standalone one-page render. `total` is 1 because the
# export IS one page; the footer names the element so a stray print is traceable.
def _fill(fragment: str, element_id: str, asset_prefix: str) -> str:
    values = {
        "asset": asset_prefix,
        "total": "1",
        "deck_footer": f"library element · {element_id}",
        "cover_meta": "",
        "prepared_for": "",
        "start_target": "",
        "scope_line": "",
    }
    for k, v in values.items():
        fragment = fragment.replace("{{" + k + "}}", v)
    return fragment


def source_for(kind: str, element_id: str) -> Path:
    if kind == "slide":
        return REPO_ROOT / "library" / "slides" / element_id / "slide.html"
    if kind == "block":
        p = REPO_ROOT / "library" / "design-system" / "blocks" / f"{element_id}.html"
        if p.exists():
            return p
        return REPO_ROOT / "library" / "design-system" / "patterns" / f"{element_id}.html"
    raise SystemExit(f"unknown kind: {kind}")


def build(kind: str, element_id: str, allow: list[str]) -> tuple[str, dict]:
    src = source_for(kind, element_id)
    if not src.exists():
        raise SystemExit(f"ERROR: no such {kind}: {element_id} ({src})")

    # The two element kinds arrive in different shapes and must not be treated
    # alike. A design-system BLOCK specimen is already a complete document with
    # its own <head> and stylesheet links relative to its own folder, so it is
    # snapshotted as-is. Only a library SLIDE is a bare fragment that needs a
    # document built around it.
    if kind == "block":
        doc = src.read_text(encoding="utf-8")
        page_format = "linkedin-4x5" if "lpage" in doc else "deck-16x9"
        html, assets = snapshot_document(doc, src.parent)
        return _finish(html, assets, element_id, page_format, allow)
    # Fragments reference images as `{{asset}}brand/img/...` with NO separator,
    # so the prefix must be "" (or end in a slash). Getting this wrong makes
    # every image silently fail to bundle and the export looks fine until you
    # open it, so the unresolved-image check below is not optional.
    fragment = _fill(src.read_text(encoding="utf-8"), element_id, "")

    # A carousel block belongs in the linkedin frame, everything else in the deck
    # frame. Getting this wrong renders the element at the wrong page size.
    is_linkedin = "lpage" in fragment or kind == "block" and "linkedin" in element_id
    css = ["linkedin.css"] if is_linkedin else ["deck.css", "showcase.css"]
    container = "carousel" if is_linkedin else "deck"
    page_format = "linkedin-4x5" if is_linkedin else "deck-16x9"

    links = "\n".join(
        f'<link rel="stylesheet" href="{(TEMPLATES / c).as_posix()}">' for c in css
    )
    doc = (
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
        f"<title>{element_id}</title>\n{links}\n</head>\n"
        f"<body>\n<div class=\"{container}\">\n{fragment}\n</div>\n</body>\n</html>\n"
    )

    html, assets = snapshot_document(doc, REPO_ROOT)
    return _finish(html, assets, element_id, page_format, allow)


def _finish(html: str, assets: dict, element_id: str, page_format: str,
            allow: list[str]) -> tuple[str, dict]:
    """Shared tail: no broken images, clearance enforced, manifest embedded."""
    # An image that did not bundle stays as its original src and renders as a
    # broken box. Fail loudly rather than hand over an export with holes.
    import re as _re
    unresolved = [s for s in _re.findall(r'<img[^>]+src="([^"]+)"', html)
                  if not s.startswith(("assets/", "data:"))]
    if unresolved:
        raise SystemExit(
            "ERROR: these images did not resolve and would export broken:\n"
            + "\n".join(f"    {s}" for s in unresolved)
        )

    allowed = set(allow) | {"public"}
    blocked = {fn: a["entitlement"] for fn, a in assets.items()
               if a.get("entitlement", "public") not in allowed}
    if blocked:
        lines = "\n".join(f"    {fn}: {ent}" for fn, ent in blocked.items())
        raise SystemExit(
            f"REFUSED: '{element_id}' pulls images above your clearance:\n{lines}\n"
            f"    Re-run with --allow <slug> if you are cleared for them."
        )

    html = inject_meta(html, title=element_id, kind="element",
                       page_format=page_format, allowed=sorted(allowed), assets=assets)
    return html, assets


def inline_assets(html: str, assets: dict) -> str:
    """Fold assets/ into data: URIs so the export is ONE file.

    An element you download is meant to be handed around — dropped in a mail,
    opened on another machine. A folder of index.html + assets/ survives none of
    that, so the default export inlines everything.
    """
    import base64
    for name, meta in assets.items():
        b64 = base64.b64encode(meta["bytes"]).decode("ascii")
        uri = f"data:{meta['content_type']};base64,{b64}"
        html = html.replace(f'"assets/{name}"', f'"{uri}"')
        html = html.replace(f"url(\"assets/{name}\")", f'url("{uri}")')
    return html


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", required=True, choices=["slide", "block"])
    ap.add_argument("--id", required=True)
    ap.add_argument("--out", required=True, help="output .html path")
    ap.add_argument("--allow", default="", help="comma-separated clearance slugs")
    ap.add_argument("--sidecar", action="store_true",
                    help="write assets/ beside the HTML instead of inlining them "
                         "(needed when the file will be printed to PNG/PDF)")
    args = ap.parse_args()

    allow = [s.strip() for s in args.allow.split(",") if s.strip()]
    html, assets = build(args.kind, args.id, allow)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if args.sidecar:
        adir = out.parent / "assets"
        adir.mkdir(exist_ok=True)
        for name, meta in assets.items():
            (adir / name).write_bytes(meta["bytes"])
    else:
        html = inline_assets(html, assets)
    out.write_text(html, encoding="utf-8")

    print(f"{out}  ({len(html)} bytes, {len(assets)} assets"
          f"{', sidecar' if args.sidecar else ', inlined'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
