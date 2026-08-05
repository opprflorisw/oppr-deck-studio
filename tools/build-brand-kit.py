#!/usr/bin/env python
"""
Build the shareable Oppr brand kit (brand/kit/).

The six SVGs copied from the website are the originals and are never rewritten.
Two things make them unsafe to hand to someone outside Oppr, and this tool fixes
both without touching them:

  1. The wordmarks are live `<text>` with `font-family="Archivo, Arial"`. Archivo
     is not a system font, so a recipient renders the fallback: different
     letterforms, and the terracotta dot (a separately positioned <circle>) no
     longer sits at the right distance from the r. This tool outlines the word to
     a `<path>` taken from brand/fonts/Archivo-var.woff2 at wght=700, so the
     outlined files render identically everywhere, with no font to install.

  2. The originals sit in a 200x52 viewBox while the mark only occupies x=6..102.
     Roughly half the box is empty, so dropping one into a partner's slide floats
     it in the left half of its frame. The outlined files carry a tight viewBox
     (true ink bounds), which is what a designer expects; clear space is then the
     recipient's to apply, per the rule in the README.

It also rasterizes PNGs from the outlined SVGs (so the PNGs are correct
regardless of installed fonts) and writes kit.json, the manifest the standalone
page and the app's Library > Brand tab both read.

    python tools/build-brand-kit.py            # rebuild everything
    python tools/build-brand-kit.py --check    # fail if outputs are stale (CI)

Needs fonttools + brotli (outlining) and Chrome or Edge (PNG rasterization).
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
KIT = REPO_ROOT / "brand" / "kit"
ASSETS = KIT / "assets"
PNG = ASSETS / "png"
FONT = REPO_ROOT / "brand" / "fonts" / "Archivo-var.woff2"

# Brand colours. The single source is brand/BRAND.md; these mirror it and the
# kit page renders its swatches from this table so the two cannot drift.
GROUND = "#f2f2ed"
INK = "#15201e"
HUMAN = "#a65032"
MACHINE = "#3e6874"
VERIFIED = "#55745e"

COLOURS = [
    ("GROUND", GROUND, "warm paper background"),
    ("INK", INK, "near-black text and structure"),
    ("HUMAN", HUMAN, "terracotta, the operator's voice (the dot)"),
    ("MACHINE", MACHINE, "teal, the machine's voice"),
    ("VERIFIED", VERIFIED, "green, a verified result"),
]

# Wordmark geometry, matching the original SVGs exactly so the outlined version
# is a drop-in replacement: Archivo 700 at 40px, letter-spacing -1.5, first glyph
# origin at x=6, baseline y=40, terracotta period centred at (98, 35.5) r=4.
WORD = "oppr"
FONT_SIZE = 40.0
LETTER_SPACING = -1.5
ORIGIN_X = 6.0
BASELINE_Y = 40.0
DOT_CX, DOT_CY, DOT_R = 98.0, 35.5, 4.0
WEIGHT = 700


# --------------------------------------------------------------------------
# outlining
# --------------------------------------------------------------------------

def outline_word() -> tuple[str, tuple[float, float, float, float], float]:
    """Return (path data, ink bbox, height of the o) for the wordmark.

    The path is built in the ORIGINAL 200x52 coordinate frame, so it can be
    dropped straight into the existing artwork; callers that want the tight
    box translate by the returned bbox. The o's height is measured separately
    because BRAND.md defines clear space as the height of the o, not the
    height of the whole mark (the p descends below it).
    """
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.misc.transform import Transform
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    font = TTFont(FONT)
    # Archivo-var defaults to wght=600; the wordmark is 700, so pin the axis
    # before reading outlines or the shapes come out a weight light.
    instancer.instantiateVariableFont(font, {"wght": WEIGHT}, inplace=True)
    upem = font["head"].unitsPerEm
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    scale = FONT_SIZE / upem
    pen_out = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}")
    bounds = BoundsPen(glyphs)

    x = ORIGIN_X
    o_height = 0.0
    for ch in WORD:
        name = cmap[ord(ch)]
        # y is negated: font units are y-up, SVG user space is y-down.
        t = Transform(scale, 0, 0, -scale, x, BASELINE_Y)
        glyphs[name].draw(TransformPen(pen_out, t))
        glyphs[name].draw(TransformPen(bounds, t))
        if ch == "o":
            ob = BoundsPen(glyphs)
            glyphs[name].draw(TransformPen(ob, t))
            o_height = ob.bounds[3] - ob.bounds[1]
        x += hmtx[name][0] * scale + LETTER_SPACING

    d = pen_out.getCommands()
    if bounds.bounds is None:
        raise SystemExit("could not measure the wordmark outline")
    x0, y0, x1, y1 = bounds.bounds
    # The period is part of the mark, so it belongs in the ink bounds.
    ink = (
        min(x0, DOT_CX - DOT_R),
        min(y0, DOT_CY - DOT_R),
        max(x1, DOT_CX + DOT_R),
        max(y1, DOT_CY + DOT_R),
    )
    return d, ink, o_height


def wordmark_svg(d: str, ink, fill: str, tight: bool) -> str:
    """Outlined wordmark. `tight` crops the viewBox to the true ink bounds."""
    if tight:
        x0, y0, x1, y1 = ink
        w, h = x1 - x0, y1 - y0
        vb = f"{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}"
        wid, hei = f"{w:.2f}", f"{h:.2f}"
    else:
        vb, wid, hei = "0 0 200 52", "200", "52"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{wid}" height="{hei}" '
        f'role="img" aria-label="oppr">\n'
        f'  <path d="{d}" fill="{fill}"/>\n'
        f'  <circle cx="{DOT_CX}" cy="{DOT_CY}" r="{DOT_R}" fill="{HUMAN}"/>\n'
        f"</svg>\n"
    )


# --------------------------------------------------------------------------
# rasterizing
# --------------------------------------------------------------------------

def find_browser() -> str:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for c in candidates:
        if Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "msedge"):
        found = shutil.which(name)
        if found:
            return found
    raise SystemExit("Chrome or Edge is required to rasterize the PNGs.")


def rasterize(browser: str, svg: Path, out: Path, w: int, h: int) -> None:
    """SVG -> transparent PNG at exactly w x h, via a headless screenshot."""
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        shutil.copy(svg, tmp / svg.name)
        page = tmp / "page.html"
        page.write_text(
            "<style>html,body{margin:0;padding:0;background:transparent}"
            f"img{{display:block;width:{w}px;height:{h}px}}</style>"
            f'<img src="{svg.name}">',
            encoding="utf-8",
        )
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                browser, "--headless", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1",
                "--default-background-color=00000000",
                f"--screenshot={out}", f"--window-size={w},{h}",
                str(page),
            ],
            check=True, capture_output=True,
        )


# --------------------------------------------------------------------------
# the standalone page
# --------------------------------------------------------------------------

# Not an f-string: the CSS is full of braces and there is nothing to substitute.
PAGE_CSS = """
:root {
  --ground:#f2f2ed; --ink:#15201e; --human:#a65032; --machine:#3e6874; --verified:#55745e;
  --line:rgba(21,32,30,.12); --muted:rgba(21,32,30,.55);
}
@font-face { font-family:'Archivo'; src:url('fonts/Archivo-var.woff2') format('woff2');
             font-weight:100 900; font-display:swap; }
