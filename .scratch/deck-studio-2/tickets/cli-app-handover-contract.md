# The CLI and app handover contract

Type: grilling · Status: open · Blocks: Command surface consolidation, Navigation and discoverability, Docs match reality

## Question

"CLI creates · app changes and ships" is settled in principle. What is the
**exact verb list on each side**, and **how does each side hand over** so the
boundary is visible from both directions instead of being folklore?

## Why it matters

The boundary already exists in code (`app/lib/htmlcheck.mjs` rejects structural
saves; `editor.js` pops a modal telling you to run `/deckbuilder edit <slug>`),
but it is invisible until you hit it. Floris did not know the editor existed at
all — the wall is currently enforced without ever being announced.

## What a good answer settles

- The **complete verb list per side**, with no verb appearing on both:
  - CLI creates: new deck, new carousel/post/article, structural slide change,
    new library element, ingest, image generation, research runs.
  - App changes and ships: edit text/spacing/images, rename, regenerate PDF,
    download, publish, mark posted, browse, personalize.
  - Contested today and needing a ruling: **personalize** (currently in the app,
    `POST /api/decks/:id/personalize`), master toggle, customer intake
    (`POST /api/customer-intake` stages to `dump/_app/`), research sync.
- **App → CLI handover**: today a modal shows a paste-able prompt. Is that the
  standard everywhere? Does it copy to clipboard? Does it carry enough context
  (deck slug, version, what was attempted) for the CLI session to act without
  re-asking?
- **CLI → app handover**: today a build ends with a publish step and nothing
  tells you to go look. Should every CLI workflow end by naming the app URL for
  the thing it just made?
- How a user learns which side they are on **before** they get rejected.

## Evidence to gather while resolving

- `app/lib/htmlcheck.mjs` (what "structure-preserving" actually means)
- `editor.js` `structuralModal()`
- `.claude/commands/*.md` — where each command's tail leaves you
- The v3 rule block at the end of the root `CLAUDE.md`

## Execution once decided

Write the contract into the root `CLAUDE.md` as a single table, then make both
sides obey it (handover text in the app, closing line in each command file).
