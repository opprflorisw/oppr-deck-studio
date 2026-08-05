# 11 — The cover scrim: how to stop it costing 2,7 seconds

- **type:** prototype (HITL)
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** —
- **blocks:** 10

## Question

Ticket 08 found that the deck's scroll problem is almost entirely the cover, not
the fonts. `.scrim` in `templates/showcase.css` stacks three full-bleed
`linear-gradient` layers over the hero image. Chrome writes each as a full-page
tiling pattern wrapping a ShadingType 1 function with alpha, evaluated per pixel
across roughly 4.000 x 2.250 device pixels.

Measured on the 18-page Product Showcase: **page 1 costs 2.671 ms; every other page
costs 70 to 130 ms.** Replacing the three gradients with a flat `rgba()` overlay
takes page 1 to **122 ms**, and takes the whole deck from 4.714 ms to 1.865 ms
without touching the fonts.

The fix is not in doubt. What it should look like afterwards is Floris's call,
because the scrim is what makes the cover headline readable over the photograph and
it is the first thing anyone sees.

Three candidates, in order of how much they preserve today's look:

1. **Bake the gradient into the hero image.** Pre-composite the three-stop scrim
   onto `brand/img/hero-plate.jpg` (and every other cover hero) at export time, so
   the PDF carries one image and no shading function at all. Preserves the look
   **exactly**. Costs: the scrim stops being adjustable in CSS, every hero needs a
   pre-composited variant, and the on-screen deck and the PDF must not drift apart.
2. **One gradient instead of three.** Measured at 1.547 ms for page 1: better, but
   still ten times the cost of every other page. Cheap to do, keeps the scrim in
   CSS, does not really solve it.
3. **A flat `rgba()` overlay.** 122 ms, and the cheapest possible answer. Changes
   the look: an even wash instead of a graduated one, so the headline sits on a
   slightly darker photograph than it does today.

Also settle: does this apply only to `cover` and `eng2-cover` and `eng-cover`, or
does any other slide use a multi-stop gradient over a full-bleed image? Grep
`showcase.css` and `linkedin.css` before deciding, since carousels print through
the same path.

**Prototype:** render the cover three ways at full print resolution and put them
side by side. This is a look decision and prose will not settle it.

## Answer — closed 2026-08-04

Comparison: https://claude.ai/code/artifact/f971f9af-159c-43f1-95ae-0e3dc657afa0
Harness: `scratchpad/scrim/make.py` (renders four variants from the real slide,
real CSS and real photograph) and `scratchpad/scrim/build.py`.

| | treatment | PDF | shading objects | render, 1 page |
|---|---|---|---|---|
| A | today, three gradients | 303.944 B | 4 | 159 ms |
| B | `.cover--open`, lighter | 303.924 B | 4 | 223 ms |
| **C** | **B baked into the hero** | **159.723 B** | **0** | **53 ms** |
| D | flat rgba wash | 300.160 B | 0 | 59 ms |

### The lighter cover already existed

`.cover--open` is in `templates/showcase.css`, and its own comment says the standard
scrim "loses the plant entirely". It was used by `eng-cover` and `eng2-cover`, both
retired in ticket 02, so the treatment left the library with the slides that carried
it. Applying it to `cover` needs **no new CSS and no new design-system block**: the
pattern is already documented at
`library/design-system/patterns/cover-open.html`, so the composition rule is
satisfied.

Measured effect: the right half of the image goes from **27/255** to **37/255** mean
luminance. The operator, the phone screen and the pipework become readable again,
and the headline keeps its contrast.

### Decision: C, bake it

B fixes the look and leaves the slowness in place; it is in fact the slowest of the
four. C is B composited once at export instead of recomputed on every render:

- visually indistinguishable from B (mean delta **0,94/255**, only **0,46 %** of
  pixels differ by more than 6),
- **3x faster** than today and **4x faster** than B,
- **47 % smaller**, because one JPEG replaces the photograph plus three gradient
  layers.

D was rejected as the only option that changes the design: an even wash stops the
composition leading the eye from the headline to the operator.

**The accepted cost:** the scrim stops being adjustable in CSS. Changing it becomes
a build step, with the gradient recipe kept in the repo so the composite stays
reproducible. Acceptable because the scrim is a fixed brand treatment rather than
something tuned per deck.

**Build note:** the composite must be generated per hero image at the slide's
aspect and crop (`object-fit: cover`, `object-position: 72% 38%`), so it belongs in
a tool rather than being hand-made in an image editor.

## Recommended answer to react to

Option 1, bake it in. The scrim is a fixed brand treatment rather than something
tuned per deck, so having it live in CSS buys flexibility nobody uses, and it is
the only option that changes nothing about how the cover looks. Generate the
pre-composited hero as a build step so the source image and the scrim recipe both
stay in the repo and the composite stays reproducible.