@font-face { font-family:'JetBrains Mono'; src:url('fonts/JetBrainsMono-var.woff2') format('woff2');
             font-weight:100 800; font-display:swap; }
*, *::before, *::after { box-sizing:border-box; }
body { margin:0; background:var(--ground); color:var(--ink);
       font-family:'Archivo',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
.wrap { max-width:1080px; margin:0 auto; padding:56px 32px 96px; }
.kicker { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.16em;
          text-transform:uppercase; color:var(--human); margin:0 0 12px; }
h1 { font-weight:700; font-size:38px; letter-spacing:-.03em; margin:0 0 10px; }
.lede { font-size:16px; line-height:1.6; color:var(--muted); max-width:640px; margin:0 0 8px; }
h2 { font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:.14em;
     text-transform:uppercase; color:var(--muted); font-weight:500;
     margin:56px 0 8px; padding-top:20px; border-top:1px solid var(--line); }
.sub { font-size:14px; line-height:1.6; color:var(--muted); max-width:640px; margin:0 0 18px; }
.tag { display:inline-block; font-family:'JetBrains Mono',monospace; font-size:10px;
       letter-spacing:.1em; text-transform:uppercase; border-radius:999px; padding:3px 9px;
       margin-left:8px; vertical-align:3px; }
.tag.rec { background:rgba(85,116,94,.14); color:var(--verified); }
.tag.leg { background:rgba(166,80,50,.12); color:var(--human); }
.row { display:flex; flex-wrap:wrap; gap:18px; }
.card { border-radius:12px; border:1px solid var(--line); display:flex; align-items:center;
        justify-content:center; padding:34px; min-height:132px; flex:1 1 300px; }
.card.dark { background:var(--ink); border-color:transparent; }
.card img { max-width:100%; height:auto; }
.icons { display:flex; align-items:flex-end; gap:22px; flex-wrap:wrap; }
.icons figure { margin:0; display:flex; flex-direction:column; align-items:center; gap:8px; }
.icons figcaption { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--muted); }
.card.dark .icons figcaption { color:rgba(242,242,237,.55); }
.dl { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; align-items:center; }
.dl-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em;
            text-transform:uppercase; color:var(--muted); margin-right:2px; }
