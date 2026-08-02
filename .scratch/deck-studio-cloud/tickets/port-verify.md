# Port the verify gate off Python

Type: prototype · Status: open · Frontier

## Question

What does `tools/verifylib.py` become when it has to run where there is no Python?

## Why it matters

The gate is what stops a broken or leaking artifact shipping, and Deck Studio 2.0
just made it the single source of truth for every artifact type. The app calls it
by shelling out to `python tools/verify-deck.py`. In a serverless function there
is no Python and no repo checkout.

## What a good answer settles

- **Port, or run it as a service?** Porting to JS means one rule set living in two
  languages unless the Python side is retired — and the CLI still uses it. The
  alternative is a small containerised verify service both call, which keeps
  exactly one implementation.
- If porting: the PDF checks are the hard part. `_check_pdf` uses **PyMuPDF**
  (`fitz`) for page count, page size and the blank-page pixel scan. Page count and
  size are straightforward in JS; the blank-page WARN needs raster access.
- The HTML checks (em dashes, unfilled placeholders, name leaks, entitlement,
  euro formatting, footer discipline, `data-total`) are regex and DOM work and
  port cleanly.
- **`PAGE_FORMATS` must not fork.** Whatever happens, one table of page
  geometries, not two that drift apart. This map exists partly because duplicated
  rules caused the last drift.
- Whether the CLI switches to the ported gate so there is genuinely one
  implementation.

## Evidence

- `tools/verifylib.py` (~330 lines), `tools/verify-deck.py`, `tools/verify-carousel.py`
- `app/lib/jobs.mjs` `_run()` — how the report is parsed and stored today
