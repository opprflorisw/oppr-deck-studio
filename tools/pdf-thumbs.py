#!/usr/bin/env python
"""
Rasterize a deck PDF into per-page PNG thumbnails (Deck Studio v3, §4.5).

    python tools/pdf-thumbs.py <pdf> <outdir> [--width 480]

Writes p1.png … pN.png. The agent runs this after a PASS build and uploads the
thumbnails so deck lists and filmstrips show the deck as it actually is.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import fitz


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("outdir")
    ap.add_argument("--width", type=int, default=480)
    args = ap.parse_args()

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    pdf = fitz.open(args.pdf)
    for i in range(pdf.page_count):
        page = pdf[i]
        scale = args.width / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
        pix.save(str(out / f"p{i + 1}.png"))
    print(f"{pdf.page_count} thumbnails -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