.dl a { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.04em;
        text-decoration:none; color:var(--ink); border:1px solid var(--line);
        border-radius:999px; padding:7px 13px; transition:border-color .15s,color .15s; }
.dl a:hover { border-color:var(--human); color:var(--human); }
.swatches { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
.swatch { display:flex; align-items:flex-start; gap:12px; border:1px solid var(--line);
          border-radius:10px; padding:12px 14px; }
.chip { width:34px; height:34px; border-radius:7px; border:1px solid var(--line); flex:none; }
.swatch b { display:block; font-family:'JetBrains Mono',monospace; font-size:12px; }
.swatch span { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); }
.swatch em { display:block; font-style:normal; font-size:11px; color:var(--muted); margin-top:2px; }
.clearbox { display:inline-block; border:1px dashed var(--human); border-radius:4px; }
.clearbox img { display:block; }
.rules { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; }
.rule { border:1px solid var(--line); border-radius:10px; padding:16px 18px; }
.rule h3 { margin:0 0 8px; font-family:'JetBrains Mono',monospace; font-size:11px;
           letter-spacing:.12em; text-transform:uppercase; font-weight:500; }
.rule.do h3 { color:var(--verified); }
.rule.dont h3 { color:var(--human); }
.rule ul { margin:0; padding-left:18px; }
.rule li { font-size:14px; line-height:1.65; margin-bottom:6px; }
.type-note { font-size:15px; line-height:1.75; max-width:660px; }
.type-note b { color:var(--human); }
.spec { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--muted);
        margin-top:10px; line-height:1.7; }
footer { margin-top:64px; padding-top:20px; border-top:1px solid var(--line);
         font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); line-height:1.8; }
