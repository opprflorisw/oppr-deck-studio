# library/icons/ — the reusable Oppr icon set

One place for every line-icon used in Oppr decks, slides and carousels, so we
**reuse** them instead of drawing a new SVG every time. These are bespoke,
hand-authored (not from a third-party icon font), and consistent by construction.

## What an icon is

`library/icons/<name>.svg` — a single, self-contained SVG:

- **24×24** viewBox, `width`/`height` 24 (override with CSS).
- **Stroke-only**: `fill: none`, `stroke: currentColor`, `stroke-width: 2`,
  round caps and joins. No fills, no hard-coded colors.
- Because stroke is `currentColor`, the icon takes **whatever colour you set**
  on it (or inherits from its parent's `color`).

`icons.json` describes each icon (name, category, description, keywords,
suggested_use) — the retrieval manifest, mirrored to the app's Icons view.

## How to use one in a slide (the reuse mechanism)

Write the token **`{{icon:NAME}}`** in a slide fragment. `assemble-deck.py`
inlines the SVG from `library/icons/NAME.svg` at build time (an unknown name is a
hard error, like an unfilled variable). Wrap it and size/colour with CSS:

```html
<span class="di" style="color: var(--accent)">{{icon:mic}}</span>
```

- **Size**: control with CSS on the wrapper (`.di svg { width: 28px; height: 28px }`)
  — decks use ~22–28px. The `.di` helper in `templates/showcase.css` sets a sane
  default.
- **Colour**: set `color` (or `stroke`) on the wrapper. Use the brand roles:
  `var(--accent)` (terracotta, the human voice — Capture), `var(--machine)`
  (teal, the machine voice — Connect), `var(--verified)` (green, a verified
  result — Execute / done), or `#fff` on a dark ground. One accent per element.

Carousels (`templates/linkedin.css`) use the same tokens; the icon inherits the
block's colour (e.g. the `.lcheck` tick is `currentColor` = accent).

## The set

Grouped by category (see `icons.json` for the full descriptions):

- **cce** (the Capture → Connect → Execute framework): `mic` (Capture),
  `connect` (Connect), `execute` (Execute), `loop` (the improvement loop).
- **outcome / proof**: `check`, `check-circle`, `target`, `bars`.
- **context**: `clock`, `card`, `globe`, `layers`, `shield`, `flame`, `spark`.

## Adding or remaking an icon

1. Draw it at **24×24, stroke-only** (start from an existing icon so weight and
   corner radius match). No fills; keep it to the essential lines.
2. Save as `library/icons/<name>.svg` with the standard header
   (`fill="none" stroke="currentColor" stroke-width="2"` round caps/joins).
3. Add an entry to `icons.json` (name, category, description, keywords,
   suggested_use in Oppr's vocabulary).
4. Regenerate the app index (`tools/build_app_index.py`, or the app's **Refresh**)
   so it appears in the Icons view. Use it via `{{icon:<name>}}`.

**Consistency rule:** never paste a one-off `<svg>` into a new slide. If the icon
you need is not here, add it here first, then reference it. That is what keeps the
whole deck system's iconography uniform.
