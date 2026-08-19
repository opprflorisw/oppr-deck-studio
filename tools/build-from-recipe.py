#!/usr/bin/env python
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""
Build and publish a deck from a recipe (Deck Studio 3).

This is the engine behind the app's deck builder. A recipe is chapters and
nothing else (SPEC §2): an ordered list of chapters, each with the slides picked
from it. Skipping a chapter drops every slide under it.

    python tools/build-from-recipe.py recipe.json
    python tools/build-from-recipe.py recipe.json --dry-run      # compose + verify only

The recipe JSON:

    {"slug": "…", "title": "…", "type": "management-outlook",
     "chapters": {"ch-open": ["cover"], "ch-idea": ["eng2-idea"], …},
     "vars": {"deck_footer": "…", "cover_meta": "…"},
     "allowed_entitlements": ["public"],
     "client": "", "customer": "",
     "version_of": "<slug>",        // rebuild an existing deck as a new version
     "derived_from": "<slug>",      // or record lineage for a new one
     "note": "why this version exists"}

The pipeline is exactly the CLI's, in the CLI's order, so a deck built here is
indistinguishable from one built by hand:

    compose -> assemble-deck -> build-pdf -> verify-deck -> publish-deck

**Verify still blocks.** Narrative rules are suggestions (SPEC §2), but
entitlement, unfilled placeholders, em dashes, footer discipline and page
geometry are not, and nothing here bypasses them. A deck that fails is not
published, and the failures come back to the caller.

STDOUT IS A STREAM, not one blob at the end. Each step emits a JSON line as it
starts and as it finishes:

    {"event": "step", "step": "verify", "state": "running", "detail": "…"}

and the LAST line is the full result object (no `event` key). The app polls a job
and shows those five steps arriving, because a 40-second wait behind a disabled
button tells you nothing about which gate you are standing at.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))


STEPS = ["compose", "assemble", "pdf", "verify", "publish"]


def emit(**kw) -> None:
    """One progress line, flushed. The caller reads these as they arrive."""
    print(json.dumps({"event": "step", **kw}, ensure_ascii=False), flush=True)


def _run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", **kw)


def cleanup(deckdir: Path) -> None:
    """Delete the build scratch once the artifact is safely in the backend.

    `decks/<slug>/` is scratch by definition (CLAUDE.md): the artifact lives in
    Supabase from the publish onwards. Only ever called on a PASS, so a failed
    build leaves its folder behind to be looked at.
    """
    import shutil

    try:
        if deckdir.is_dir() and deckdir.parent.name == "decks":
            shutil.rmtree(deckdir)
    except OSError:
        pass                                  # a leftover folder is not a failure