@media (max-width:640px) { .wrap { padding:40px 20px 72px; } h1 { font-size:30px; } }
"""


def _pills(files: list[tuple[str, str]]) -> str:
    return "".join(f'<a href="assets/{f}" download>{label}</a>' for f, label in files)


def page_html(m: dict) -> str:
    """The standalone kit page, generated from the same manifest the app reads."""
    tb = m["wordmark"]["tight_box"]
    clear = m["wordmark"]["clear_space"]
    # Clear space drawn to scale: show the mark 120px wide and pad by the same
    # ratio the rule demands (the height of the o, relative to the mark's box).
    shown_w = 260
    pad = round(clear / tb["w"] * shown_w, 1)

    def group_block(gid: str) -> str:
        g = next(x for x in m["groups"] if x["id"] == gid)
        tag = ('<span class="tag rec">use this</span>' if g["recommended"]
               else '<span class="tag leg">legacy</span>')
        cards = "".join(
            f'<div class="card{" dark" if it["bg"] == "ink" else ""}">'
            f'<img src="assets/{it["file"]}" alt="{it["label"]}" style="width:240px">'
            f"</div>"
            for it in g["items"]
        )
        svg_pills = _pills([(it["file"], it["file"]) for it in g["items"]])
        # PNGs are matched by the `from` recorded at render time, and labelled with
        # the variant so "400px" on a light file is never confused for the dark one.
        png_rows = []
        for it in g["items"]:
            mine = [p for p in m["png"] if p["from"] == it["file"]]
            if not mine:
                continue
            # `assets/` prefix, like every other link on this page: the manifest
            # records PNGs as "png/<name>" relative to assets/, and dropping the
            # prefix made every PNG download on the shared kit page a 404.
            pills = "".join(
                f'<a href="assets/{p["file"]}" download>{p["w"]}px</a>' for p in mine)
            png_rows.append(
                f'<div class="dl"><span class="dl-label">png &middot; {it["label"].lower()}</span>{pills}</div>')
        png_row = "".join(png_rows)
        return (f'<h2>{g["title"]}{tag}</h2>\n<p class="sub">{g["note"]}</p>\n'
                f'<div class="row">{cards}</div>\n'
                f'<div class="dl"><span class="dl-label">svg</span>{svg_pills}</div>\n{png_row}')

    ladder = "".join(
        f'<figure><img src="assets/icon-tile.svg" width="{s}" height="{s}" alt="">'
        f"<figcaption>{s}</figcaption></figure>"
        for s in (96, 64, 48, 32, 16)
    )
    swatches = "".join(
        f'<div class="swatch"><span class="chip" style="background:{c["hex"]}"></span>'
        f'<div><b>{c["name"]}</b><span>{c["hex"]}</span><em>{c["note"]}</em></div></div>'
        for c in m["colours"]
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Oppr brand kit</title>
<link rel="icon" href="assets/favicon.svg">
<style>{PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <p class="kicker">Oppr brand kit</p>
  <h1>oppr. and the o-monogram</h1>
  <p class="lede">The wordmark stays the baseline <strong>oppr.</strong> with its terracotta
    period. The icon is the first letter <strong>o</strong> carrying that same terracotta dot.
    One accent, everywhere.</p>
  <p class="lede">Everything here is ready to use as-is. Nothing needs a font installed,
    and every file has a transparent background unless its name says otherwise.</p>

{group_block("wordmark-outline")}

{group_block("wordmark-original")}

  <h2>Icon / favicon<span class="tag rec">use this</span></h2>
  <p class="sub">The o-monogram on the ink tile. Pure geometry, so it needs no font and
    stays legible down to 16px.</p>
  <div class="row"><div class="card"><div class="icons">{ladder}</div></div></div>
  <div class="dl"><span class="dl-label">svg</span>{_pills([("icon-tile.svg", "icon-tile.svg"), ("favicon.svg", "favicon.svg")])}</div>
  <div class="dl"><span class="dl-label">png</span>{"".join(f'<a href="assets/png/icon-tile-{s}.png" download>{s}px</a>' for s in (512, 256, 128, 64, 32, 16))}</div>

{group_block("icon-bare")}

  <h2>Clear space</h2>
  <p class="sub">Keep at least the height of the <strong>o</strong> clear on every side
    ({clear:.0f} units at the mark's own scale). The dashed line is the minimum, not a
    border to draw.</p>
  <div class="row"><div class="card">
    <span class="clearbox" style="padding:{pad}px">
      <img src="assets/wordmark-light-outline.svg" alt="" style="width:{shown_w}px">
    </span>
  </div></div>

  <h2>Colours</h2>
  <p class="sub">One accent per element. No gradients, and no shadows on the mark.</p>
  <div class="swatches">{swatches}</div>

  <h2>Type</h2>
  <p class="type-note"><b>Archivo</b> 700, lowercase, letter-spacing -0.04em for the wordmark.
    <b>JetBrains Mono</b> for UI labels, eyebrows and numbers. Both are open source under the
    SIL Open Font License and available from Google Fonts; copies are bundled in
    <code>fonts/</code> so this page renders correctly offline.</p>
  <p class="spec">Wordmark geometry &middot; Archivo {WEIGHT} at {FONT_SIZE:.0f}px,
    letter-spacing {LETTER_SPACING}, terracotta period r={DOT_R:.0f}<br>
    Outlined artboard &middot; {tb["w"]} &times; {tb["h"]} units, cropped to the mark</p>

  <h2>Using it</h2>
  <div class="rules">
    <div class="rule do"><h3>Do</h3><ul>
      <li>Use the outlined wordmark for anything leaving Oppr.</li>
      <li>Keep the wordmark lowercase, always.</li>
      <li>Keep the terracotta period. It is the signature.</li>
      <li>Pick the light or dark file to suit the background it sits on.</li>
      <li>Scale proportionally, and leave the clear space above.</li>
    </ul></div>
    <div class="rule dont"><h3>Don't</h3><ul>
      <li>Recolour the period, or drop it.</li>
      <li>Capitalise it, or set it in another typeface.</li>
      <li>Add a gradient, shadow, outline or second accent.</li>
      <li>Stretch, skew, rotate or condense the mark.</li>
      <li>Place the light wordmark on a dark ground, or the reverse.</li>
      <li>Rebuild the mark by typing "oppr." and adding a dot.</li>
    </ul></div>
  </div>

  <footer>
    Oppr B.V. &middot; brand kit &middot; questions to floris@oppr.ai<br>
    Generated by <code>tools/build-brand-kit.py</code>. The outlined wordmarks are paths taken
    from Archivo at weight {WEIGHT}, so they render identically with no font installed.
  </footer>
</div>
</body>
</html>
"""


