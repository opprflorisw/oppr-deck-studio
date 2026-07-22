# linkedin/ — brand-styled LinkedIn carousels + post text

Outputs for LinkedIn, made through `/deckbuilder` ("I want a LinkedIn
carousel/post"). Each lives in `linkedin/<YYYY-MM-DD>_<slug>/`:

- `index.html` — the carousel pages, composed from `templates/linkedin.css`.
- `<date>_oppr_<slug>.pdf` — the 4:5 document-post PDF (built + committed).
- `post.txt` — the accompanying post text, ready to paste.

## Format facts (from research ticket 05, mid-2026)

- A carousel is a **document post**: upload the **PDF**. Best-practice page is
  **1080 x 1350 (4:5 portrait)** — set by `@page` in `templates/linkedin.css`.
  8&ndash;10 pages, one idea per page, body type large (the template uses 38px+
  on the 1080 canvas). Keep the file well under LinkedIn's limits (100 MB / 300
  pages is the hard cap; ours are ~120 KB).
- **Post text**: the hook must land in the **first ~140 characters** (the mobile
  &ldquo;see more&rdquo; fold). Single blank line between paragraphs (LinkedIn
  collapses doubles). 0&ndash;3 hashtags. Put any link on the CTA page or in the
  first comment, not mid-post.
- **Unicode bold** (Mathematical Alphanumeric letters) is used **sparingly**:
  1&ndash;3 short phrases per post, never on numbers or searchable keywords.
  Screen readers spell it letter-by-letter and LinkedIn search can&rsquo;t index
  it. `post.txt` follows this rule.
- Post from **Floris&rsquo;s personal profile** (far more reach than the Company
  Page); mirror on the Oppr Page if useful.

## Rules (same wall as decks)

- **Public by definition.** LinkedIn is external, so **no named-customer or
  mutares-family material** ever goes in a carousel or post. Entitlement gating
  applies fully.
- Brand voice and formatting hold: no em dashes (en dashes for numeric ranges
  are fine), European numbers (&euro; 50.000 &middot; 0,5%), payback labelled
  illustrative and conservative, Capture &rarr; Connect &rarr; Execute framing.
- New page patterns compose from the documented carousel blocks in
  `templates/linkedin.css` (`.lpage--hook`, `.lpage--point`, `.lpage--cta`,
  `.lstat`, `.lband`). Need a new one? Add it to `linkedin.css` first.

## Build

```
.\tools\build-carousel.ps1 -Carousel linkedin\<date>_<slug>
```
Renders `index.html` to the 4:5 PDF via headless Chrome/Edge, deriving a name
that always carries `oppr`. Then do the visual pass (each page at feed size:
readable type, no overflow, the hook reads in the first second).
