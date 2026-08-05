# 08: Type 3 fonts, and what actually makes the PDF slow

Research for ticket `08-kill-the-type3-fonts.md`. Measured 2026-08-04 on Chrome
150.0.7871.187, Windows 11, with the 18-page Product Showcase deck.
Prototypes live in the session scratchpad; nothing in the repo was changed.

Short version: **the hypothesis is confirmed for weight and refuted for speed.**
Chrome falls back to Type 3 because the fonts are variable, and fixing that
removes 644 KB from an 18-page deck. But Type 3 is not what makes the PDF scroll
badly. That is the cover scrim: one full-bleed CSS gradient over the hero image
costs 2,7 seconds per render. Both are worth fixing and they are independent.

## 1. The cause, confirmed

### Evidence: the controlled print experiment

A two-page probe exercising Archivo 400/500/600/650/700/800 and JetBrains Mono
400/500/600/700, printed six ways through the exact command in
`tools/build-pdf.ps1`.

| Variant | @font-face src | Bytes | Font objects |
|---|---|---|---|
| A | `Archivo-var.woff2` `format("woff2-variations")`, CSS in `templates/` | 290.585 | 17 Type 3 |
| F | same, CSS moved next to the HTML (path control) | 290.585 | 17 Type 3 |
| E | same file, `format("woff2")` instead | 290.585 | 17 Type 3 |
| G | same file, **one** face at the font's own default weight 600 | 25.762 | 1 Type 3 |
| B | static instances, woff2 | 70.953 | 10 Type 0 |
| C | static instances, raw truetype | 70.791 | 10 Type 0 |
| D | no webfont, installed Arial + Consolas | 201.643 | 11 Type 0 |

Read it as follows.

- **It is the variable font file, nothing else.** Variant G is the decisive one:
  a single `@font-face`, no weight range, the font's own default axis value, no
  interpolation asked for. Still Type 3. So the trigger is the presence of
  `fvar`/`gvar` in the file, not weight synthesis, not the weight range, not the
  number of declared faces. Skia's PDF backend has no way to serialise a variable
  instance as a standard font program, so it writes every glyph as a content
  stream instead.
- **The `format()` string is irrelevant.** Variant E proves `woff2-variations`
  versus `woff2` changes nothing. This is not a src-resolution failure.
- **woff2 is irrelevant.** Variants B and C differ by 162 bytes. The container
  does not matter; variableness does.
- **Static instances fix it.** Type 0 / Identity-H with CIDFontType2 descendants,
  the normal embedded-subset path, at a quarter of the bytes.

### Candidates checked and ruled out

- **Restricted embedding permission.** Both fonts have `OS/2.fsType = 0`
  (installable). Not the cause.
- **`font-variation-settings`.** Not used anywhere in `templates/` or `library/`.
- **`-webkit-print-color-adjust`, CSS transforms or filters on text.** No text is
  rasterised: the PDF carries real text operators and `get_text()` returns the
  full 15.014 characters in both builds. Type 3 here is vector glyph procedures,
  not images of text.
- **`@font-face` src failing to resolve.** If it did, Chrome would use Arial and
  emit Type 0, as variant D shows. It emits Type 3, so the font loads fine.
- **Installing the fonts on the print machine.** Would not help: a variable font
  installed system-wide is still a variable font. Variant D only avoids Type 3
  because Arial and Consolas are static.

### The counts on the real deck

Reproduced the repo's PDF byte for byte from
`decks/product-showcase/index.html` (2.868.605 bytes, identical), then reprinted
it with static instances.

| | Base (variable) | Static instances |
|---|---|---|
| Unique font objects | 57 Type 3 | 8 Type 0 |
| Font references across pages | 185 | 125 |
| Streams under the font subtree | 1.394 | 16 |
| Bytes in those streams | 436.871 | 32.160 |
| Total PDF objects | 2.250 | 786 |

Each Type 3 font drags a `CharProcs` dictionary with one stream per glyph, plus a
`Widths` array and an `Encoding` differences array. That is where the 1.394
streams and the extra 1.464 objects come from.

## 2. What actually makes it scroll badly

Type 3 costs bytes. It does **not** cost render time here, and this is the part
of the ticket's hypothesis that does not survive measurement.

Rendered all 18 pages at 200 dpi, best of several runs, on two engines: MuPDF
(via PyMuPDF, already a repo dependency) and **PDFium**, which is the engine
inside Chrome's own PDF viewer and therefore the closest proxy for what Floris
scrolls.

