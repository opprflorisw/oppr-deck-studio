#!/usr/bin/env python
"""
Build the JSON index the Deck Studio App reads.

Python owns all YAML reading in this repo (PyYAML), so the zero-dependency Node
server never needs a YAML parser: it just serves the JSON this script writes.

    python tools/build_app_index.py            # writes app/index.json
    python tools/build_app_index.py --stdout   # prints JSON to stdout

The index describes every library slide (with its thumbnail), every canonical
deck and frozen variant (with its composition + assembled preview), the image
library, the role vocabulary, and the recipe types. Everything is repo-relative
so the app can serve it under /repo/<path>.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SLIDES_DIR = REPO_ROOT / "library" / "slides"

# The skeleton role order (mirrors library/CLAUDE.md), used to sort/group slides.
ROLE_ORDER = [
    "cover", "idea", "why-now", "problem-recognition", "when-time-matters",
    "platform", "product-flow", "outcomes", "evidence", "kpi", "engagement",
    "step-detail", "acceptance", "running-projects", "who-is-oppr", "cta", "closer",
]


def _yaml(p: Path) -> dict:
    if not p.exists():
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def rel(p: Path) -> str:
    return p.relative_to(REPO_ROOT).as_posix()


def build_slides() -> list[dict]:
    slides = []
    for d in sorted(SLIDES_DIR.iterdir()):
        if not d.is_dir():
            continue
        meta = _yaml(d / "meta.yaml")
        if not meta:
            continue
        thumb = d / "thumb.png"
        slides.append({
            "id": meta.get("id", d.name),
            "role": meta.get("role", ""),
            "title": meta.get("title", d.name),
            "tags": meta.get("tags", []) or [],
            "entitlement": meta.get("entitlement", "public"),
            "language": meta.get("language", "en"),
            "images": meta.get("images", []) or [],
            "variables": meta.get("variables", []) or [],
            "used_in": meta.get("used_in", []) or [],
            "notes": meta.get("notes", ""),
            "thumb": rel(thumb) if thumb.exists() else None,
        })

    def sort_key(s):
        r = s["role"]
        return (ROLE_ORDER.index(r) if r in ROLE_ORDER else len(ROLE_ORDER), s["id"])

    slides.sort(key=sort_key)
    return slides


def build_deck(deckdir: Path) -> dict:
    deck = _yaml(deckdir / "deck.yaml")
    index = deckdir / "index.html"
    pdfs = list(deckdir.glob("*.pdf"))
    # A variant may hold local slide overrides.
    overrides = []
    slides_over = deckdir / "slides"
    if slides_over.exists():
        for od in slides_over.iterdir():
            if (od / "slide.html").exists() or (od.suffix == ".html"):
                overrides.append(od.stem if od.suffix == ".html" else od.name)
    return {
        "path": rel(deckdir),
        "slug": deckdir.name,
        "title": deck.get("title", deckdir.name),
        "type": deck.get("type", ""),
        "client": deck.get("client", ""),
        "vars": deck.get("vars", {}) or {},
        "allowed_entitlements": deck.get("allowed_entitlements", ["public"]),
        "slides": deck.get("slides", []) or [],
        "overrides": overrides,
        "index": rel(index) if index.exists() else None,
        "pdf": rel(pdfs[0]) if pdfs else None,
    }


def build_decks() -> dict:
    out = {"canonical": [], "variants": []}
    canon = REPO_ROOT / "decks" / "canonical"
    var = REPO_ROOT / "decks" / "variants"
    if canon.exists():
        for d in sorted(canon.iterdir()):
            if (d / "deck.yaml").exists():
                out["canonical"].append(build_deck(d))
    if var.exists():
        for d in sorted(var.iterdir()):
            if (d / "deck.yaml").exists():
                out["variants"].append(build_deck(d))
    return out


def build_images() -> list[dict]:
    mf = REPO_ROOT / "brand" / "img" / "library.json"
    if not mf.exists():
        return []
    data = json.loads(mf.read_text(encoding="utf-8"))
    imgs = []
    for m in data.get("images", []):
        f = m.get("file", "")
        imgs.append({**m, "src": f"brand/img/{f}"})
    return imgs


def build_recipes() -> list[dict]:
    out = []
    types = REPO_ROOT / "types"
    if types.exists():
        for d in sorted(types.iterdir()):
            if d.is_dir() and (d / "recipe.md").exists():
                out.append({"type": d.name, "path": rel(d / "recipe.md")})
    return out


def build_index() -> dict:
    return {
        "slides": build_slides(),
        "decks": build_decks(),
        "images": build_images(),
        "roles": ROLE_ORDER,
        "recipes": build_recipes(),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Deck Studio App index.")
    ap.add_argument("--stdout", action="store_true", help="print to stdout instead of writing app/index.json")
    args = ap.parse_args()

    index = build_index()
    payload = json.dumps(index, indent=2, ensure_ascii=False)

    if args.stdout:
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
        print(payload)
    else:
        out = REPO_ROOT / "app" / "index.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(payload, encoding="utf-8")
        print(f"Wrote {rel(out)} — {len(index['slides'])} slides, "
              f"{len(index['decks']['canonical'])} canonical, "
              f"{len(index['decks']['variants'])} variants, "
              f"{len(index['images'])} images.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
