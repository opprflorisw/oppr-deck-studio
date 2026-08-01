# Status and feedback surface

Type: prototype · Status: open · Blocked by: Output identity and PDF freshness

## Question

What does the app owe you about its own state, and where does it say it?

## Why it matters

Floris asked for "more feedback", and clarified it means **the system reporting
what happened** — not annotation. Today the system knows a great deal and shows
almost none of it.

What is already computed and hidden or under-shown:

- `verify_report` — full `{fails, warns, entries}` stored on every
  `deck_versions` row; the deck list reduces it to two counts
- `decks.status` = `needs_cli` + `needs_cli_reason` (first 3 fails, joined)
- `build_jobs` rows — the full build history, never surfaced
- `checkOverflow()` in the editor — badges the filmstrip, but only while editing
- `change_note` per version (auto-generated: "text ×3, nudge ×1") — the closest
  thing to a diff, and it is a count, not a description
- job state via `GET /api/jobs/:id`, polled during a build

## What a good answer settles

- **Is my PDF current?** The single most important status, and today it is
  unanswerable from the UI. Depends on the freshness rule chosen in *Output
  identity*.
- How a **verify FAIL** reads. `verify-deck.py` emits machine strings; Floris
  needs "slide 7 overflows" and "this deck names Attero but is only cleared for
  Holliday", not a raw list.
- Whether **what changed between versions** should be a real diff (text-level,
  slide-by-slide) or whether a richer `change_note` is enough.
- Where status lives: a badge per deck in the list, a panel on the deck page, a
  global activity feed, or all three. Avoid inventing a fourth place —
  *Navigation* will have opinions.
- What happens to **build history** (`build_jobs`) — surfaced, or deleted as
  unused (the map's Notes say unreferenced things go).
- WARN vs FAIL: today `verify-deck.py` WARNs on Anglo number formatting and blank
  pages. Does a WARN need to be dismissible, or does it nag forever?

## How to resolve

`/prototype`. Take a deck that currently fails verify and one that passes, and
mock the status surface for both. The crux is what the failing case should look
like.

## Evidence to gather while resolving

- `app/lib/jobs.mjs` `_run()`, `tools/verify-deck.py` output shape
- `app/web/js/views/deck.js`, `history.js`, `decks.js`
