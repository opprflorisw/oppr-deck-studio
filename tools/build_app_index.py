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
import subprocess
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

# The narrative spine: roles grouped into sections (see V2-SPEC.md 2.3).
SECTIONS = [
    ("Opening", "The hook and the one idea", ["cover", "idea"]),
    ("Problem", "Make them recognize themselves", ["why-now", "problem-recognition", "when-time-matters"]),
    ("Product", "How it works", ["platform", "product-flow"]),
    ("Proof", "Outcomes, evidence, payback", ["outcomes", "evidence", "kpi"]),
    ("Path", "How we engage and deliver", ["engagement", "step-detail"]),
    ("Trust", "Why us, who we are", ["acceptance", "running-projects", "who-is-oppr"]),
    ("Closing", "The ask and the close", ["cta", "closer"]),
]
ROLE_SECTION = {role: name for name, _desc, roles in SECTIONS for role in roles}


def _yaml(p: Path) -> dict:
    if not p.exists():
        return {}
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def rel(p: Path) -> str:
    return p.relative_to(REPO_ROOT).as_posix()


def git_version_map() -> dict:
    """One `git log` pass over the slide fragments -> {id: (count, last_date)}.
    Empty if git is unavailable or the repo has no history."""
    import re as _re
    date_re = _re.compile(r"^\d{4}-\d{2}-\d{2}$")
    try:
        out = subprocess.run(
            ["git", "log", "--format=%ad", "--date=short", "--name-only",
             "--", "library/slides"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8",
        ).stdout
    except Exception:
        return {}
    counts: dict[str, int] = {}
    last: dict[str, str] = {}
    cur_date = ""
    for line in out.splitlines():
        if date_re.match(line):
            cur_date = line
        elif line.startswith("library/slides/") and line.endswith("/slide.html"):
            sid = line.split("/")[2]
            counts[sid] = counts.get(sid, 0) + 1
            last.setdefault(sid, cur_date)  # first seen = most recent (log is newest-first)
    return {sid: (counts[sid], last.get(sid, "")) for sid in counts}


def build_slides() -> list[dict]:
    versions = git_version_map()
    slides = []
    for d in sorted(SLIDES_DIR.iterdir()):
        if not d.is_dir():
            continue
        meta = _yaml(d / "meta.yaml")
        if not meta:
            continue
        thumb = d / "thumb.png"
        role = meta.get("role", "")
        vcount, vlast = versions.get(d.name, (None, ""))
        slides.append({
            "id": meta.get("id", d.name),
            "role": role,
            "section": ROLE_SECTION.get(role, "Other"),
            "title": meta.get("title", d.name),
            "tags": meta.get("tags", []) or [],
            "entitlement": meta.get("entitlement", "public"),
            "language": meta.get("language", "en"),
            "images": meta.get("images", []) or [],
            "variables": meta.get("variables", []) or [],
            "used_in": meta.get("used_in", []) or [],
            "notes": meta.get("notes", ""),
            "thumb": rel(thumb) if thumb.exists() else None,
            "versions": vcount,
            "last_changed": vlast,
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


def build_social() -> list[dict]:
    """Scan social/<channel>/<date>_<slug>/ for built outputs."""
    out = []
    root = REPO_ROOT / "social"
    if not root.exists():
        return out
    for channel in sorted(root.iterdir()):
        if not channel.is_dir() or channel.name == "drafts":
            continue
        for d in sorted(channel.iterdir()):
            if not d.is_dir():
                continue
            index = d / "index.html"
            pdfs = list(d.glob("*.pdf"))
            post = d / "post.txt"
            article = d / "article.md"
            if not (index.exists() or pdfs or post.exists() or article.exists()):
                continue
            kind = "carousel" if index.exists() and pdfs else ("article" if article.exists() else "post")
            out.append({
                "channel": channel.name,
                "slug": d.name,
                "path": rel(d),
                "kind": kind,
                "index": rel(index) if index.exists() else None,
                "pdf": rel(pdfs[0]) if pdfs else None,
                "post": rel(post) if post.exists() else None,
                "article": rel(article) if article.exists() else None,
            })
    return out


def build_icons() -> list[dict]:
    """The reusable icon set: manifest entries + the inline SVG for each, so the
    app can render them and offer the {{icon:NAME}} token."""
    idir = REPO_ROOT / "library" / "icons"
    mf = idir / "icons.json"
    if not mf.exists():
        return []
    data = json.loads(mf.read_text(encoding="utf-8"))
    out = []
    for m in data.get("icons", []):
        svg_path = idir / f"{m['name']}.svg"
        out.append({
            **m,
            "path": rel(svg_path) if svg_path.exists() else None,
            "svg": svg_path.read_text(encoding="utf-8").strip() if svg_path.exists() else "",
        })
    return out


def build_design_system() -> list[dict]:
    """Every design-system specimen, grouped, so the app can stack them inline."""
    out = []
    root = REPO_ROOT / "library" / "design-system"
    for group in ("foundations", "blocks", "patterns"):
        gdir = root / group
        if not gdir.exists():
            continue
        for f in sorted(gdir.glob("*.html")):
            out.append({"group": group, "name": f.stem, "path": rel(f)})
    return out


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
        "sections": [{"name": n, "desc": d, "roles": r} for n, d, r in SECTIONS],
        "social": build_social(),
        "design_system": build_design_system(),
        "icons": build_icons(),
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
