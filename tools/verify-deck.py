#!/usr/bin/env python
"""
Verify an assembled deck against the Oppr quality gates (SPEC.md section 9,
codifying the manual checks in CLAUDE.md). Run after assembling + building PDF:

    python tools/verify-deck.py decks/canonical/product-showcase

HARD failures (exit 1): em dashes, unfilled {{variables}}, data-total mismatch,
PDF page-count mismatch or wrong page size, footer discipline, unresolved images,
and images whose entitlement exceeds the deck's clearance (customer-name leaks).
WARNINGS (exit 0): non-European number formats on euro amounts, near-blank pages.
The visual look-at-every-slide check stays human; this removes the mechanical part.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

import yaml

try:  # Windows consoles default to cp1252; deck text is UTF-8
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
import deckstudio as ds

PAGE_W_IN, PAGE_H_IN = 13.333, 7.5
NO_FOOTER_ROLES = {"cover", "closer", "cta"}

# Customer names distinctive enough to text-scan (common words like host/selo
# are gated by image entitlement instead, not by text scan).
NAME_SCOPE = {
    "mutares": "mutares-family", "holliday": "mutares-family", "venator": "mutares-family",
    "attero": "named-customer", "keeeper": "named-customer",
    "omniplast": "named-customer", "sonneborn": "named-customer",
}


class Report:
    def __init__(self):
        self.fails: list[str] = []
        self.warns: list[str] = []

    def fail(self, msg): self.fails.append(msg)
    def warn(self, msg): self.warns.append(msg)


def load_image_entitlements() -> dict:
    mf = ds.REPO_ROOT / "brand" / "img" / "library.json"
    import json
    data = json.loads(mf.read_text(encoding="utf-8"))
    return {m["file"]: m.get("entitlement", "public") for m in data.get("images", [])}


def slide_roles(deck: dict, deckdir: Path) -> list[str]:
    """Role per slide. A variant-local override (decks/<v>/slides/<id>/meta.yaml)
    wins over the library, so a brand-new variant slide can declare its role."""
    roles = []
    for sid in deck["slides"]:
        local = Path(deckdir) / "slides" / sid / "meta.yaml"
        meta = local if local.exists() else ds.SLIDES_DIR / sid / "meta.yaml"
        role = ""
        if meta.exists():
            role = (yaml.safe_load(meta.read_text(encoding="utf-8")) or {}).get("role", "")
        roles.append(role)
    return roles


def verify(deckdir: Path, r: Report) -> None:
    deckdir = Path(deckdir).resolve()
    deck = ds.load_deck(deckdir)
    n = len(deck["slides"])
    allowed = set(deck.get("allowed_entitlements", ["public"]))
    allowed.add("public")

    index = deckdir / "index.html"
    if not index.exists():
        r.fail(f"no index.html in {deckdir} (assemble first)")
        return
    doc = index.read_text(encoding="utf-8")
    text = html.unescape(doc)

    # 1. em dashes
    if "—" in text or "&mdash;" in doc:
        for i, line in enumerate(doc.splitlines(), 1):
            if "—" in html.unescape(line) or "&mdash;" in line:
                r.fail(f"em dash on line {i}: {line.strip()[:70]}")

    # 2. unfilled variables
    for v in ds.unfilled(doc):
        r.fail(f"unfilled placeholder in shipped HTML: {{{{{v}}}}}")

    # 3. data-total consistency
    for m in set(re.findall(r'data-total="(\d+)"', doc)):
        if int(m) != n:
            r.fail(f'data-total="{m}" != slide count {n}')

    # 4. footer discipline (role-driven)
    secs = ds.sections(doc)
    if len(secs) != n:
        r.fail(f"{len(secs)} <section> blocks != {n} slides in deck.yaml")
    for sid, role, sec in zip(deck["slides"], slide_roles(deck, deckdir), secs):
        has_foot = "slide-foot" in sec
        if not role:
            r.warn(f"slide '{sid}' has no declared role; footer discipline not checked "
                   "(add a meta.yaml with a role for a variant-local slide)")
            continue
        if role in NO_FOOTER_ROLES and has_foot:
            r.fail(f"slide '{sid}' (role {role}) should have NO footer")
        if role not in NO_FOOTER_ROLES and not has_foot:
            r.fail(f"slide '{sid}' (role {role}) is missing its .slide-foot")

    # 5. images resolve + entitlement
    ent = load_image_entitlements()
    for src in re.findall(r'<img[^>]+src="([^"]+)"', doc):
        target = (deckdir / src).resolve()
        if not target.exists():
            r.fail(f"image does not resolve: {src}")
        mkey = None
        if "brand/img/" in src.replace("\\", "/"):
            mkey = src.replace("\\", "/").split("brand/img/", 1)[1]
        if mkey and mkey in ent and ent[mkey] not in allowed:
            r.fail(f"image '{mkey}' entitlement '{ent[mkey]}' exceeds deck clearance {sorted(allowed)}")

    # 6. customer-name text leak (word-boundary, case-insensitive)
    low = text.lower()
    for name, scope in NAME_SCOPE.items():
        if re.search(rf"\b{name}\b", low) and scope not in allowed:
            r.fail(f"customer name '{name}' present but deck clearance is {sorted(allowed)}")

    # 7. euro number format (WARN — deliberate verbatim exceptions exist)
    for m in re.findall(r"€\s?\d{1,3},\d{3}", text):
        r.warn(f"euro amount uses comma-grouping (Anglo) '{m}': confirm it is a verbatim quote")

    # 8. PDF checks
    pdfs = list(deckdir.glob("*.pdf"))
    if not pdfs:
        r.warn("no PDF found; skipped page-count / size / blank-page checks")
    else:
        import fitz
        pdf = fitz.open(pdfs[0])
        if pdf.page_count != n:
            r.fail(f"PDF {pdfs[0].name} has {pdf.page_count} pages, expected {n}")
        w, h = pdf[0].rect.width / 72, pdf[0].rect.height / 72
        if abs(w - PAGE_W_IN) > 0.02 or abs(h - PAGE_H_IN) > 0.02:
            r.fail(f"PDF page size {w:.3f}x{h:.3f} in, expected {PAGE_W_IN}x{PAGE_H_IN}")
        for i in range(pdf.page_count):
            pix = pdf[i].get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
            s = pix.samples
            if not s:
                continue
            corner = bytes(s[:pix.n])
            step = pix.n
            same = sum(1 for j in range(0, len(s) - step + 1, step) if s[j:j + step] == corner)
            frac = same / (len(s) / step)
            if frac > 0.995:
                r.warn(f"page {i + 1} is {frac*100:.1f}% one color — possibly blank/underfilled")


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify an assembled deck.")
    ap.add_argument("deckdir", help="folder containing deck.yaml + index.html")
    args = ap.parse_args()

    r = Report()
    verify(Path(args.deckdir), r)

    name = Path(args.deckdir).name
    for w in r.warns:
        print(f"WARN  [{name}] {w}")
    for f in r.fails:
        print(f"FAIL  [{name}] {f}")
    if r.fails:
        print(f"\nRESULT [{name}]: {len(r.fails)} failure(s), {len(r.warns)} warning(s)")
        return 1
    print(f"RESULT [{name}]: PASS ({len(r.warns)} warning(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
