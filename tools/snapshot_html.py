#!/usr/bin/env python
"""
Snapshot an ALREADY-BUILT HTML document into a self-contained artifact
(Deck Studio 2.0, the one-artifact-model change).

`snapshot.py` builds a snapshot from a deck FOLDER (deck.yaml + library
fragments). This module does the same job for a finished HTML document that a
build script already produced — a LinkedIn carousel, a social image, an article
hero. That is what lets a carousel enter the same decks/deck_versions machinery
a deck uses, and therefore get versioning, the editor, verify and a fresh PDF.

Transform (same guarantees as snapshot.py):
  1. Inline every <link rel="stylesheet">, rewriting its url() refs to assets/.
  2. Bundle every <img src> and inline-style url() into assets/.
  3. Give every page <section> data-slide-id + data-role, which the editor and
     verify both require.

The result renders from index.html + assets/ alone: file://-openable, zero
network. Used by tools/import-social.py and available to any future builder.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from snapshot import _bundle, _ctype, _entitlements  # noqa: F401  (shared bundler)

REPO_ROOT = Path(__file__).resolve().parent.parent

# Container -> the element that holds the pages. A deck and a carousel are the
# same shape: one wrapper div, one <section> per page.
PAGE_CONTAINERS = ("deck", "carousel")


def _inline_css_file(css_path: Path, assets: dict, ent: dict) -> str:
    """Inline one stylesheet, bundling the url() targets it references."""
    css = css_path.read_text(encoding="utf-8")
    base = css_path.parent

    def repl(m: re.Match) -> str:
        raw = m.group(1).strip().strip('"').strip("'")
        if raw.startswith(("data:", "assets/", "http://", "https://")):
            return m.group(0)
        newref = _bundle(assets, ent, (base / raw).resolve())
        return f'url("{newref}")' if newref else m.group(0)

    css = re.sub(r"url\(([^)]+)\)", repl, css)
    return f'<style data-inlined="{css_path.name}">\n{css}\n</style>'


def _role_for(classes: str, index: int, total: int) -> str:
    """Derive a page role from its classes, falling back to position.

    Roles matter to verify (footer discipline) and to the editor. The carousel
    vocabulary (lpage--hook / --cta) maps onto the deck vocabulary
    (cover / closer) so one rule set can serve both.
    """
    c = classes or ""
    if "--hook" in c:
        return "cover"
    if "--cta" in c:
        return "cta"
    if "--mark" in c:
        return "closer"
    if index == 0:
        return "cover"
    if index == total - 1:
        return "cta"
    return "content"


def _tag_sections(html: str) -> str:
    """Add data-slide-id + data-role to every page <section> that lacks them."""
    sections = list(re.finditer(r"<section\b([^>]*)>", html))
    total = len(sections)
    out, cursor, i = [], 0, 0
    for m in sections:
        out.append(html[cursor:m.start()])
        attrs = m.group(1)
        if "data-slide-id" in attrs:
            out.append(m.group(0))
        else:
            cls = re.search(r'class="([^"]*)"', attrs)
            role = _role_for(cls.group(1) if cls else "", i, total)
            out.append(f'<section data-slide-id="p{i + 1}" data-role="{role}"{attrs}>')
        cursor = m.end()
        i += 1
    out.append(html[cursor:])
    return "".join(out)


def snapshot_document(html: str, base_dir: Path) -> tuple[str, dict]:
    """Make a built HTML document self-contained.

    `base_dir` is the directory the document's relative refs resolve against —
    the folder it was built in (e.g. social/linkedin/<slug>/), even when the
    bytes came from Storage rather than from that folder.

    Returns (html, assets) where assets maps filename -> the dict shape
    snapshot.py's _bundle produces (bytes, source, entitlement, sha256,
    content_type), ready for deck_assets + Storage upload.
    """
    base_dir = Path(base_dir)
    assets: dict = {}
    ent = _entitlements()

    # 1. stylesheets -> inline <style>
    def css_repl(m: re.Match) -> str:
        href = m.group(1).strip()
        if href.startswith(("http://", "https://", "data:")):
            return m.group(0)
        target = (base_dir / href).resolve()
        if not target.exists():
            raise FileNotFoundError(f"stylesheet not found: {href} (from {base_dir})")
        return _inline_css_file(target, assets, ent)

    html = re.sub(
        r'<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>',
        css_repl, html,
    )

    # 2. <img src> and any inline style url() -> assets/
    def src_repl(m: re.Match) -> str:
        raw = m.group(2)
        if raw.startswith(("data:", "assets/", "http://", "https://")):
            return m.group(0)
        newref = _bundle(assets, ent, (base_dir / raw).resolve())
        return f'{m.group(1)}="{newref}"' if newref else m.group(0)

    html = re.sub(r'\b(src)="([^"]+)"', src_repl, html)

    def url_repl(m: re.Match) -> str:
        raw = m.group(1).strip().strip('"').strip("'")
        if raw.startswith(("data:", "assets/", "http://", "https://")):
            return m.group(0)
        newref = _bundle(assets, ent, (base_dir / raw).resolve())
        return f'url("{newref}")' if newref else m.group(0)

    html = re.sub(r"url\(([^)]+)\)", url_repl, html)

    # 3. page sections carry their id + role
    html = _tag_sections(html)

    return html, assets


def inject_meta(html: str, *, title: str, kind: str, page_format: str,
                client: str = "", allowed: list | None = None,
                assets: dict | None = None) -> str:
    """Embed the deck-meta manifest verify reads.

    Without this, verify_snapshot FAILs with 'missing its deck-meta manifest'
    and can never check the artifact at all. The manifest is also where
    `page_format` is DECLARED, so the gate applies the carousel rules to a
    carousel instead of asserting deck geometry on it.
    """
    assets = assets or {}
    slides = [
        {"id": sid, "role": role}
        for sid, role in re.findall(
            r'<section[^>]*data-slide-id="([^"]+)"[^>]*data-role="([^"]+)"', html
        )
    ]
    meta = {
        "schema": 1,
        "title": title,
        "type": kind,
        "kind": kind,
        "page_format": page_format,
        "client": client,
        "allowed_entitlements": list(allowed or ["public"]),
        "slides": slides,
        "assets": {fn: {"source": a.get("source", ""), "entitlement": a.get("entitlement", "public")}
                   for fn, a in assets.items()},
        "tool": "snapshot_html.py",
    }
    tag = f'<script type="application/json" id="deck-meta">\n{json.dumps(meta, ensure_ascii=False)}\n</script>\n'
    if "</head>" in html:
        return html.replace("</head>", tag + "</head>", 1)
    return tag + html


def max_entitlement(assets: dict) -> list[str]:
    """The clearance a snapshot needs: every entitlement its assets carry."""
    return sorted({meta.get("entitlement", "public") for meta in assets.values()} | {"public"})
