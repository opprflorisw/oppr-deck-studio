# 08 — Kill the Type 3 fonts: a PDF that is light and scrolls instantly

- **type:** research (AFK), with a measured prototype
- **status:** closed 2026-08-04
- **assignee:** research agent (claimed 2026-08-04)
- **blocked by:** —
- **blocks:** 10

## Question

Floris: the PDFs are heavy (3,5 MB), scrolling is slow, and compressing to 800 KB
leaves them just as slow.

**Evidence gathered while charting.** The Product Showcase PDF (18 pages,
2.868.605 bytes) carries **57 Type 3 font objects**, 7 to 21 per page. Real images
account for about 1,8 MB across three pages, so images are not the problem. A
Type 3 font is not a font program: each glyph is a little content stream the
viewer executes on every render. That is consistent with everything observed,
including why compression does not help, because the cost is glyph procedures, not
bytes.

The working hypothesis is that Chrome's print path cannot embed our **variable**
fonts (`brand/fonts/Archivo-var.woff2`, `JetBrainsMono-var.woff2`) and falls back
to Type 3.

Resolve:

1. **Confirm the cause.** Print a one-page deck with the variable fonts, then the
   same page with a static instance, and compare the font objects. If static
   instances produce TrueType or CFF rather than Type 3, the hypothesis holds.
2. **Pick the fix.** Candidates: ship static instances of Archivo and JetBrains
   Mono at the weights actually used, and keep the variable font for screen only;
   install the fonts on the print machine; or replace Chrome print with another
   engine. Judge on: does it work on a fresh clone, does it work on Vercel (where
   the app prints on demand), and does it change how anything looks.
3. **Measure.** File size, font-object count and type, and a real scroll test, on
   the same 18-page deck, before and after. Report numbers, not impressions.
4. **Check the blast radius.** The brand kit
   (`tools/build-brand-kit.py`) deliberately outlines the wordmark so it needs no
   font installed, carousels print through the same path, and `verify-deck.py`
   checks page geometry. Say what else the fix touches.

Which weights are genuinely in use is answerable from `templates/deck.css` and
`showcase.css`; read them rather than guessing.

## Constraint

**Do not change the print pipeline in this ticket.** Prototype in the scratchpad,
measure, and report the recommendation. Applying it is build work.

## Answer

Full findings: [`research/08-type3-fonts.md`](../research/08-type3-fonts.md).

**The hypothesis is half right, and the half it gets wrong matters.**

**Cause of the weight: confirmed.** Chrome cannot serialise a variable font into
a PDF and writes every glyph as a Type 3 content stream instead. Proven by a
six-way controlled print of the same probe page. The decisive control declares a
single `@font-face` at the variable font's own default weight, asking for no
interpolation at all, and still gets Type 3. So the trigger is the presence of
`fvar`/`gvar` in the file, not weight synthesis, not the `format()` string, not
woff2, and not a failed `src`. Embedding permission is open (`fsType = 0`) and no
text is rasterised. Static instances of the same fonts produce Type 0 / Identity-H
at a quarter of the bytes.

**Cause of the slowness: refuted.** Type 3 costs bytes, not time. Removing it
moved PDFium, the engine in Chrome's own PDF viewer, from 4.714 ms to 4.369 ms
across 18 pages. The real cost is the cover: `.scrim` in `showcase.css` stacks
three full-bleed `linear-gradient` layers over the hero image, and Chrome emits
each as a full-page tiling pattern wrapping a ShadingType 1 function with alpha,
evaluated per pixel. Page 1 costs 2.671 ms; flattening the scrim takes it to
122 ms. One gradient layer is worth about 1,3 seconds. Every other page is 70 to
130 ms.

**Fix, two independent changes, neither touching the print pipeline.**

1. Generate static instances with fontTools `varLib.instancer`, commit them to
   `brand/fonts-static/` (Archivo 400/500/600/650/700/800, JetBrains Mono
   400/500/600/700, ten files, 172.920 bytes), and point `deck.css` and
   `linkedin.css` at them. Keep the variable fonts for screen and for the brand
   kit. Works in a fresh clone, works on Vercel, and changes nothing visible:
   0,068 % of pixels differ at glyph edges, word positions match to 0,07 pt,
   geometry and extracted text are identical.
2. Stop the cover scrim from becoming a per-pixel shading over the whole page.
   Baking the gradient into the hero image keeps the look exactly; a flat
   `rgba()` is cheapest but is a design call for Floris.

Rejected: installing the fonts on the print machine (still variable, so still
Type 3, and Vercel has nowhere to install them) and replacing the print engine
(fails Vercel and breaks the identical-output contract in `app/lib/render.mjs`).

**Measured on the 18-page Product Showcase.**

| Build | Bytes | PDF objects | Fonts | PDFium, 18 pp | PDFium, page 1 |
|---|---|---|---|---|---|
| Today | 2.868.605 | 2.250 | 57 Type 3 | 4.714 ms | 3.083 ms |
| Static fonts only | 2.224.217 | 786 | 8 Type 0 | 4.369 ms | 2.945 ms |
| Flat scrim only | 2.864.635 | 2.237 | 57 Type 3 | 1.865 ms | 136 ms |
| **Both** | **2.220.311** | **773** | **8 Type 0** | **1.643 ms** | **132 ms** |

Doing both: 22,6 % smaller and 2,9x faster to render. All of the size win is the
fonts; all of the speed win is the scrim. What is left is 1.821.003 bytes of
images across three pages, which is the next question and not this one.

**Blast radius.** `deck.css` and `linkedin.css` (carousels have the same Type 3
problem today and inherit the fix), `showcase.css` if the scrim changes, a new
`brand/fonts-static/` plus a small generator in `tools/`, and fontTools + brotli
declared in `requirements.txt`. Untouched: `build-brand-kit.py` (as long as the
variable fonts stay), `snapshot.py` (already inlines any woff2, so snapshots grow
about 107 KB), `verifylib.py` and `verify-deck.py` (no font rules, geometry
unchanged), and `app/lib/render.mjs` and `htmlcheck.mjs`. Artifacts already
published keep their Type 3 snapshots until they are re-saved or reprinted.
