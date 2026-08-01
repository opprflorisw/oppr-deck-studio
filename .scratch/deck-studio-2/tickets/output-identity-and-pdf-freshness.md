# Output identity, naming and PDF freshness

Type: grilling · Status: open · Blocked by: One store of truth · Blocks: Status and feedback surface

## Question

Can a name be **changed** after an artifact exists, and what guarantees that the
PDF you download is the version you are looking at?

## Why it matters — the current behaviour, precisely

**Naming is fully derived and immutable from the UI.** `app/lib/jobs.mjs:91`
`pdfNameFor(deck)` builds the filename from the deck row:

- master → `oppr_<type>.pdf`
- otherwise → `<YYYY-MM-DD>_oppr_<core>[_<client>].pdf`, parsed out of `deck.slug`

The slug is minted once at publish or personalize time
(`personalize()` in `server.mjs:1103`) and there is **no rename endpoint** —
not for the title, not for the slug, not for the PDF. Floris named this directly:
"we cannot change the name of the file".

**PDF freshness is not guaranteed.** The chain is:

1. Edit → `POST /api/decks/:id/versions` → new version `n`, `current_version_n`
   moves. **No PDF is produced.**
2. `GET /api/decks/:id/versions/:n/pdf` → `materializePdf` serves the PDF stored
   on **that version row**. A version that was never built has **no** `pdf_object`
   → 404.
3. Only `POST /api/decks/:id/build` prints (headless Chrome, `--no-pdf-header-footer`,
   `--virtual-time-budget=10000`), verifies, and attaches the PDF.

So after an edit you either get a 404 or, if the UI falls back to an older
version's PDF, **a silently stale document**. Floris's instinct is right: the
download should print from the HTML you are looking at.

## What a good answer settles

- **Is the PDF printed on demand** (download → materialize current version →
  print → verify → serve, always fresh) or **eagerly on save** (every save
  triggers a build)? Trade-off: on-demand means a slow first download and a
  verify gate standing between you and your file; eager means a Chrome process
  per save.
- What happens when **verify FAILs**: today the PDF is withheld and the deck is
  flagged `needs_cli`. Is withholding still right when Floris just wants the
  file? Is there a "download anyway, marked unverified" path, and does that
  compromise the gate?
- **What is renameable**: display title only, or slug too? Slug is identity —
  it is the storage path prefix (`decks/<id>/...` is by id, but
  `social_outputs` and `publish_log` key on slug), so a slug rename may need a
  redirect or an alias.
- How a **chosen** filename coexists with the rule `verify-deck.py` enforces
  (a PDF must contain `oppr`, and a named-client deck must contain the client
  slug). Proposal to test: the user names the middle segment, the system keeps
  the date, `oppr` and client wrapper.
- Whether the app shows the filename **before** download so it can be corrected.

## Evidence to gather while resolving

- `app/lib/jobs.mjs` (`pdfNameFor`, `_run`), `app/lib/deckcache.mjs`
  (`materialize`, `materializePdf`)
- `tools/deck_pdf_name.py`, `tools/verify-deck.py` (the naming FAIL)
- `app/web/js/views/deck.js` and `viewer.js` — what the download button does now

## Execution once decided

Implement rename + the freshness rule, and make the filename visible in the UI.