def readme_txt(m: dict) -> str:
    """The plain-text README that travels with the kit. Generated, so the file
    list and the colour table can never fall behind what was actually built."""
    tb = m["wordmark"]["tight_box"]
    colours = "\n".join(f'{c["name"]:<9} {c["hex"]}   {c["note"]}' for c in m["colours"])
    pngs = "\n".join(f'  {p["file"]:<32} {p["w"]}x{p["h"]}' for p in m["png"])
    return f"""OPPR BRAND KIT
==============

The Oppr mark: the baseline wordmark "oppr." and the o-monogram icon that
carries the same terracotta dot.

Open index.html in a browser to see everything together, with a download link
next to each file.

START HERE
----------
If you are placing the Oppr logo in something, use these:

  assets/wordmark-light-outline.svg   on light backgrounds
  assets/wordmark-dark-outline.svg    on dark backgrounds
  assets/icon-tile.svg                app icon / favicon

They are outlines, not text, so they need no font installed and render
identically everywhere. Backgrounds are transparent and the artboard is cropped
to the mark ({tb["w"]} x {tb["h"]} units), so the logo will not float inside
unexpected padding.

EVERYTHING IN THE KIT
---------------------
assets/
  wordmark-light-outline.svg   RECOMMENDED. oppr. as paths, ink, transparent
  wordmark-dark-outline.svg    RECOMMENDED. oppr. as paths, paper, transparent
  wordmark-light.svg           original. Live text; needs Archivo installed
  wordmark-dark.svg            original. Live text, and an opaque ink backing
  icon-tile.svg                the o-monogram on the ink tile
  favicon.svg                  identical to icon-tile, named for favicon use
  icon-bare-light.svg          o. with no tile, for light backgrounds
  icon-bare-dark.svg           o. with no tile, for dark backgrounds

assets/png/   (transparent, rendered from the outlined SVGs)
{pngs}

fonts/        Archivo and JetBrains Mono, so index.html renders offline

Both originals are kept only so existing links keep working. Prefer the
outlined pair for anything leaving Oppr: without Archivo installed the
originals fall back to Arial, which changes the letterforms and shifts the
terracotta period away from the r.

COLOURS
-------
{colours}

TYPE
----
Wordmark: Archivo, {m["wordmark"]["weight"]} weight, letter-spacing -0.04em, lowercase.
UI / labels: JetBrains Mono.
Both are open source under the SIL Open Font License (fonts.google.com).

USAGE
-----
- Keep the wordmark lowercase. The terracotta period is the signature; do not
  recolour it or drop it.
- The icon is the first letter o carrying that same terracotta dot. Use the
  tile form for app icons and favicons; use the bare form in-line or where a
  transparent background is needed.
- One accent per mark. No gradients, shadows, or a second accent colour.
- Clear space: at least the height of the o ({m["wordmark"]["clear_space"]:.0f} units) on every side.
- Do not stretch, skew, rotate or recolour the mark, and do not rebuild it by
  typing "oppr." and adding a dot.

Questions: floris@oppr.ai
Generated by tools/build-brand-kit.py in the Oppr Deck Studio repo.
"""


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------

