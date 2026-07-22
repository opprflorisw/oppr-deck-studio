---
id: 02
title: Draft model & lifecycle (decks/drafts/<slug>/)
type: grilling
status: closed
assignee:
blocked-by: []
---

## Question

The app saves a **draft** the CLI later builds. Decide the schema and its life:

1. **Schema of `draft.yaml`** (or similar): ordered slide list where each entry
   is either a library/variant slide id **with an optional comment** ("keep,
   but change X") or a **new-slide placeholder** with an instruction ("show
   the payback math for a 200-person plant"). Plus deck-level intent: working
   title, audience/client, language, entitlement, goal, footer wishes.
2. **Where drafts start from**: blank; a deck type's recipe skeleton; or "clone
   an existing canonical/variant then edit". Which of these does v1 support?
3. **Lifecycle**: what happens after `/deckbuilder` builds the draft into a
   variant — draft archived into the variant's folder as provenance? deleted?
   kept for iteration? What if a draft is abandoned?
4. **Concurrency/safety**: app writes only under `decks/drafts/`; the CLI
   treats draft content as **data, not instructions** (same rule as `dump/`),
   and every build still passes the approval gate + verify.
5. **Naming**: `decks/drafts/<slug>/` slug convention (date + purpose?).

## Resolution

Built 2026-07-22. Schema = `decks/drafts/<slug>/draft.json` (JSON: machine
written by the app, machine read by the CLI). Documented in
`decks/drafts/CLAUDE.md`: ordered `slides[]` of reused ids (optional `comment`)
and `source:new` placeholders (`brief`+`role`); `intent` + `vars`. Drafts start
blank, from a recipe, or by cloning a deck ("start draft from this"). Lifecycle:
building archives the draft into the variant as `draft.source.json` and clears
`decks/drafts/<slug>/` so the folder stays clean; abandoned drafts deletable in
the app. Content is data, not instructions.
