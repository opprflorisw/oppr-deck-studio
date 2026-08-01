#!/usr/bin/env python
"""
Fail when the documentation describes something that is not there
(Deck Studio 2.0, the anti-drift gate).

Deck Studio drifted because rules were restated in several files and nothing
noticed when one of them stopped being true: CLAUDE.md still described
`decks/canonical/<type>/` as the master after masters had become a backend tag,
and still pointed at `tools/migrate-decks.py` after the migration was done.

This is the cheap mechanical half of the fix. It cannot tell that a sentence is
wrong, but it CAN tell that a path, tool or command named in the docs does not
exist — which is how most drift shows up.

    python tools/check-docs.py            # report
    python tools/check-docs.py --check    # exit 1 on any problem (CI / hooks)

Precedent: tools/research-brain.py --check.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

DOCS = [
    "CLAUDE.md", "decks/CLAUDE.md", "social/CLAUDE.md", "library/CLAUDE.md",
    "types/CLAUDE.md", "dump/CLAUDE.md", "knowledge/CLAUDE.md",
    "research/CLAUDE.md", "app/README.md", ".scratch/README.md",
]

# A path mentioned in backticks that looks like a repo path. Placeholders in
# angle brackets (`decks/<slug>/`) are patterns, not paths, and are skipped.
PATH_RE = re.compile(r"`([A-Za-z0-9_.][A-Za-z0-9_./-]*\.(?:py|ps1|mjs|js|css|json|yaml|md|html))`")
TOOL_RE = re.compile(r"\b(?:python|py -3)\s+(tools[\\/][A-Za-z0-9_.-]+\.py)")
PS_RE = re.compile(r"\.[\\/](tools[\\/][A-Za-z0-9_.-]+\.ps1)")
CMD_RE = re.compile(r"`(/[a-z][a-z0-9-]*)`")

KNOWN_COMMANDS = {"/deckbuilder", "/new-deck", "/edit-canonical", "/ingest-dump",
                  "/last30days", "/wayfinder", "/goal", "/grill-me", "/prototype"}


def check() -> list[str]:
    problems: list[str] = []
    for rel in DOCS:
        doc = REPO_ROOT / rel
        if not doc.exists():
            problems.append(f"{rel}: documented file set lists it, but it does not exist")
            continue
        text = doc.read_text(encoding="utf-8")

        seen: set[str] = set()
        for rx in (PATH_RE, TOOL_RE, PS_RE):
            for m in rx.finditer(text):
                ref = m.group(1).replace("\\", "/")
                if ref in seen or "<" in ref or "*" in ref:
                    continue
                seen.add(ref)
                # A bare filename (`meta.yaml`, `slide.html`) names a file shape
                # inside some folder, not a path from the repo root. Only
                # something with a directory component is a claim about where a
                # file actually is, and only that can be checked.
                if "/" not in ref:
                    continue
                # A path may be written relative to the doc's own folder, to the
                # repo root, or to a subfolder the doc is drawing a tree of
                # (research/CLAUDE.md sketches `posts/...` meaning
                # `last30days/posts/...`). Any of those resolving is enough.
                if (doc.parent / ref).exists() or (REPO_ROOT / ref).exists():
                    continue
                if any((child / ref).exists() for child in doc.parent.iterdir() if child.is_dir()):
                    continue
                problems.append(f"{rel}: refers to `{ref}`, which does not exist")

        for m in CMD_RE.finditer(text):
            cmd = m.group(1)
            if cmd in KNOWN_COMMANDS:
                if cmd in {"/deckbuilder", "/new-deck", "/edit-canonical", "/ingest-dump"}:
                    if not (REPO_ROOT / ".claude" / "commands" / f"{cmd[1:]}.md").exists():
                        problems.append(f"{rel}: documents `{cmd}`, but its command file is gone")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 when anything is stale")
    args = ap.parse_args()

    problems = check()
    if not problems:
        print(f"docs OK: {len(DOCS)} files, every referenced path exists.")
        return 0
    print(f"{len(problems)} documentation problem(s):")
    for p in problems:
        print(f"  {p}")
    return 1 if args.check else 0


if __name__ == "__main__":
    raise SystemExit(main())
