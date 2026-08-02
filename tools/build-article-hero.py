#!/usr/bin/env python3
"""Write the 1200x627 hero page for a LinkedIn article draft.

A LinkedIn *article* shows one wide banner above its headline. This writes that
banner as HTML against the real `templates/linkedin.css` (`.carousel--hero`), so
the hero can never drift from the brand system. Render it to PNG with:

    .\\tools\\build-social-image.ps1 -Image social\\drafts\\<slug>\\hero -Width 1200 -Height 627

The hero carries the claim and nothing else. Body copy on a banner is unreadable
at feed size, so the tool refuses a claim long enough to wrap past three lines.

Usage:
    python tools/build-article-hero.py --draft social/drafts/2026-07-29-my-article
    python tools/build-article-hero.py --claim "..." --kicker "..." --out some/dir
"""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# A banner is read at thumbnail size in a scroll. Past this the claim stops being
# a claim and starts being a sentence, so it is a hard stop rather than a warning.
MAX_CLAIM_CHARS = 95
MAX_KICKER_CHARS = 46
MAX_STAT_LABEL_CHARS = 40


def hero_html(kicker: str, claim: str, stat_n: str, stat_l: str, css_rel: str) -> str:
    e = html.escape
    stat = ""
    if stat_n:
        stat = (
            '\n      <div class="lhero-stat">'
            f'\n        <span class="n">{e(stat_n)}</span>'
            + (f'\n        <span class="l">{e(stat_l)}</span>' if stat_l else "")
            + "\n      </div>"
        )
    kick = f'\n    <p class="lkicker">{e(kicker)}</p>' if kicker else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{e(claim)}</title>
<link rel="stylesheet" href="{css_rel}">
</head>
<body>
<div class="carousel carousel--hero">
  <section class="lpage">
    <span class="wm">oppr<b>.</b></span>{kick}
    <div class="lhero-row">
      <h1>{e(claim)}</h1>{stat}
    </div>
  </section>
</div>
</body>
</html>
"""


def rel_to_templates(out_dir: Path) -> str:
    """Relative href from the hero folder up to templates/linkedin.css."""
    depth = len(out_dir.resolve().relative_to(REPO).parts)
    return "../" * depth + "templates/linkedin.css"


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the 1200x627 LinkedIn article hero page.")
    ap.add_argument("--draft", help="social/drafts/<slug> folder holding draft.json with a `hero` block")
    ap.add_argument("--claim", default="")
    ap.add_argument("--kicker", default="")
    ap.add_argument("--stat-n", default="", help="the single number, e.g. 24%%")
    ap.add_argument("--stat-l", default="", help="what the number means")
    ap.add_argument("--out", help="output folder (default: <draft>/hero)")
    args = ap.parse_args()

    kicker, claim, stat_n, stat_l = args.kicker, args.claim, args.stat_n, args.stat_l
    out_dir = Path(args.out).resolve() if args.out else None

    if args.draft:
        d = (REPO / args.draft).resolve()
        draft_file = d / "draft.json"
        if not draft_file.is_file():
            print(f"FAIL no draft.json in {args.draft}", file=sys.stderr)
            return 1
        data = json.loads(draft_file.read_text(encoding="utf-8"))
        hero = data.get("hero") or {}
        claim = claim or hero.get("claim") or data.get("title") or ""
        kicker = kicker or hero.get("kicker", "")
        stat_n = stat_n or hero.get("stat_n", "")
        stat_l = stat_l or hero.get("stat_l", "")
        out_dir = out_dir or (d / "hero")

    if not claim:
        print("FAIL a hero needs a --claim (or a draft with hero.claim / title)", file=sys.stderr)
        return 1
    if not out_dir:
        print("FAIL need --out or --draft", file=sys.stderr)
        return 1

    problems = []
    if len(claim) > MAX_CLAIM_CHARS:
        problems.append(f"claim is {len(claim)} chars, max {MAX_CLAIM_CHARS} (a banner is a claim, not a sentence)")
    if len(kicker) > MAX_KICKER_CHARS:
        problems.append(f"kicker is {len(kicker)} chars, max {MAX_KICKER_CHARS}")
    if len(stat_l) > MAX_STAT_LABEL_CHARS:
        problems.append(f"stat label is {len(stat_l)} chars, max {MAX_STAT_LABEL_CHARS}")
    for field, val in (("claim", claim), ("kicker", kicker), ("stat label", stat_l)):
        if "—" in val or "–" in val:
            problems.append(f"{field} contains an em/en dash (brand rule: use ' - ')")
        # A mojibake glyph renders as a black diamond in the banner and is easy to
        # miss in JSON but impossible to miss in the feed. Fail loudly instead.
        if "�" in val:
            problems.append(f"{field} contains a replacement character (encoding got mangled upstream)")
    if problems:
        for p in problems:
            print("FAIL " + p, file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "index.html"
    target.write_text(hero_html(kicker, claim, stat_n, stat_l, rel_to_templates(out_dir)), encoding="utf-8")

    rel = target.relative_to(REPO).as_posix()
    print(f"Hero written: {rel}")
    print(f"Render it:    .\\tools\\build-social-image.ps1 -Image {out_dir.relative_to(REPO)} -Width 1200 -Height 627")
    return 0


if __name__ == "__main__":
    sys.exit(main())