Killing Type 3 moved PDFium from 4.714 ms to 4.369 ms. Within noise.

Looking at it per page showed why. Page 1 alone was 2,7 to 3,1 seconds; every
other page was 70 to 130 ms. The cover's content stream explains it: the
`.scrim` in `templates/showcase.css` stacks two or three
`linear-gradient(..., rgba(15,22,20,0.97) ...)` layers over the full-bleed hero
image, and Chrome emits each one as a **full-page tiling pattern wrapping a
ShadingType 1 (function-based) shading with alpha**, painted over a 1280 x 720
box that lands as roughly 4.000 x 2.250 device pixels. PDFium evaluates that
function per pixel, per layer, composited over the image underneath.

Isolating it, cover unchanged except the scrim:

| Cover scrim | Page 1 render |
|---|---|
| Three stacked gradients (current) | 2.671 ms |
| One gradient | 1.547 ms |
| Flat `rgba(15,22,20,0.66)` | 122 ms |

Roughly 1,3 seconds per full-bleed gradient layer. The other 17 pages also carry
one tiling pattern each, but over small areas, so they cost nothing.

This is why compressing the PDF never helped: the cost was never bytes, but it
was not glyph procedures either. It is a per-pixel shading function on the one
page you look at first.

## 3. Recommended fix

**Two changes, both in CSS and assets, neither touching the print pipeline.**

### 3.1 Ship static instances, keep the variable fonts for screen

Generate static instances from the two variable woff2 files with fontTools
`varLib.instancer`, commit them under `brand/fonts-static/`, and point the
`@font-face` blocks in `templates/deck.css` and `templates/linkedin.css` at them,
one face per weight.

Weights derived from `templates/` plus `library/`: Archivo 400, 500, 600, 650,
700, 800; JetBrains Mono 400, 500, 600, 700. Ten files, 172.920 bytes of woff2
in total. Chrome embeds only the ones a given artifact uses (8 of 10 in the
Product Showcase).

Judged against the three criteria in the ticket:

- **Fresh clone:** yes. The files are committed like the variable fonts already
  are. No new runtime dependency; fontTools and brotli are needed only to
  regenerate, and `tools/build-brand-kit.py` already depends on fontTools.
- **Vercel:** yes. `app/lib/render.mjs` runs the same Chromium either side, and
  the change is entirely in the HTML and CSS the printer is handed. Nothing about
  the serverless path is font-aware.
- **Look:** unchanged. Over all 18 pages, 0,068 % of pixels differ by more than
  16/255, at glyph edges only, from hinting rather than shape. Word x-positions
  and word widths are identical to within 0,07 pt at p95. Page count, page size
  (13,3333 x 7,5 in) and extracted text are byte-identical. Side-by-side crops at
  200 dpi are indistinguishable.

Two side benefits. The embedded fonts get real names
(`CAAAAA+ArchivoRegular` rather than an anonymous Type 3), so text extraction and
copy-paste report correct font metrics instead of MuPDF's synthesised ones. And
the object count drops from 2.250 to 786, which every downstream tool that walks
the PDF pays for.

**Rejected alternatives.**

- *Install the fonts on the print machine.* Fails all three criteria: the fonts
  are still variable so Type 3 stays, a fresh clone would need a manual install
  step, and Vercel has nowhere to install them.
- *Replace Chrome print with another engine.* Fails the Vercel test hardest and
  is a rewrite of the anchor `CLAUDE.md` explicitly calls out. It would also
  break the "output must be identical either way" contract in `render.mjs`.
- *Keep the variable font and declare a single weight.* Variant G shows it does
  not work.
- *Convert the variable fonts to static in place, dropping the variable files.*
  Works for print but takes away the screen font, and `tools/build-brand-kit.py`
  reads `Archivo-var.woff2` and pins `wght=700` to outline the wordmark. Keep
  both sets.
- *Subset harder (Latin-1 only).* Real but small. The 10 static files add about
  107 KB to a published snapshot versus the 2 variable files. Worth doing later
  if snapshot size matters; not worth blocking on.

### 3.2 Flatten the cover scrim

Replace the stacked full-bleed `linear-gradient` scrim in
`templates/showcase.css` (`.cover .scrim` and `.cover--open .scrim`) with
something that does not become a per-pixel shading function over the whole page.
Options, cheapest first:

