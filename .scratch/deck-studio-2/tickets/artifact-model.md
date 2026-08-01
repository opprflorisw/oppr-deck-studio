# Artifact model

Type: grilling · Status: open · Blocked by: One store of truth · Blocks: Editor coverage, Verify gate unification, Navigation, The purge

## Question

Are a deck, a LinkedIn carousel, a post and an article **one kind of thing with
different shapes**, or genuinely different objects — and which answer lets the
edit → verify → PDF loop cover all of them without special cases?

## Why it matters

Floris asked for the editor to cover everything. Today only decks can be edited:
they live in `decks` + `deck_versions` with immutable versions, assets, verify
reports and a build job. Social output lives in a different table
(`social_outputs`) with a different shape, reached through
`social/<channel>/<date>_<slug>/`, built by `tools/build-carousel.ps1`, gated by
`tools/verify-carousel.py`, and edited by nothing.

"Editor covers everything" is cheap if they unify, and expensive if they do not.

## What a good answer settles

- Whether `social_outputs` folds into `decks` (one table, a `kind` column:
  `deck` | `carousel` | `post` | `article`) or stays separate with a shared
  interface.
- What the **invariant core** is that every artifact must have for the loop to
  work: self-contained versioned HTML + bundled assets + a page/frame model + a
  verify report + a printable output. Which artifact types genuinely cannot
  satisfy it (a plain text LinkedIn post has no HTML and no PDF — is it an
  artifact at all, or a field on one?).
- What a **page** is across types: a slide (13.333 × 7.5 in), a carousel frame
  (4:5), an article body (one flowing page), a hero image (1200 × 627).
- Whether **drafts** are a status on an artifact or a separate staging concept
  (`social/drafts/`, `decks/drafts/` exist today and are deliberately unpublished).
- Migration cost, stated concretely, if unification is chosen.

## Evidence to gather while resolving

- Supabase: `list_tables` for `decks`, `deck_versions`, `deck_assets`,
  `social_outputs`, `publish_log`
- `tools/migrate-content.py`, `tools/publish-deck.py`
- `templates/linkedin.css` vs `templates/deck.css` + `showcase.css`
- `app/web/js/views/social.js` (454 lines — the largest view, and the one that
  still imports the pre-v3 builder modules)

## Execution once decided

Write the model into `CLAUDE.md`. Any schema change is a Supabase migration plus
a matching update to `publish-deck.py` / `migrate-content.py`; do not migrate
data until the decision is recorded.
