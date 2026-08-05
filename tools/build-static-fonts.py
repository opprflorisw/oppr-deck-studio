#!/usr/bin/env python
"""
Generate static font instances into brand/fonts-static/ (Deck Studio 3, SPEC §7).

WHY THIS EXISTS. Chrome cannot serialize a variable font into a PDF. Faced with
one it falls back to **Type 3 fonts**, where every glyph becomes a little content
stream re-declared per page: the 18-page Product Showcase carried 57 of them.
That is why the PDFs were heavy, and why compressing them did not help.

The fix is to print from static instances. The variable fonts stay in
brand/fonts/ for the screen (the app, the carousels on screen, and
tools/build-brand-kit.py, which pins wght=700 on Archivo-var.woff2 to outline
the wordmark). Only the print stylesheets point at these.

    python tools/build-static-fonts.py            # generate
    python tools/build-static-fonts.py --check    # exit 1 if any output is stale

Needs fontTools + brotli (already an undeclared dependency of build-brand-kit.py).
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "brand" / "fonts"
OUT = REPO_ROOT / "brand" / "fonts-static"

# The weights the stylesheets actually ask for. Adding one here is cheaper than
# shipping the whole axis, but every addition is bytes in every snapshot.
FAMILIES = {
    "Archivo-var.woff2": ("Archivo", [400, 500, 600, 650, 700, 800]),
    "JetBrainsMono-var.woff2": ("JetBrainsMono", [400, 500, 600, 700]),
}


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def build(check: bool) -> int:
    try:
        from fontTools import ttLib
        from fontTools.varLib import instancer
    except ImportError:
        print("ERROR: fontTools is required (pip install -r requirements.txt)")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    stale, made = [], []

    for src_name, (family, weights) in FAMILIES.items():
        src = SRC / src_name
        if not src.exists():
            print(f"ERROR: {src} is missing")
            return 1
        for wght in weights:
            dst = OUT / f"{family}-{wght}.woff2"
            if check:
                if not dst.exists():
                    stale.append(f"{dst.relative_to(REPO_ROOT)} is missing")
                continue
            font = ttLib.TTFont(src)
            inst = instancer.instantiateVariableFont(font, {"wght": wght}, inplace=False)
            # A static instance must not advertise the axis it no longer has, or
            # Chrome treats it as variable again and we are back to Type 3.
            for tag in ("fvar", "gvar", "HVAR", "VVAR", "MVAR", "STAT", "avar"):
                if tag in inst:
                    del inst[tag]
            inst.flavor = "woff2"
            inst.save(dst)
            made.append(dst)

    if check:
        if stale:
            print(f"{len(stale)} stale font output(s):")
            for s in stale:
                print(f"  {s}")
            return 1
        print(f"static fonts OK: {sum(len(w) for _, w in FAMILIES.values())} instances present.")
        return 0

    total = sum(p.stat().st_size for p in made)
    for p in made:
        print(f"  {p.relative_to(REPO_ROOT)}  {p.stat().st_size:,} B  {_digest(p)}")
    print(f"{len(made)} static instances, {total:,} bytes total")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 when an output is missing")
    return build(ap.parse_args().check)


if __name__ == "__main__":
    raise SystemExit(main())
