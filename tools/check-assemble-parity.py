#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Prove the two assemblers agree (Deck Studio cloud).

`tools/deckstudio.py` + `tools/snapshot.py` assemble a deck locally, where there
is Python. `app/lib/assemble.mjs` assembles the same deck in the cloud, where
there is not. Two implementations of one transform is how a hosted app and a
local app quietly stop behaving the same, so this is the guard: it builds the
SAME recipe through both and diffs the snapshot byte for byte.

    python tools/check-assemble-parity.py                # every published recipe
    python tools/check-assemble-parity.py --slug engagement
    python tools/check-assemble-parity.py --recipe path/to/recipe.json

Two fields are normalised before the diff and nothing else: `published` (today's
date) and `tool` (which assembler ran). Both are meant to differ.

Exit 0 when every recipe matches. This is the assembler's answer to
check-verify-parity.py, and the same rule applies: if you change the transform,
change it in both and run this.
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import snapshot as snap                                        # noqa: E402
from supa import Supa                                          # noqa: E402

NODE_DRIVER = r"""
import { composeSlides, buildSnapshot, chapterOrder } from "__APP__/lib/assemble.mjs";
import { RepoFiles } from "__APP__/lib/repofiles.mjs";
import fs from "node:fs";

const [recipePath, htmlOut, sideOut] = process.argv.slice(2);
const recipe = JSON.parse(fs.readFileSync(recipePath, "utf-8"));
const files = new RepoFiles();
const order = chapterOrder(await files.mustText("library/chapters.yaml", "chapters"));
const deck = composeSlides(recipe, order);
const { html, assets, recipe: built } = await buildSnapshot(deck, recipe.slug, { files });
fs.writeFileSync(htmlOut, html, "utf-8");
fs.writeFileSync(sideOut, JSON.stringify({
  assets: Object.fromEntries(Object.entries(assets).map(([fn, a]) =>
    [fn, { sha256: a.sha256, source: a.source, entitlement: a.entitlement, bytes: a.bytes.length }])),
  recipe: built,
}, null, 1), "utf-8");
"""

_NORMALISE = [
    (re.compile(r'"published": "[^"]*"'), '"published": "<date>"'),
    (re.compile(r'"tool": "[^"]*"'), '"tool": "<tool>"'),
]


def normalise(html: str) -> str:
    for rx, to in _NORMALISE:
        html = rx.sub(to, html)
    return html


def recipe_from_version(slug: str, rec: dict) -> dict:
    """A stored deck_versions.recipe (schema 2) back into a build recipe."""
    chapters = {}
    for block in rec.get("chapters") or []:
        cid = block.get("id")
        if cid is None:
            continue
        chapters[cid] = [s["slide_id"] for s in block.get("slides") or []]
    return {
        "slug": slug,
        "title": rec.get("_title") or slug,
        "type": rec.get("type", ""),
        "chapters": chapters,
        "order": rec.get("order") or [],
        "vars": rec.get("vars") or {},
        "allowed_entitlements": rec.get("allowed_entitlements") or ["public"],
        "client": rec.get("client", ""),
    }


def _compose_python(recipe: dict) -> Path:
    """decks/<slug>/deck.yaml from the recipe, exactly as build-from-recipe does."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "build_from_recipe", REPO_ROOT / "tools" / "build-from-recipe.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.compose(recipe)


def run_one(recipe: dict, via_storage: bool = False) -> list[str]:
    """Return a list of problems (empty when the two agree).

    `via_storage` runs the JS side with VERCEL set, which makes RepoFiles skip
    disk entirely and read every input out of Supabase Storage — the path that
    actually runs hosted. Matching there proves Storage carries the whole
    library, not just the parts the browser happened to ask for.
    """
    slug = recipe["slug"]
    problems: list[str] = []

    deckdir = _compose_python(recipe)
    py_html, py_assets, _deck = snap.build_snapshot(deckdir)

    app_url = (REPO_ROOT / "app").as_uri()          # file:// so the temp driver can import it
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        rp, hp, ap = td / "recipe.json", td / "js.html", td / "js.json"
        rp.write_text(json.dumps(recipe, ensure_ascii=False), encoding="utf-8")
        driver = td / "driver.mjs"
        driver.write_text(NODE_DRIVER.replace("__APP__", app_url), encoding="utf-8")
        env = dict(os.environ)
        if via_storage:
            env["VERCEL"] = "1"
        r = subprocess.run(
            ["node", str(driver), str(rp), str(hp), str(ap)],
            cwd=REPO_ROOT, env=env, capture_output=True, text=True,
            encoding="utf-8", errors="replace")
        if r.returncode != 0:
            shutil.rmtree(deckdir, ignore_errors=True)
            return [f"{slug}: the JS assembler failed\n{(r.stdout + r.stderr).strip()[-2000:]}"]
        js_html = hp.read_text(encoding="utf-8")
        js_side = json.loads(ap.read_text(encoding="utf-8"))

    shutil.rmtree(deckdir, ignore_errors=True)

    a, b = normalise(py_html), normalise(js_html)
    if a != b:
        diff = list(difflib.unified_diff(
            a.splitlines(), b.splitlines(), "python", "javascript", lineterm="", n=1))
        problems.append(f"{slug}: snapshot HTML differs\n" + "\n".join(diff[:60]))

    py_a = {fn: m["sha256"] for fn, m in py_assets.items()}
    js_a = {fn: m["sha256"] for fn, m in js_side["assets"].items()}
    if py_a != js_a:
        only_py = sorted(set(py_a) - set(js_a))
        only_js = sorted(set(js_a) - set(py_a))
        differ = sorted(fn for fn in set(py_a) & set(js_a) if py_a[fn] != js_a[fn])
        problems.append(
            f"{slug}: asset bundle differs — only in python: {only_py}; "
            f"only in js: {only_js}; different bytes: {differ}")

    return problems


def published_recipes(only: str = "") -> list[dict]:
    sb = Supa()
    decks = sb.select("decks", {"select": "id,slug,title,current_version_n,archived"})
    out = []
    for d in decks:
        if d.get("archived"):
            continue
        if only and d["slug"] != only:
            continue
        vs = sb.select("deck_versions", {
            "deck_id": f"eq.{d['id']}", "n": f"eq.{d['current_version_n']}", "select": "recipe"})
        rec = (vs[0] or {}).get("recipe") if vs else None
        if not rec or rec.get("schema") != 2:
            continue
        rec = dict(rec)
        rec["_title"] = d["title"]
        out.append(recipe_from_version(d["slug"] + "-parity", rec))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default="", help="only this deck's recipe")
    ap.add_argument("--recipe", default="", help="a recipe JSON file instead of the backend")
    ap.add_argument("--via-storage", action="store_true",
                    help="run the JS side as if hosted: every input read from Storage, not disk")
    args = ap.parse_args()

    if args.recipe:
        recipes = [json.loads(Path(args.recipe).read_text(encoding="utf-8"))]
    else:
        recipes = published_recipes(args.slug)

    if not recipes:
        print("no schema-2 recipes to compare (nothing published from a recipe yet)")
        return 0

    problems: list[str] = []
    for rec in recipes:
        found = run_one(rec, via_storage=args.via_storage)
        print(f"  {rec['slug']:<40} {'ok' if not found else 'DIFFERS'}")
        problems += found

    if problems:
        print("\n" + "\n\n".join(problems))
        print(f"\nassembler parity: {len(problems)} problem(s) across {len(recipes)} recipe(s)")
        return 1
    print(f"\nassembler parity ok: {len(recipes)} recipe(s), python and javascript agree")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
