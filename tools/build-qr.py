#!/usr/bin/env python
"""
Generate a QR code as an inline-ready SVG path (Oppr Deck Studio).

A QR code in a deck has to survive being printed to PDF and then scanned off a
screen or a sheet of paper, so it is generated as **vector**, never a raster:
a PNG at slide scale either bloats the PDF or blurs, and a blurred QR is a QR
that does not scan.

    python tools\build-qr.py --url https://www.linkedin.com/in/fwyers/ ^
        --out brand/qr/linkedin-fwyers.svg

The output is a small standalone SVG whose single <path> is also printed to
stdout, so it can be pasted straight into a slide fragment. Inlining is
deliberate: a slide that carries its own QR needs no asset bundling, no
`library.json` entry and no entitlement decision, and it cannot break when an
image path moves.

`--ecc h` (the default) keeps ~30% redundancy, which is what lets the code stay
readable at deck sizes and after a PDF round trip.
"""
from __future__ import annotations

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def qr_path(url: str, ecc: str = "h", border: int = 2) -> tuple[str, int]:
    """Return (SVG path data, module count including the quiet zone)."""
    try:
        import segno
    except ImportError:                       # pragma: no cover
        raise SystemExit(
            "ERROR: segno is not installed. Run: pip install -r requirements.txt")

    qr = segno.make(url, error=ecc)
    matrix = [list(row) for row in qr.matrix]
    n = len(matrix)
    size = n + border * 2

    # One path, one rect per dark module. Runs of adjacent dark modules are
    # merged into a single horizontal rect, which roughly halves the markup and
    # removes the hairline seams some PDF viewers draw between abutting rects.
    parts = []
    for y, row in enumerate(matrix):
        x = 0
        while x < n:
            if not row[x]:
                x += 1
                continue
            run = x
            while run < n and row[run]:
                run += 1
            parts.append(f"M{x + border} {y + border}h{run - x}v1h-{run - x}z")
            x = run
    return "".join(parts), size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="what the code should open")
    ap.add_argument("--out", required=True, help="SVG path, relative to the repo root")
    ap.add_argument("--ecc", default="h", choices=list("lmqh"),
                    help="error correction; h (30%%) is the default and survives print")
    ap.add_argument("--border", type=int, default=2,
                    help="quiet zone in modules; below 2 some scanners refuse")
    args = ap.parse_args()

    d, size = qr_path(args.url, args.ecc, args.border)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
           f'shape-rendering="crispEdges" role="img" aria-label="QR code: {args.url}">'
           f'<path fill="#15201e" d="{d}"/></svg>\n')

    out = REPO_ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")

    print(f"wrote {args.out}  ({size}x{size} modules, {len(svg)} bytes)")
    print(f"viewBox: 0 0 {size} {size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
