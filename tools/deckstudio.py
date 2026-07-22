"""
Oppr Deck Studio — shared assembly engine.

A deck is a composition: decks/<...>/<name>/deck.yaml lists an ordered set of
library slide ids plus deck-level variable values. Assembly reads each library
slide fragment (library/slides/<id>/slide.html), fills {{variables}}, and writes
a self-contained index.html next to the deck.yaml.

Variables filled at assembly:
  - deck_title  : the <title> and comes from deck.yaml `title`
  - deck_footer : the footer meta line (from deck.yaml `vars`)
  - cover_meta  : the cover meta line (from deck.yaml `vars`)
  - total       : slide count, computed (never stored — cannot drift)
  - asset       : relative path from the output file to the repo root, computed
                  from the output location, so image/CSS paths resolve wherever
                  the deck is written (canonical is 3 deep, variants are 3 deep).

Any {{placeholder}} left unfilled after assembly is a hard error — no
placeholder ever reaches a PDF.

This module is imported by assemble-deck.py, verify-deck.py and
build-slide-catalog logic; it has no third-party dependencies except PyYAML.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SLIDES_DIR = REPO_ROOT / "library" / "slides"

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([\w\-]+)\s*\}\}")
_SECTION_RE = re.compile(r"<section\b.*?</section>", re.DOTALL)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ASSET_RUN_RE = re.compile(r"(?:\.\./)+")

_WRAPPER = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{deck_title}}</title>
<link rel="stylesheet" href="{{asset}}templates/deck.css">
<link rel="stylesheet" href="{{asset}}templates/showcase.css">
</head>
<body>
<div class="deck">

{body}

</div>
</body>
</html>
"""


def asset_prefix(out_dir: Path) -> str:
    """Relative path (POSIX, trailing slash) from out_dir to the repo root."""
    rel = os.path.relpath(REPO_ROOT, out_dir).replace(os.sep, "/")
    if rel == ".":
        return "./"
    return rel + "/"


def fill(text: str, variables: dict) -> str:
    for key, value in variables.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def unfilled(text: str) -> list[str]:
    return sorted(set(_PLACEHOLDER_RE.findall(text)))


def slide_path(slide_id: str, deckdir: Path | None = None) -> Path:
    """Resolve a slide id to a fragment path. A deck may hold local slide
    overrides (adjusted or brand-new slides for a variant) under
    <deckdir>/slides/<id>/slide.html or <deckdir>/slides/<id>.html; those win
    over the shared library so a variant never has to touch library/."""
    if deckdir is not None:
        local_dir = Path(deckdir) / "slides" / slide_id / "slide.html"
        local_flat = Path(deckdir) / "slides" / f"{slide_id}.html"
        if local_dir.exists():
            return local_dir
        if local_flat.exists():
            return local_flat
    return SLIDES_DIR / slide_id / "slide.html"


def read_slide(slide_id: str, deckdir: Path | None = None) -> str:
    p = slide_path(slide_id, deckdir)
    if not p.exists():
        raise SystemExit(f"ERROR: slide not found: {slide_id} ({p})")
    return p.read_text(encoding="utf-8").rstrip("\n")


def load_deck(deckdir: Path) -> dict:
    deckdir = Path(deckdir)
    yml = deckdir / "deck.yaml"
    if not yml.exists():
        raise SystemExit(f"ERROR: no deck.yaml in {deckdir}")
    data = yaml.safe_load(yml.read_text(encoding="utf-8"))
    for key in ("title", "type", "slides"):
        if key not in data:
            raise SystemExit(f"ERROR: deck.yaml missing '{key}': {yml}")
    data.setdefault("vars", {})
    return data


def assemble(deckdir: Path, write: bool = True) -> str:
    """Assemble deckdir/deck.yaml into a full HTML document string."""
    deckdir = Path(deckdir).resolve()
    deck = load_deck(deckdir)
    slides = deck["slides"]

    variables = dict(deck["vars"])
    variables["deck_title"] = deck["title"]
    variables["total"] = str(len(slides))
    variables["asset"] = asset_prefix(deckdir)

    blocks = []
    for i, slide_id in enumerate(slides, start=1):
        raw = read_slide(slide_id, deckdir)
        block = f"<!-- {i:02d} · {slide_id} -->\n{raw}"
        blocks.append(block)

    document = _WRAPPER.replace("{body}", "\n\n".join(blocks))
    document = fill(document, variables)

    missing = unfilled(document)
    if missing:
        raise SystemExit(
            f"ERROR: unfilled variables in '{deck['type']}': {missing}. "
            "Every {{placeholder}} must be provided in deck.yaml vars."
        )

    if write:
        out = deckdir / "index.html"
        out.write_text(document, encoding="utf-8")
    return document


# --- helpers shared with verification ---------------------------------------

def sections(html: str) -> list[str]:
    return _SECTION_RE.findall(html)


def normalize_assets(s: str) -> str:
    """Collapse any run of '../' into a single token so files at different
    directory depths compare equal on everything except their asset prefix."""
    return _ASSET_RUN_RE.sub("@/", s)


def strip_comments(s: str) -> str:
    return _COMMENT_RE.sub("", s)