def compose(recipe: dict) -> Path:
    """Write decks/<slug>/deck.yaml from the recipe's chapter picks."""
    chapters_file = REPO_ROOT / "library" / "chapters.yaml"
    order = [c["id"] for c in yaml.safe_load(chapters_file.read_text(encoding="utf-8"))]
    picks = recipe.get("chapters") or {}

    unknown = [c for c in picks if c not in order]
    if unknown:
        raise SystemExit(f"ERROR: unknown chapter(s): {', '.join(unknown)}")

    # Chapter order SEEDS the deck; it does not constrain it. An explicit
    # `order` is the deck as it will actually read, so the argument can be
    # arranged however it presents best. Anything picked but missing from
    # `order` is appended in chapter order rather than silently dropped.
    seeded = [s for cid in order if cid in picks for s in picks[cid]]
    explicit = [s for s in (recipe.get("order") or []) if s in seeded]
    slides = explicit + [s for s in seeded if s not in explicit]
    if not slides:
        raise SystemExit("ERROR: the recipe picks no slides")

    deckdir = REPO_ROOT / "decks" / recipe["slug"]
    deckdir.mkdir(parents=True, exist_ok=True)
    deck = {
        "title": recipe["title"],
        "type": recipe.get("type", ""),
        "chapters": {cid: picks[cid] for cid in order if cid in picks},
        "vars": recipe.get("vars") or {},
        "slides": slides,
    }
    if recipe.get("client"):
        deck["client"] = recipe["client"]
    if recipe.get("allowed_entitlements"):
        deck["allowed_entitlements"] = recipe["allowed_entitlements"]
    (deckdir / "deck.yaml").write_text(
        yaml.safe_dump(deck, sort_keys=False, allow_unicode=True), encoding="utf-8")
    return deckdir


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("recipe")
    ap.add_argument("--dry-run", action="store_true",
                    help="compose, assemble and verify, but do not publish")
    args = ap.parse_args()

    recipe = json.loads(Path(args.recipe).read_text(encoding="utf-8"))
    for key in ("slug", "title"):
        if not recipe.get(key):
            raise SystemExit(f"ERROR: recipe is missing '{key}'")

    result = {"slug": recipe["slug"], "steps": [], "ok": False}

    def step(name: str, ok: bool, detail: str = "", out: str = "", state: str = "") -> None:
        result["steps"].append({"step": name, "ok": ok, "detail": detail, "out": out})
        emit(step=name, state=state or ("ok" if ok else "fail"), detail=detail)

    def fail_out(name: str) -> int:
        print(json.dumps(result, ensure_ascii=False))
        return 1

    emit(step="compose", state="running")
    deckdir = compose(recipe)
    rel = deckdir.relative_to(REPO_ROOT).as_posix()
    deck_yaml = yaml.safe_load((deckdir / "deck.yaml").read_text(encoding="utf-8"))
    n_slides = len(deck_yaml["slides"])
    n_chapters = len(deck_yaml.get("chapters") or {})
    step("compose", True, f"{n_slides} slides across {n_chapters} chapters")

    emit(step="assemble", state="running")
    r = _run([sys.executable, "tools/assemble-deck.py", rel])
    ok = r.returncode == 0
    step("assemble", ok,
         f"footers filled, pages numbered 1 to {n_slides}" if ok else "could not assemble",
         (r.stdout + r.stderr).strip()[-1500:])
    if not ok:
        return fail_out("assemble")

    emit(step="pdf", state="running")
    r = _run(["powershell", "-NoProfile", "-File", "tools/build-pdf.ps1", "-Deck", rel])
    ok = r.returncode == 0
    step("pdf", ok, f"PDF, {n_slides} pages" if ok else "the print failed",
         (r.stdout + r.stderr).strip()[-1500:])
    if not ok:
        return fail_out("pdf")

    emit(step="verify", state="running")
    r = _run([sys.executable, "tools/verify-deck.py", rel])
    verify_out = (r.stdout + r.stderr).strip()
    ok = r.returncode == 0
    n_fail = verify_out.count("FAIL")
    n_warn = verify_out.count("WARN")
    step("verify", ok,
         (f"clean ({n_warn} warning{'' if n_warn == 1 else 's'})" if ok
          else f"{n_fail} failure{'' if n_fail == 1 else 's'}; nothing published"),
         verify_out[-4000:])
    if not ok:
        # Verify blocks. Entitlement and the brand rules are not suggestions.
        return fail_out("verify")

    if args.dry_run:
        result["ok"] = True
        step("publish", True, "skipped: this was a check", state="skip")
        cleanup(deckdir)
        print(json.dumps(result, ensure_ascii=False)); return 0

    emit(step="publish", state="running")
    cmd = [sys.executable, "tools/publish-deck.py", rel]
    if recipe.get("version_of"):
        cmd += ["--version-of", recipe["version_of"]]
    if recipe.get("derived_from"):
        cmd += ["--derived-from", recipe["derived_from"]]
    if recipe.get("customer"):
        cmd += ["--customer", recipe["customer"]]
    if recipe.get("client"):
        cmd += ["--client", recipe["client"]]
    if recipe.get("type"):
        cmd += ["--type", recipe["type"]]
    if recipe.get("note"):
        cmd += ["--note", recipe["note"]]
    r = _run(cmd)
    published = (r.stdout + r.stderr).strip()
    ok = r.returncode == 0
    step("publish", ok,
         "immutable version written" if ok else "the publish failed",
         published[-1500:])
    result["ok"] = ok

    # Where it landed. A deck you cannot reach is half a result, so hand back
    # enough for the caller to link straight to it.
    if result["ok"]:
        try:
            from supa import Supa
            sb = Supa()
            slug = recipe.get("version_of") or recipe["slug"]
            rows = sb.select("decks", {"slug": f"eq.{slug}",
                                       "select": "id,slug,title,current_version_n"})
            if rows:
                d = rows[0]
                v = sb.select("deck_versions", {
                    "deck_id": f"eq.{d['id']}", "n": f"eq.{d['current_version_n']}",
                    "select": "page_count"})
                result["deck"] = {"id": d["id"], "slug": d["slug"], "title": d["title"],
                                  "version": d["current_version_n"],
                                  "page_count": v[0]["page_count"] if v else 0}
        except Exception as e:                       # never fail a good build on this
            result["deck_lookup_error"] = str(e)
        cleanup(deckdir)

    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
