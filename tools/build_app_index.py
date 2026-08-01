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
import re
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
    """Built social outputs. v3: these live in the backend (social_outputs table +
    Storage), so read them from there in the same shape the app expects; the
    agent's /repo fallback serves the files. Falls back to a local scan if the
    backend is unreachable or empty (e.g. a fresh dev with files still on disk)."""
    try:
        from supa import Supa
        rows = Supa().select("social_outputs", {"select": "*", "order": "slug.desc"})
        if rows:
            return [{
                "channel": r["channel"], "slug": r["slug"], "path": r["path"],
                "kind": r["kind"], "category": r.get("category") or r["kind"],
                "index": r.get("idx_path"), "pdf": r.get("pdf_path"),
                "image": r.get("image_path"), "post": r.get("post_path"),
                "article": r.get("article_path"),
            } for r in rows]
    except Exception:
        pass
    return _build_social_local()


def _build_social_local() -> list[dict]:
    """Scan social/<channel>/<date>_<slug>/ for built outputs (legacy/offline)."""
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
            pdfs = sorted(d.glob("*.pdf"))
            # A single social image ships as a PNG instead of a PDF. Only the
            # built artifact counts, and it is the one carrying 'oppr' in its
            # name (the naming rule), so a stray screenshot in the folder is
            # never offered as the download.
            pngs = [p for p in sorted(d.glob("*.png")) if "oppr" in p.name]
            post = d / "post.txt"
            article = d / "article.md"
            if not (index.exists() or pdfs or pngs or post.exists() or article.exists()):
                continue
            if index.exists() and pdfs:
                kind = "carousel"
            elif index.exists() and pngs:
                kind = "image"
            elif article.exists():
                kind = "article"
            else:
                kind = "post"
            # `kind` is the artifact shape (what file ships). `category` is what the
            # piece IS editorially, which the shape cannot always tell you: a hiring
            # announcement and a quote card are both a PNG. An output declares its
            # own category in an optional meta.yaml; otherwise it falls back to the
            # shape, so nothing has to be back-filled.
            category = (_yaml(d / "meta.yaml").get("category") or kind).strip()
            out.append({
                "channel": channel.name,
                "slug": d.name,
                "path": rel(d),
                "kind": kind,
                "category": category,
                "index": rel(index) if index.exists() else None,
                "pdf": rel(pdfs[0]) if pdfs else None,
                "image": rel(pngs[0]) if pngs else None,
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
    # Deck Studio v3: decks and customers now live in the backend (Supabase) and
    # are served by the agent, not baked into this index. This index is only the
    # git-versioned TOOL surfaces: slides, images, social outputs, icons, the
    # design system, and recipes. The legacy deck/customer scanners were deleted
    # in Deck Studio 2.0: they read decks/canonical + decks/variants, which are
    # build scratch that gets removed after publishing.
    return {
        "slides": build_slides(),
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
        print(f"Wrote {rel(out)}: {len(index['slides'])} slides, "
              f"{len(index['images'])} images, {len(index['social'])} social outputs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
