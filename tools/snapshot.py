"""
Build a self-contained deck SNAPSHOT from a deck folder (Deck Studio v3, §2 of
the implementation plan).

A snapshot is one HTML document plus an asset bundle that renders from
index.html + assets/ alone (file://-openable, zero network). Transform:
  1. Assemble the deck (deckstudio) with slot sentinels for the personalization
     variables, so nothing outside the version can change how it renders.
  2. Give every <section> data-slide-id + data-role (editor + verify need these).
  3. Inline deck.css + showcase.css, rewriting their font url() to assets/.
  4. Bundle every referenced image/font into assets/ and rewrite src/url().
  5. Wrap the personalization variables in <span data-slot="..."> (masters).
  6. Embed a deck-meta JSON manifest before </head>.

Returns (html, assets) where assets is {filename: {"bytes", "source",
"entitlement", "sha256", "content_type"}}.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import date
from pathlib import Path

import yaml

import deckstudio as ds

REPO_ROOT = ds.REPO_ROOT
TEMPLATES = REPO_ROOT / "templates"

# Private-use sentinels that bracket a slot value through assembly, then become
# <span data-slot="..."> spans. Chosen so they never occur in real deck text.
S1, S2, S3 = chr(0xE000), chr(0xE001), chr(0xE002)
SLOT_VARS = {  # deck.yaml var name -> data-slot name
    "deck_footer": "footer-meta",
    "cover_meta": "cover-meta",
    "client": "client",
    "prepared_for": "prepared-for",
}

_IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
_FONT_EXT = {".woff2", ".woff", ".ttf"}


def _entitlements() -> dict:
    mf = REPO_ROOT / "brand" / "img" / "library.json"
    data = json.loads(mf.read_text(encoding="utf-8"))
    return {m["file"]: m.get("entitlement", "public") for m in data.get("images", [])}


def _role_of(deck: dict, deckdir: Path, sid: str) -> str:
    local = deckdir / "slides" / sid / "meta.yaml"
    meta = local if local.exists() else ds.SLIDES_DIR / sid / "meta.yaml"
    if meta.exists():
        return (yaml.safe_load(meta.read_text(encoding="utf-8")) or {}).get("role", "")
    return ""


def _inject_section_attrs(fragment: str, sid: str, role: str) -> str:
    """Add data-slide-id + data-role to the fragment's first <section>."""
    return re.sub(
        r"<section\b",
        f'<section data-slide-id="{sid}" data-role="{role}"',
        fragment, count=1,
    )


def _bundle(assets: dict, ent: dict, abspath: Path, prefer_name: str | None = None) -> str | None:
    """Register a file in the asset bundle, dedup by content. Return the
    assets/<name> reference, or None if the file does not exist."""
    if not abspath.exists() or not abspath.is_file():
        return None
    data = abspath.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    # dedup: same content already bundled -> reuse its filename
    for fn, meta in assets.items():
        if meta["sha256"] == sha:
            return f"assets/{fn}"
    name = prefer_name or abspath.name
    base, extn = os.path.splitext(name)
    # avoid clobbering a different file that happens to share a basename
    n = 1
    while name in assets:
        n += 1
        name = f"{base}_{n}{extn}"
    rel = None
    try:
        rel = str(abspath.resolve().relative_to(REPO_ROOT)).replace(os.sep, "/")
    except ValueError:
        rel = abspath.name
    entitlement = ent.get(rel.split("brand/img/", 1)[1], "public") if "brand/img/" in rel else "public"
    assets[name] = {
        "bytes": data, "source": rel, "entitlement": entitlement,
        "sha256": sha, "content_type": _ctype(name),
    }
    return f"assets/{name}"


def _ctype(name: str) -> str:
    ext = os.path.splitext(name)[1].lower()
    return {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
        ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
    }.get(ext, "application/octet-stream")


def _inline_css(name: str, assets: dict, ent: dict) -> str:
    """Read a template CSS file, bundle+rewrite its url() font refs, return a
    <style data-inlined="name"> block."""
    css = (TEMPLATES / name).read_text(encoding="utf-8")

    def repl(m: re.Match) -> str:
        raw = m.group(1).strip().strip('"').strip("'")
        if raw.startswith("data:") or raw.startswith("assets/"):
            return m.group(0)
        target = (TEMPLATES / raw).resolve()
        newref = _bundle(assets, ent, target)
        return f'url("{newref}")' if newref else m.group(0)

    css = re.sub(r"url\(([^)]+)\)", repl, css)
    return f'<style data-inlined="{name}">\n{css}\n</style>'


