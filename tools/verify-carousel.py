#!/usr/bin/env python3
# FROZEN 2026-08-19 (Deck Studio 5). This file is part of the OLD pipeline. The
# pipeline is app/lib; tools/studio.mjs is the command line over it. Do not add a
# rule, a fix or a feature here -- it will not run. `DECK_PY_BUILD=1` still routes
# a build through this path as a way back, and the flag and these files go
# together. See .scratch/deck-studio-5/GUIDE.md.

"""Automated gate for a LinkedIn carousel, per the playbook in
`knowledge/best-practices/linkedin-carousel.md` (section A7).

  python tools\\verify-carousel.py social\\linkedin\\<date>_<slug>
  python tools\\verify-carousel.py --all

FAIL blocks publication. WARN is a judgement call for the human.

The two checks a script cannot make (the blame audit and whether a number is
defensible) stay in the review panel in each carousel's brief.md.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

WORD_CEILING = 25          # body words per page
POST_RATIO = 1 / 3         # post text vs carousel word count
DOC_MAX_MB = 5

# Customer-identifier shapes we must never publish: log ids like VEG-OPS-LOG-006,
# asset tags like TRZ-12-381, and site/line labels.
ID_PATTERNS = [
    re.compile(r"\b[A-Z]{2,4}-OPS-LOG-\d+\b"),
    re.compile(r"\b[A-Z]{2,4}-\d{2}-\d{3}\b"),
]

TAG = re.compile(r"<[^>]+>")


def text_of(html_fragment: str) -> str:
    return re.sub(r"\s+", " ", TAG.sub(" ", html_fragment)).strip()


def words(s: str) -> int:
    return len([w for w in s.split() if any(c.isalnum() for c in w)])


class Report:
    def __init__(self, name: str):
        self.name = name
        self.fails: list[str] = []
        self.warns: list[str] = []

    def fail(self, m: str):
        self.fails.append(m)

    def warn(self, m: str):
        self.warns.append(m)

    def show(self) -> bool:
        print(f"\n=== {self.name} ===")
        for m in self.fails:
            print(f"  FAIL {m}")
        for m in self.warns:
            print(f"  WARN {m}")
        if not self.fails and not self.warns:
            print("  OK   all checks pass")
        elif not self.fails:
            print(f"  OK   no failures ({len(self.warns)} warning(s))")
        return not self.fails


def verify(d: Path, manifest: dict) -> bool:
    r = Report(d.name)
    html_file = d / "index.html"
    if not html_file.exists():
        r.fail("no index.html")
        return r.show()
    html = html_file.read_text(encoding="utf-8")

    # --- authored text hygiene -------------------------------------------------
    for f in sorted(d.iterdir()):
        if f.suffix in (".html", ".txt", ".md"):
            t = f.read_text(encoding="utf-8")
            if "—" in t:
                r.fail(f"em dash in {f.name}")
            if re.search(r"\{\{.*?\}\}", t):
                r.fail(f"unfilled placeholder in {f.name}")
            for pat in ID_PATTERNS:
                for hit in set(pat.findall(t)):
                    r.fail(f"customer identifier '{hit}' in {f.name}")

    # --- pages -----------------------------------------------------------------
    pages = re.findall(r'<section class="lpage(.*?)</section>', html, re.S)
    if not pages:
        r.fail("no .lpage sections found")
        return r.show()

    for i, page in enumerate(pages, 1):
        is_cover = i == 1
        is_cta = "lpage--cta" in page[:120]
        # .loop on every content page (not the cover, not the CTA)
        if not (is_cover or is_cta) and 'class="loop"' not in page:
            r.fail(f"page {i:02d} has no .loop line (every content page must earn the swipe)")
        # word ceiling per body block
        # `<p(?=[\s>])` so the <path> elements of inline SVG icons are not read as body copy
        for body in re.findall(
                r"<p(?=[\s>])(?![^>]*class=\"(?:eyebrow|kicker|loop|lead)\")[^>]*>(.*?)</p>", page, re.S):
            n = words(text_of(body))
            if n > WORD_CEILING:
                r.warn(f"page {i:02d} body block is {n} words (ceiling {WORD_CEILING}): "
                       f"\"{text_of(body)[:60]}...\"")

    cover = text_of(pages[0]).lower()
    for bad in ("part 1 of", "part 2 of", "part 3 of", "slides on", "pages on"):
        if bad in cover:
            r.fail(f"cover carries logistics/series text ('{bad}'); the cover earns one swipe only")

    # reassurance chips immediately before the CTA page
    cta_idx = next((i for i, p in enumerate(pages) if "lpage--cta" in p[:120]), None)
    if cta_idx is None:
        r.warn("no .lpage--cta closing page")
    elif cta_idx == 0:
        r.fail("CTA cannot be the first page")
    elif "lchips" in html and "lchips" not in pages[cta_idx - 1]:
        # only meaningful for a carousel that reassures at all; a Mirror has no offer to de-risk
        r.warn("reassurance chips exist but not on the page immediately before the CTA")

    # forwardable carousels: contact strip and a forward ask
    if "lcontact" in html:
        ask = text_of(pages[cta_idx] if cta_idx is not None else "").lower()
        if not any(k in ask for k in ("send it", "forward", "pass it", "send this")):
            r.warn("carousel has a contact strip (built to travel) but the ask is not a forward")

    # --- images ----------------------------------------------------------------
    imgs = re.findall(r"<img\s[^>]*>", html)
    for tag in imgs:
        if 'alt="' not in tag:
            r.fail(f"img without alt: {tag[:70]}")
    for src in re.findall(r'<img[^>]*src="([^"]+)"', html):
        p = (d / src).resolve()
        if not p.exists():
            r.fail(f"missing image {src}")
            continue
        try:
            key = p.relative_to((ROOT / "brand" / "img").resolve()).as_posix()
        except ValueError:
            r.fail(f"image outside brand/img/: {src}")
            continue
        entry = manifest.get(key)
        if entry is None:
            r.fail(f"{key} is not in brand/img/library.json")
        elif entry.get("entitlement") != "public":
            r.fail(f"{key} entitlement is '{entry.get('entitlement')}'; social must be public")

    # --- post text -------------------------------------------------------------
    post = d / "post.txt"
    if not post.exists():
        r.fail("no post.txt")
    else:
        pw, cw = words(post.read_text(encoding="utf-8")), words(text_of(html))
        if cw and pw > cw * POST_RATIO:
            r.warn(f"post is {pw} words vs {cw} in the carousel "
                   f"(over the 1/3 ceiling; a post that tells all of it kills the swipe)")

    # --- the PDF ---------------------------------------------------------------
    pdfs = list(d.glob("*.pdf"))
    if not pdfs:
        r.fail("no built PDF")
    else:
        pdf = pdfs[0]
        if "oppr" not in pdf.name:
            r.fail(f"PDF name does not carry 'oppr': {pdf.name}")
        mb = pdf.stat().st_size / 1024 / 1024
        if mb > DOC_MAX_MB:
            r.warn(f"PDF is {mb:.1f} MB, over the {DOC_MAX_MB} MB guideline")
        try:
            import fitz
            doc = fitz.open(pdf)
            if doc.page_count != len(pages):
                r.fail(f"PDF has {doc.page_count} pages, HTML has {len(pages)}")
            sizes = {(round(p.rect.width), round(p.rect.height)) for p in doc}
            if len(sizes) > 1:
                r.fail(f"page size is not uniform: {sizes}")
        except ImportError:
            r.warn("PyMuPDF not installed, skipped PDF page checks")

    return r.show()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("carousel", nargs="*", help="path to social/<channel>/<date>_<slug>")
    ap.add_argument("--all", action="store_true", help="verify every carousel under social/linkedin/")
    args = ap.parse_args()

    targets = [ROOT / c for c in args.carousel]
    if args.all or not targets:
        targets = sorted(p for p in (ROOT / "social" / "linkedin").iterdir()
                         if p.is_dir() and (p / "index.html").exists())

    manifest = {i["file"]: i for i in
                json.loads((ROOT / "brand" / "img" / "library.json").read_text(encoding="utf-8"))["images"]}

    # Build the list first: `all(generator)` short-circuits on the first failure,
    # so one bad carousel silently skipped every carousel after it under --all.
    ok = all([verify(t, manifest) for t in targets])
    print(f"\n{'PASS' if ok else 'FAIL'}: {len(targets)} carousel(s) checked")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
