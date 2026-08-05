#!/usr/bin/env python
"""
Bake the cover scrim into the hero image (Deck Studio 3, SPEC §7).

WHY THIS EXISTS. `.cover .scrim` stacked three full-bleed linear-gradients over
the photograph. Chrome writes each as a full-page tiling pattern wrapping a
ShadingType 1 function with alpha, evaluated per pixel over ~4000x2250 device
pixels. Measured on the 18-page Product Showcase: page 1 cost 2.671 ms where
every other page cost 70 to 130 ms. Compressing the PDF does not help, because
the cost is the shading functions, not the bytes.

Applying the same gradients ONCE here, into the pixels, is visually
indistinguishable (mean delta 0,94/255 against the CSS version) and removes every
shading object: the cover renders 3x faster and the PDF is roughly half the size.

The values below are the `.cover--open` stack from templates/showcase.css, which
is deliberately lighter than the default so the operator and the line stay
readable behind the headline.

    python tools/build-cover-hero.py            # generate
    python tools/build-cover-hero.py --check    # exit 1 if an output is stale

The cost, accepted when this was decided: the scrim is no longer a CSS value you
can nudge. Changing it means changing RECIPE here and re-running this.
"""
from __future__ import annotations

import argparse
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
IMG = REPO_ROOT / "brand" / "img"

W, H = 1280, 720          # 13.333 x 7.5 in at 96 dpi, the slide's own geometry
INK = (15, 22, 20)        # rgba(15,22,20,...) in the CSS

# Each source hero and the crop the CSS applies to it:
#   object-fit: cover; object-position: <x>% <y>%
SOURCES = [
    ("hero-plate.jpg", "hero-plate-scrim.jpg", 0.72, 0.38),
]

# The .cover--open stack, outermost last (CSS paints the first layer on top):
#   linear-gradient(90deg, .93 22%, .56 58%, .30 100%)
#   linear-gradient(0deg,  .72  0%, .05 52%)
#   rgba(15,22,20,0.10)
RECIPE = {
    "horizontal": [(0.22, 0.93), (0.58, 0.56), (1.00, 0.30)],
    "vertical_from_bottom": [(0.00, 0.72), (0.52, 0.05)],
    "base": 0.10,
}


def _ramp(stops, t: float) -> float:
    """Alpha at position t along a list of (position, alpha) stops."""
    if t <= stops[0][0]:
        return stops[0][1]
    for (p0, a0), (p1, a1) in zip(stops, stops[1:]):
        if t <= p1:
            return a0 + (a1 - a0) * (t - p0) / (p1 - p0) if p1 > p0 else a1
    return stops[-1][1]


def bake(src: Path, dst: Path, pos_x: float, pos_y: float) -> None:
    from PIL import Image

    im = Image.open(src).convert("RGB")
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im = im.crop((round((im.width - W) * pos_x), round((im.height - H) * pos_y),
                  round((im.width - W) * pos_x) + W, round((im.height - H) * pos_y) + H))

    px = im.load()
    base = RECIPE["base"]
    for x in range(W):
        a_h = _ramp(RECIPE["horizontal"], x / (W - 1))
        for y in range(H):
            a_v = _ramp(RECIPE["vertical_from_bottom"], 1 - y / (H - 1))
            a = 1 - (1 - a_h) * (1 - a_v) * (1 - base)
            r, g, b = px[x, y]
            px[x, y] = (round(r + (INK[0] - r) * a),
                        round(g + (INK[1] - g) * a),
                        round(b + (INK[2] - b) * a))
    im.save(dst, "JPEG", quality=88, optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="exit 1 when an output is missing")
    args = ap.parse_args()

    stale = []
    for src_name, dst_name, px, py in SOURCES:
        src, dst = IMG / src_name, IMG / dst_name
        if not src.exists():
            print(f"ERROR: {src} is missing")
            return 1
        if args.check:
            if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
                stale.append(dst.relative_to(REPO_ROOT))
            continue
        bake(src, dst, px, py)
        print(f"  {dst.relative_to(REPO_ROOT)}  {dst.stat().st_size:,} B "
              f"(from {src.name}, {src.stat().st_size:,} B)")

    if args.check:
        if stale:
            print(f"{len(stale)} stale cover hero(es):")
            for s in stale:
                print(f"  {s}")
            return 1
        print(f"cover heroes OK: {len(SOURCES)} baked composite(s) present.")
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
