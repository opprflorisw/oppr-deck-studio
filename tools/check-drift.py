#!/usr/bin/env python
"""
Which published decks are behind their library slides? (Deck Studio 3, SPEC §3)

This is the question the whole chapter/propagation effort exists to answer. Before
this, asking it meant downloading every version's HTML and regex-parsing it.

Drift is a **content-hash comparison**: `deck_versions.recipe` records the hash of
each library slide as it was at publish time, so a deck is behind when the slide on
disk hashes differently now. No library version numbers anywhere.

    python tools/check-drift.py                 # every deck, summarised
    python tools/check-drift.py --slide cover   # who uses this slide, and who is behind
    python tools/check-drift.py --json          # machine-readable, for the app

WHAT A FLAG MEANS, and this is load-bearing: it means *the next version of this
deck would differ*. Nothing here mutates anything. A deck already sent to a
customer stays byte-identical, and its PDF stays valid, until someone accepts.
"""
from __future__ import annotations

import argparse
from datetime import date
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import snapshot as snap  # noqa: E402
from supa import Supa  # noqa: E402


def current_hashes() -> dict[str, str]:
    """Hash every library slide as it stands now."""
    import deckstudio as ds

    out = {}
    for d in sorted(ds.SLIDES_DIR.iterdir()):
        if d.is_dir() and (d / "slide.html").exists():
            out[d.name] = snap.slide_hash(d.name)
    return out


def scan(sb: Supa) -> list[dict]:
    live = current_hashes()
    decks = sb.select("decks", {"select": "id,slug,title,kind,current_version_n,is_master"})
    by_id = {d["id"]: d for d in decks}
    versions = sb.select("deck_versions", {"select": "deck_id,n,recipe"})

    rows = []
    for v in versions:
        deck = by_id.get(v["deck_id"])
        if not deck or v["n"] != deck["current_version_n"]:
            continue                      # only the current version of each deck
        recipe = v.get("recipe")
        if not recipe:
            continue                      # pre-model, or social: no parentage to check
        behind = []
        for chapter in recipe.get("chapters", []):
            for s in chapter.get("slides", []):
                sid, was = s["slide_id"], s.get("content_hash", "")
                now = live.get(sid)
                if now is None:
                    behind.append({"slide_id": sid, "chapter": chapter.get("id"),
                                   "reason": "slide no longer in the library"})
                elif was and now != was:
                    behind.append({"slide_id": sid, "chapter": chapter.get("id"),
                                   "reason": "content changed"})
        rows.append({"slug": deck["slug"], "title": deck["title"], "kind": deck["kind"],
                     "is_master": deck["is_master"], "version": v["n"], "behind": behind})
    rows.sort(key=lambda r: (-len(r["behind"]), r["slug"]))
    return rows


def required_entitlements(slide_dir: Path, img_ent: dict[str, str], meta: dict) -> list[str]:
    """Which clearances this slide needs before a deck may carry it.

    The gate verify actually applies is per IMAGE against the deck's
    `allowed_entitlements`, so the honest answer is the set of entitlements the
    slide's images carry, not the one label in meta.yaml. A slide may name images
    from more than one customer, and every one of them has to be cleared.

    Empty list = safe in a public deck. This is what lets the builder grey a
    slide out while you are picking instead of failing a build 40 seconds later.
    """
    import re

    html = (slide_dir / "slide.html").read_text(encoding="utf-8")
    need = {e for e in [meta.get("entitlement", "public")] if e and e != "public"}
    # The SAME manifest key verifylib._check_images derives, so the picker and
    # the gate can never disagree about what a slide needs.
    for src in re.findall(r'<img[^>]+src="([^"]+)"', html):
        norm = src.replace("\\", "/")
        if "brand/img/" not in norm:
            continue
        ent = img_ent.get(norm.split("brand/img/", 1)[1], "public")
        if ent and ent != "public":
            need.add(ent)
    return sorted(need)


