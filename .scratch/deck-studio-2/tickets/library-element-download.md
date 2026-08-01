# Library element download

Type: prototype · Status: open · Frontier

## Question

Which library elements can be downloaded on their own, in which formats, and
what does a downloaded element have to carry to be usable outside a deck?

## Why it matters

Floris asked for "being able to download single elements by itself". The Library
area today is browse-only: slides, images, icons and design-system blocks are
shown but the only way to get one out is a full deck build.

What exists to download from:

- `library/slides/<id>/` — `slide.html` fragment + `meta.yaml` + `thumb.png`
- `library/icons/` — the line-icon set + `icons.json`, used via `{{icon:NAME}}`
- `library/design-system/blocks/*.html` + `patterns/*.html` — specimens
- `brand/img/` — images with `library.json` (entitlement, description, tags)

## What a good answer settles

- **Which elements**: slide, design-system block, icon, image, whole deck page,
  a carousel frame. All four, or is one of them the real need?
- **Which formats per element**, and what each is for:
  - HTML fragment — pasting into another deck; needs `{{variables}}` either
    filled or documented, and needs its CSS
  - **Self-contained HTML** — inlined `deck.css` + `showcase.css` + fonts +
    images; opens anywhere. Same technique `publish-deck.py` already uses.
  - PNG — dropping into a doc or an email; needs a headless render at a stated
    size
  - PDF — a one-page handout
  - SVG — icons only
- A slide fragment alone is **useless without its CSS**: it will render unstyled.
  So does "download a slide" mean the fragment, or the self-contained page? This
  is the crux.
- **Entitlement on the way out.** Slides and images carry an `entitlement`.
  A download bypasses the deck-level `allowed_entitlements` check that
  `POST /api/decks/:id/assets` performs. What is the rule for a bare element
  leaving the system?
- Where the button lives, and whether one control with a format menu beats four
  buttons.

## How to resolve

`/prototype`. Build the download for one slide in two candidate formats, look at
the result, and let the artifact settle the format question.

## Evidence to gather while resolving

- `tools/publish-deck.py` — the existing inline-and-bundle routine
- `tools/build_app_index.py`, `app/index.json` — what the app already knows about
  each element
- `app/web/js/views/slides.js`, `icons-view.js`, `design-system.js`, `graphics.js`
- `tools/build-social-image.ps1`, `tools/pdf-thumbs.py` — existing render paths