def _slotify(html: str) -> str:
    """Convert slot sentinels into <span data-slot="..."> spans."""
    return re.sub(
        re.escape(S1) + r"(.*?)" + re.escape(S2) + r"(.*?)" + re.escape(S3),
        lambda m: f'<span data-slot="{m.group(1)}">{m.group(2)}</span>',
        html, flags=re.DOTALL,
    )


def build_snapshot(deckdir: Path) -> tuple[str, dict, dict]:
    deckdir = Path(deckdir).resolve()
    deck = ds.load_deck(deckdir)
    slides = deck["slides"]
    ent = _entitlements()
    assets: dict = {}

    # 1. variables, with slot sentinels for the personalization vars
    variables = dict(deck["vars"])
    variables["deck_title"] = deck["title"]
    variables["total"] = str(len(slides))
    variables["asset"] = ds.asset_prefix(deckdir)
    for var, slot in SLOT_VARS.items():
        if var in variables and str(variables[var]) != "":
            variables[var] = f"{S1}{slot}{S2}{variables[var]}{S3}"

    # 2. blocks with section attributes
    slide_meta = []
    blocks = []
    for i, sid in enumerate(slides, start=1):
        role = _role_of(deck, deckdir, sid)
        slide_meta.append({"id": sid, "role": role})
        raw = ds.read_slide(sid, deckdir)
        raw = _inject_section_attrs(raw, sid, role)
        blocks.append(f"<!-- {i:02d} · {sid} -->\n{raw}")

    document = ds._WRAPPER.replace("{body}", "\n\n".join(blocks))
    document = ds.inline_icons(document)
    document = ds.fill(document, variables)

    missing = ds.unfilled(document)
    if missing:
        raise SystemExit(f"ERROR: unfilled variables in '{deck['type']}': {missing}")

    # 3. replace the two stylesheet links with inlined <style> blocks
    document = re.sub(
        r'<link rel="stylesheet" href="[^"]*templates/deck\.css">',
        _inline_css("deck.css", assets, ent), document, count=1)
    document = re.sub(
        r'<link rel="stylesheet" href="[^"]*templates/showcase\.css">',
        _inline_css("showcase.css", assets, ent), document, count=1)

    # 4. bundle every referenced image/font and rewrite src/href/url()
    def rw_attr(m: re.Match) -> str:
        attr, val = m.group(1), m.group(2)
        newref = _resolve(val, deckdir, assets, ent)
        return f'{attr}="{newref}"' if newref else m.group(0)

    document = re.sub(r'(src|href)="([^"]+)"', rw_attr, document)

    def rw_url(m: re.Match) -> str:
        val = m.group(1).strip().strip('"').strip("'")
        if val.startswith("assets/") or val.startswith("data:"):
            return m.group(0)
        newref = _resolve(val, deckdir, assets, ent)
        return f'url("{newref}")' if newref else m.group(0)

    document = re.sub(r"url\(([^)]+)\)", rw_url, document)

    # 5. slot spans
    document = _slotify(document)

    # 6. deck-meta manifest before </head>
    meta = {
        "schema": 1,
        "title": deck["title"],
        "type": deck.get("type", ""),
        "client": deck.get("client", ""),
        "allowed_entitlements": list(deck.get("allowed_entitlements", ["public"])),
        "slides": slide_meta,
        "assets": {fn: {"source": a["source"], "entitlement": a["entitlement"]}
                   for fn, a in assets.items()},
        "published": date.today().isoformat(),
        "tool": "publish-deck.py",
    }
    meta_block = ('<script type="application/json" id="deck-meta">\n'
                  + json.dumps(meta, ensure_ascii=False) + "\n</script>\n")
    document = document.replace("</head>", meta_block + "</head>", 1)

    return document, assets, deck


def _resolve(val: str, deckdir: Path, assets: dict, ent: dict) -> str | None:
    """If val points at a bundleable image/font relative to the deck dir,
    bundle it and return assets/<name>; else None."""
    if val.startswith(("assets/", "data:", "http:", "https:", "#", "mailto:")):
        return None
    ext = os.path.splitext(val.split("?")[0])[1].lower()
    if ext not in _IMG_EXT and ext not in _FONT_EXT:
        return None
    target = (deckdir / val).resolve()
    return _bundle(assets, ent, target)