def sync_library(sb: Supa) -> int:
    """Mirror library/slides/ into public.library_slides.

    The hosted app has no repo on disk, so it cannot hash the library itself.
    This is what lets the drift flag work on Vercel as well as locally; the repo
    stays the source of truth and this table is a derived mirror.
    """
    import yaml

    import deckstudio as ds

    manifest = json.loads(
        (ds.REPO_ROOT / "brand" / "img" / "library.json").read_text(encoding="utf-8"))
    img_ent = {m["file"]: m.get("entitlement", "public") for m in manifest.get("images", [])}

    rows = []
    for d in sorted(ds.SLIDES_DIR.iterdir()):
        meta = d / "meta.yaml"
        if not d.is_dir() or not meta.exists():
            continue
        m = yaml.safe_load(meta.read_text(encoding="utf-8")) or {}
        rows.append({
            "slide_id": d.name,
            "content_hash": snap.slide_hash(d.name),
            "chapter": m.get("chapter"),
            "role": m.get("role", ""),
            "title": m.get("title", ""),
            "retired": bool(m.get("retired")),
            "goal": m.get("goal"),
            "entitlements": required_entitlements(d, img_ent, m),
        })
    # Only the repo-owned columns are written. `archived` belongs to the app
    # (someone demoted the slide in the picker), so a sync must never silently
    # un-archive it. Use --apply-archives to make an archive durable in git.
    sb.upsert("library_slides", rows, on_conflict="slide_id")

    # The chapter set too, so the picker never has to parse YAML server-side and
    # works hosted. library/chapters.yaml stays the source of truth.
    chapters = yaml.safe_load(
        (ds.REPO_ROOT / "library" / "chapters.yaml").read_text(encoding="utf-8")) or []
    sb.upsert("library_chapters", [
        {"id": c["id"], "n": str(c.get("n", "")), "title": c["title"],
         "purpose": c.get("purpose", ""), "slides": c.get("slides", [])}
        for c in chapters], on_conflict="id")

    live = sum(1 for r in rows if not r["retired"])
    arch = sb.select("library_slides", {"select": "slide_id", "archived": "eq.true"})
    print(f"synced {len(rows)} slides ({live} live, {len(rows) - live} retired) and "
          f"{len(chapters)} chapters; {len(arch)} archived in the app, left untouched")
    return 0


def apply_archives(sb: Supa) -> int:
    """Write app-set archives back into meta.yaml as `retired: true`.

    The app cannot write library/ (CLAUDE.md), so archiving lives in the backend.
    This is the deliberate promotion step that makes it permanent and puts it
    under git, which is where the durable record belongs.
    """
    import yaml

    import deckstudio as ds

    rows = sb.select("library_slides", {"select": "slide_id,archive_note", "archived": "eq.true"})
    if not rows:
        print("nothing archived in the app; nothing to promote.")
        return 0
    n = 0
    for r in rows:
        meta = ds.SLIDES_DIR / r["slide_id"] / "meta.yaml"
        if not meta.exists():
            print(f"  skip {r['slide_id']}: no meta.yaml")
            continue
        d = yaml.safe_load(meta.read_text(encoding="utf-8")) or {}
        if d.get("retired"):
            continue
        d["retired"] = True
        d["retired_on"] = date.today().isoformat()
        if r.get("archive_note"):
            d["retired_note"] = r["archive_note"]
        meta.write_text(yaml.safe_dump(d, sort_keys=False, allow_unicode=True), encoding="utf-8")
        print(f"  retired {r['slide_id']} in meta.yaml")
        n += 1
    print(f"{n} archive(s) promoted to the repo. Remove them from "
          f"library/chapters.yaml, then commit.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slide", help="only decks using this library slide")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--sync", action="store_true",
                    help="mirror the library into the backend so the hosted app can read it")
    ap.add_argument("--apply-archives", action="store_true",
                    help="write app-set archives back into meta.yaml as retired: true")
    args = ap.parse_args()

    sb = Supa()
    if args.sync:
        return sync_library(sb)
    if args.apply_archives:
        return apply_archives(sb)

    rows = scan(sb)
    if args.slide:
        rows = [r for r in rows
                if any(s["slide_id"] == args.slide for c in [r] for s in r["behind"])
                or args.slide in _slides_of(r)]

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
        return 0

    flagged = [r for r in rows if r["behind"]]
    if not rows:
        print("No deck carries a recipe yet, so nothing can be compared.")
        print("Recipes are written from the first publish on the new model (SPEC §8).")
        return 0
    for r in rows:
        mark = f"{len(r['behind'])} page(s) behind" if r["behind"] else "current"
        star = "*" if r["is_master"] else " "
        print(f"{star} {r['slug']:<34} v{r['version']:<3} {mark}")
        for b in r["behind"]:
            print(f"      {b['slide_id']:<24} {b['reason']}")
    print()
    print(f"{len(flagged)} of {len(rows)} deck(s) with a recipe are behind.")
    print("A flag means the NEXT version would differ. Nothing published has changed.")
    return 0


def _slides_of(row: dict) -> set[str]:
    return {b["slide_id"] for b in row["behind"]}


if __name__ == "__main__":
    raise SystemExit(main())