def build() -> dict:
    if not FONT.exists():
        raise SystemExit(f"missing font: {FONT}")
    for original in ("wordmark-light.svg", "wordmark-dark.svg", "icon-tile.svg",
                     "favicon.svg", "icon-bare-light.svg", "icon-bare-dark.svg"):
        if not (ASSETS / original).exists():
            raise SystemExit(f"missing original: {ASSETS / original}")

    d, ink, o_height = outline_word()
    x0, y0, x1, y1 = ink
    tw, th = x1 - x0, y1 - y0

    # The kit has to survive being zipped and mailed, so it carries the two fonts
    # rather than pointing the page at Google Fonts (which would leave it broken
    # offline and on a locked-down network).
    fonts_out = KIT / "fonts"
    fonts_out.mkdir(parents=True, exist_ok=True)
    for f in ("Archivo-var.woff2", "JetBrainsMono-var.woff2"):
        src = REPO_ROOT / "brand" / "fonts" / f
        if src.exists():
            shutil.copy(src, fonts_out / f)

    # Outlined wordmarks: font-independent, transparent, tight box. The dark one
    # also solves the second flaw in wordmark-dark.svg, which bakes in an opaque
    # ink rectangle and so only works on exactly #15201e.
    (ASSETS / "wordmark-light-outline.svg").write_text(
        wordmark_svg(d, ink, INK, tight=True), encoding="utf-8")
    (ASSETS / "wordmark-dark-outline.svg").write_text(
        wordmark_svg(d, ink, GROUND, tight=True), encoding="utf-8")

    browser = find_browser()
    PNG.mkdir(parents=True, exist_ok=True)

    # Wordmark PNGs are sized by width; height follows the tight aspect ratio.
    wordmark_widths = [400, 800, 1200]
    icon_sizes = [512, 256, 128, 64, 32, 16]

    # Each PNG records the SVG it was rendered from. The page and the app then
    # offer a PNG only under the asset it actually came from — the wordmark PNGs
    # are rendered from the OUTLINED files, so listing them under the originals
    # would hand someone a file that is not what its heading claims.
    made: list[dict] = []

    def raster(src: str, name: str, w: int, h: int) -> None:
        rasterize(browser, ASSETS / src, PNG / name, w, h)
        made.append({"file": f"png/{name}", "from": src, "w": w, "h": h})

    for variant in ("light", "dark"):
        for w in wordmark_widths:
            raster(f"wordmark-{variant}-outline.svg",
                   f"wordmark-{variant}-{w}.png", w, max(1, round(w * th / tw)))
    for size in icon_sizes:
        raster("icon-tile.svg", f"icon-tile-{size}.png", size, size)
    for variant in ("light", "dark"):
        raster(f"icon-bare-{variant}.svg", f"icon-bare-{variant}-512.png", 512, 512)

    manifest = {
        "generated_by": "tools/build-brand-kit.py",
        "wordmark": {
            "word": WORD, "font": "Archivo", "weight": WEIGHT,
            "font_size": FONT_SIZE, "letter_spacing": LETTER_SPACING,
            "tight_box": {"w": round(tw, 2), "h": round(th, 2)},
            # Clear space per BRAND.md is the height of the o, which is shorter
            # than the mark's own box (the p descends below the o's baseline).
            "clear_space": round(o_height, 2),
        },
        "colours": [{"name": n, "hex": h, "note": t} for n, h, t in COLOURS],
        "groups": [
            {
                "id": "wordmark-outline",
                "title": "Wordmark (outlined)",
                "recommended": True,
                "note": "Font-independent paths, transparent, cropped to the mark. "
                        "Use these unless you have a reason not to.",
                "items": [
                    {"file": "wordmark-light-outline.svg", "label": "Light backgrounds", "bg": "ground"},
                    {"file": "wordmark-dark-outline.svg", "label": "Dark backgrounds", "bg": "ink"},
                ],
            },
            {
                "id": "wordmark-original",
                "title": "Wordmark (original)",
                "recommended": False,
                "note": "Live text needing Archivo installed, in a 200x52 box the mark "
                        "does not fill. Kept so anything already pointing at them keeps "
                        "working; prefer the outlined pair for anyone outside Oppr.",
                "items": [
                    {"file": "wordmark-light.svg", "label": "Light backgrounds", "bg": "ground"},
                    {"file": "wordmark-dark.svg", "label": "Dark backgrounds (opaque)", "bg": "ink"},
                ],
            },
            {
                "id": "icon",
                "title": "Icon / favicon",
                "recommended": True,
                "note": "The o-monogram on the ink tile. Pure geometry, so it needs no font.",
                "items": [
                    {"file": "icon-tile.svg", "label": "Icon tile", "bg": "ground"},
                    {"file": "favicon.svg", "label": "Favicon (identical)", "bg": "ground"},
                ],
            },
            {
                "id": "icon-bare",
                "title": "Bare o. (no tile)",
                "recommended": True,
                "note": "For inline use or wherever a transparent background is needed.",
                "items": [
                    {"file": "icon-bare-light.svg", "label": "Light backgrounds", "bg": "ground"},
                    {"file": "icon-bare-dark.svg", "label": "Dark backgrounds", "bg": "ink"},
                ],
            },
        ],
        "png": made,
    }
    (KIT / "kit.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (KIT / "index.html").write_text(page_html(manifest), encoding="utf-8")
    (KIT / "README.txt").write_text(readme_txt(manifest), encoding="utf-8")
    write_zip()
    return manifest


ZIP_NAME = "oppr-brand-kit.zip"


def write_zip() -> Path:
    """One file to hand to someone outside Oppr.

    Entries carry a fixed timestamp and are added in sorted order, so rebuilding
    an unchanged kit produces byte-identical output and `--check` stays honest.
    """
    import zipfile

    out = KIT / ZIP_NAME
    members = sorted(
        (p for p in KIT.rglob("*") if p.is_file() and p.name != ZIP_NAME),
        key=lambda p: p.relative_to(KIT).as_posix(),
    )
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in members:
            info = zipfile.ZipInfo(p.relative_to(KIT).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, p.read_bytes())
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the Oppr brand kit.")
    ap.add_argument("--check", action="store_true",
                    help="rebuild into a scratch copy and fail if anything differs")
    args = ap.parse_args()

    if args.check:
        snap = lambda: {p.relative_to(KIT).as_posix(): p.read_bytes()
                        for p in KIT.rglob("*") if p.is_file()}
        before = snap()
        build()
        after = snap()
        stale = sorted(set(before) ^ set(after)) + \
            sorted(k for k in before.keys() & after.keys() if before[k] != after[k])
        if stale:
            print("STALE: " + ", ".join(stale))
            return 1
        print("brand kit is up to date")
        return 0

    m = build()
    tb = m["wordmark"]["tight_box"]
    print(f"Wordmark outlined at Archivo {WEIGHT}: tight box {tb['w']} x {tb['h']}")
    print(f"Wrote {len(m['png'])} PNGs + 2 outlined SVGs + kit.json into brand/kit/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
