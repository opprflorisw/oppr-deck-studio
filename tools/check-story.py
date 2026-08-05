#!/usr/bin/env python
"""
Does this deck still tell a whole story? (Deck Studio 3, SPEC §6)

ADVISORY. This tool **never blocks and always exits 0**, even when it has plenty
to say. That is the rule, not a default.

`tools/verifylib.py` is the gate: mechanical, deterministic, and able to fail a
deck (em dashes, unfilled placeholders, image entitlement, page geometry, footer
discipline). This is a judgement about narrative, and narrative rules are
suggestions (SPEC §2). Keeping the two in one tool would make a judgement look
like a rule, and would put a model in the path of every build.

    python tools/check-story.py decks/<slug>
    python tools/check-story.py decks/<slug> --json

Needs ANTHROPIC_API_KEY in .env. Without one it says so in a line and exits 0, so
a fresh clone with no key still builds decks.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL = "claude-sonnet-5"
API = "https://api.anthropic.com/v1/messages"

SCHEMA = """Return ONLY a JSON object:
{"findings":[{"slide_id":"<id or null>","kind":"<one of: duplicate, contradiction,
unpaid-promise, missing-chapter, missing-companion, ordering>","note":"<one sentence>"}]}
An empty findings list is a valid and common answer. Do not invent problems."""


def _load_env() -> None:
    env = REPO_ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def slide_text(html: str) -> list[tuple[str, str]]:
    """(slide_id, visible text) per page, from the assembled document."""
    out = []
    for m in re.finditer(r'<section[^>]*data-slide-id="([^"]+)"[^>]*>(.*?)</section>',
                         html, re.S):
        body = re.sub(r"<(script|style)\b.*?</\1>", " ", m.group(2), flags=re.S)
        body = re.sub(r'<footer class="slide-foot".*?</footer>', " ", body, flags=re.S)
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip()
        out.append((m.group(1), text))
    return out


def suggestion_for(deck_type: str) -> dict:
    p = REPO_ROOT / "types" / deck_type / "recipe.md"
    if not p.exists():
        return {}
    fm = re.match(r"^---\n(.*?)\n---\n", p.read_text(encoding="utf-8"), re.S)
    return (yaml.safe_load(fm.group(1)) or {}) if fm else {}


def intent_index(ids: set[str]) -> dict:
    out = {}
    for sid in sorted(ids):
        meta = REPO_ROOT / "library" / "slides" / sid / "meta.yaml"
        if meta.exists():
            d = yaml.safe_load(meta.read_text(encoding="utf-8")) or {}
            out[sid] = {k: d[k] for k in ("goal", "why", "with", "chapter") if k in d}
    return out


def ask(prompt: str, key: str) -> dict:
    body = json.dumps({
        "model": MODEL, "max_tokens": 2000,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(API, data=body, headers={
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    text = "".join(b.get("text", "") for b in data.get("content", []))
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0)) if m else {"findings": []}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("deckdir")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    deckdir = Path(args.deckdir).resolve()
    index = deckdir / "index.html"
    if not index.exists():
        print(f"story check: no index.html in {deckdir}, assemble first. Skipped.")
        return 0                                   # advisory: never fails a build

    _load_env()
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        print("story check: skipped, no ANTHROPIC_API_KEY in .env.")
        return 0

    deck = yaml.safe_load((deckdir / "deck.yaml").read_text(encoding="utf-8"))
    pages = slide_text(index.read_text(encoding="utf-8"))
    sug = suggestion_for(deck.get("type", ""))
    intents = intent_index({sid for sid, _ in pages})

    prompt = f"""You are reviewing a sales deck for narrative coherence, not for style.

DECK TYPE: {deck.get('type', '')}
CHAPTERS CHOSEN: {json.dumps(deck.get('chapters', {}), ensure_ascii=False)}
CHAPTERS THIS TYPE USUALLY INCLUDES: {json.dumps(sug.get('picks', {}), ensure_ascii=False)}
CHAPTERS SKIPPED: {json.dumps(sug.get('skips', []), ensure_ascii=False)}

WHAT EACH SLIDE IS FOR (goal / why / companions):
{json.dumps(intents, ensure_ascii=False, indent=1)}

THE DECK, in order:
{json.dumps([{'slide_id': s, 'text': t[:1400]} for s, t in pages], ensure_ascii=False, indent=1)}

Report only things that would actually hurt this deck in front of a reader:
1. two slides making the same point, or contradicting each other
2. a promise set up and never paid off
3. a chapter skipped that this deck type usually includes, where its absence shows
4. a slide whose companions are missing in a way that leaves it stranded
5. ordering that breaks the argument

Skipping a chapter is a legitimate choice, so only mention it when the deck reads
worse for it. Be specific and terse. {SCHEMA}"""

    try:
        result = ask(prompt, key)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError) as e:
        print(f"story check: could not run ({e.__class__.__name__}). Skipped.")
        return 0                                   # advisory: never fails a build

    findings = result.get("findings", [])
    if args.json:
        print(json.dumps({"deck": deckdir.name, "findings": findings},
                         ensure_ascii=False, indent=1))
        return 0

    name = deck.get("title", deckdir.name)
    if not findings:
        print(f"story check [{name}]: nothing to raise. {len(pages)} pages read.")
        return 0
    print(f"story check [{name}]: {len(findings)} thing(s) to consider. "
          f"Advice, not a gate: nothing here blocks a build.")
    for f in findings:
        where = f.get("slide_id") or "the deck"
        print(f"  {f.get('kind', '?'):<18} {where:<24} {f.get('note', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