1. A flat `rgba()` overlay. Measured: page 1 from 2.671 ms to 122 ms. Changes the
   look, so it needs Floris's eye.
2. Bake the gradient into the hero image itself at export time. Keeps the exact
   look, costs nothing at render, but ties the scrim to the image.
3. Keep one gradient rather than three. Measured 1.547 ms, still 12x the flat
   cost. Not enough on its own.

Option 2 is the one that preserves the design, and it is a `brand/img` build step
rather than a CSS change. This needs a design call, so it is called out here
rather than decided.

## 4. Measurements, before and after

18-page Product Showcase, 200 dpi, best of 3 (PDFium) and best of 5 (MuPDF).

| Build | Bytes | PDF objects | Font objects | MuPDF, 18 pp | PDFium, 18 pp | PDFium, page 1 |
|---|---|---|---|---|---|---|
| Base, as shipped today | 2.868.605 | 2.250 | 57 Type 3 | 1.115 ms | 4.714 ms | 3.083 ms |
| Static fonts only | 2.224.217 | 786 | 8 Type 0 | 1.220 ms | 4.369 ms | 2.945 ms |
| Flat scrim only | 2.864.635 | 2.237 | 57 Type 3 | 1.161 ms | 1.865 ms | 136 ms |
| **Both** | **2.220.311** | **773** | **8 Type 0** | **852 ms** | **1.643 ms** | **132 ms** |

Net effect of doing both: **22,6 % smaller** (648.294 bytes off) and **2,9x
faster to render** in the engine Chrome's viewer uses. The size win is entirely
the fonts. The speed win is entirely the scrim.

Images are 1.821.003 bytes of the remaining 2.220.311, across pages 1, 6 and 7.
That is now the dominant term and is a separate question.

## 5. Blast radius

| Touched | What happens |
|---|---|
| `templates/deck.css` | The two `@font-face` blocks become ten. The `--sans` and `--mono` stacks are unchanged. |
| `templates/linkedin.css` | Same problem, same fix. It declares the same variable files, so every printed carousel carries Type 3 today. Change it in the same pass or carousels stay heavy. |
| `templates/showcase.css` | Only if the scrim is flattened. Affects `.cover` and `.cover--open` on every deck with a full-bleed cover. |
| `brand/fonts-static/` | New committed directory, 10 woff2, 172.920 bytes. A small generator tool should live in `tools/` so it can be regenerated and `--check`ed, mirroring `build-brand-kit.py`. |
| `brand/fonts/` | Unchanged. The variable files stay for screen and for the brand kit. |
| `tools/build-brand-kit.py` | Untouched, provided the variable files stay. It reads `Archivo-var.woff2` and pins `wght=700` to outline the wordmark, and it ships both variable files inside `oppr-brand-kit.zip`. If anyone later deletes the variable fonts, the brand kit breaks. |
| `tools/snapshot.py` | Untouched in code. It inlines anything in `_FONT_EXT` as a data URI, so the new files are picked up automatically. Published snapshots grow by about 107 KB raw, roughly 142 KB after base64. |
| `tools/verify-deck.py`, `tools/verifylib.py` | No font rules exist in either. Page geometry is unaffected: 18 pages at 13,3333 x 7,5 in before and after, extracted text identical. Nothing to change, but re-run the gate. |
| `tools/build-carousel.ps1`, `tools/verify-carousel.py` | Same print command, so they inherit the fix through `linkedin.css`. Re-verify a carousel after the change. |
| `app/lib/render.mjs` | Untouched. Local Chrome and the serverless Chromium both get HTML and CSS; neither is font-aware. |
| `app/lib/htmlcheck.mjs` | Untouched. Fonts are not part of the structure fingerprint. |
| `requirements.txt` | fontTools and brotli are already an undeclared dependency of `build-brand-kit.py`. Adding a font generator makes that worse, so declare them. |
| Existing published artifacts | Not retroactively fixed. Every version already in `deck_versions` keeps its Type 3 snapshot. They improve only when re-saved or reprinted through the new CSS. |

## 6. What surprised me

- The Type 3 fallback fires on a variable font even when nothing is being
  interpolated. Variant G is the cleanest single result in this work.
- Type 3 costs almost nothing to render in PDFium. The intuition that a glyph
  procedure re-executes expensively is right in principle and wrong in practice,
  because the renderer caches the rendered glyph after the first execution. The
  cost really is bytes and object count.
- One CSS gradient on the cover costs more render time than every glyph in the
  whole 18-page deck put together.
