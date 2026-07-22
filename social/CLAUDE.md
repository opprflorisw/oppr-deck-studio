# social/ — outward channel output (carousels, posts, images, thumbnails)

Everything Oppr publishes on a social channel lives here, made through
`/deckbuilder` ("I want a LinkedIn carousel/post", etc.). One folder per channel:

- `social/linkedin/<date>_<slug>/` — carousels (4:5 PDF + `post.txt`), posts,
  articles.
- `social/youtube/<date>_<slug>/` — thumbnails (1280×720).
- `social/x/…`, future channels beside these.
- `social/drafts/<slug>/draft.json` — a social draft staged by the app, built by
  the CLI, then cleared (same staging discipline as `decks/drafts/` and `dump/`).

Each built output carries `oppr` in its filename (see the naming rule in the root
`CLAUDE.md`). Best-practice facts and Oppr's own usage rules for each format live
in `knowledge/best-practices/<type>.md` and are the source the workflow reads.

## Non-negotiable: social is public

Social is external, so **no named-customer or mutares-family material** ever
appears in a carousel, post, image or thumbnail. Entitlement gating applies
fully: the app only offers **public** graphics for social, and `verify` refuses
anything above public clearance. Brand rules hold: no em dashes (en dashes for
numeric ranges are fine), European numbers (€ 50.000 · 0,5%), payback labelled
illustrative and conservative, Capture → Connect → Execute framing.

## LinkedIn carousel (the proven path)

- A carousel is a **document post**: upload the **PDF**. Page **1080×1350
  (4:5 portrait)**, set by `@page` in `templates/linkedin.css`. 6–10 pages, one
  idea per page, body type large (38px+ on the 1080 canvas).
- Compose only from the documented carousel blocks in `templates/linkedin.css`
  (`.lpage--hook`, `.lpage--point`, `.lpage--cta`, `.lstat`, `.lband`). A new
  pattern graduates into `linkedin.css` first.
- Build:
  ```
  .\tools\build-carousel.ps1 -Carousel social\linkedin\<date>_<slug>
  ```
  Then the visual pass at feed size (readable type, no overflow, hook reads in
  the first second).

## LinkedIn post text

- Hook in the **first ~140 characters** (the mobile "see more" fold). Single
  blank line between paragraphs (LinkedIn collapses doubles). 0–3 hashtags. Put
  any link on the CTA page or in the first comment, not mid-post.
- **Unicode bold** (Mathematical Alphanumeric letters) only for 1–3 short
  phrases, never on numbers or searchable keywords (screen readers spell it out;
  search can't index it).
- Post from **Floris's personal profile** (far more reach than the Page); mirror
  on the Oppr Page if useful.

## Other formats

Articles, social images (1080×1080 / 1200×627 link images) and YouTube
thumbnails (1280×720) follow the same shape: a template in `templates/`, blocks
composed only from the documented set, built by a tool, named with `oppr`,
verified, human-approved. See `knowledge/best-practices/` for each.
