# One store of truth

Type: grilling · Status: open · Blocks: Artifact model, Output identity, The purge, Docs match reality

## Question

For every kind of content Deck Studio holds, **which store owns it** — git, the
Supabase backend, or the local materialization cache — and what happens to the
material that is currently in the wrong one?

## Why this is first

Three stores are fighting, and every other ticket inherits the answer:

1. **Git** owns the tool: `library/slides/`, `library/design-system/`,
   `library/icons/`, `templates/`, `brand/`, `tools/`, `types/`, `knowledge/`.
2. **Supabase** owns content since v3: `decks` + `deck_versions` (immutable
   versioned self-contained HTML), `deck_assets`, `customers`, `publish_log`,
   `social_outputs`, plus Storage objects.
3. **Local disk, untracked**, owns a shadow copy that nobody decided on:
   - `decks/canonical/engagement`, `engagement-v2`, `engagement-v3`,
     `engagement-v4` — **folder-suffix versioning**, running in parallel with
     `deck_versions.n`. This is the concrete face of "we are digressing".
   - `decks/canonical/proposal`, `decks/variants/2026-08-01_wavin-rnd`,
     `decks/drafts/2026-07-23_duinrell`
   - `social/drafts/*` (3), `social/linkedin/*` (2)
   - `app/.deck-cache/<deck-id>/v<n>/` — materialized HTML + assets + PDFs
   - `references/`, `screenshots/`

CLAUDE.md already says the repo is "tool-only" and that "a file written to the
repo is invisible to Floris" — but the disk says otherwise, and the CLI still
builds into `decks/<...>` before publishing.

## What a good answer settles

- Whether `decks/` and `social/` remain **build scratch** (CLI assembles there,
  publishes, then the folder is disposable) or stop existing entirely.
- The fate of `engagement-v2/-v3/-v4`: are these real, un-published iterations
  that must be reconciled into `deck_versions`, or abandoned experiments to
  delete? (Check the backend before deciding: query `decks` + `deck_versions`.)
- Whether `app/.deck-cache/` is pure cache (safe to wipe at any moment,
  rebuildable from the backend) — and whether anything currently depends on it
  surviving.
- Whether **git tags** `canonical/<type>@vN` still mean anything now that masters
  are a tag on a backend row, or are a leftover to retire.
- What "version control" means in 2.0, stated in one sentence per store.
- The one-line rule a future session can apply without re-deriving any of this.

## Evidence to gather while resolving

- `python -c "..."` against `decks` / `deck_versions` to see what the backend
  actually holds vs. what is on disk.
- `git tag -l 'canonical/*'`
- `tools/publish-deck.py`, `tools/fetch-deck.py`, `app/lib/deckcache.mjs`
- `.gitignore` lines 30-45 (the v3 content block)

## Execution once decided

Reconcile or publish anything untracked that survives, then delete the rest;
update `.gitignore` and `decks/CLAUDE.md` / `social/CLAUDE.md` to state the rule.
Do not delete untracked material until it is confirmed in the backend.
