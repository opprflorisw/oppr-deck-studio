# 01 — Where the deck recipe lives (keystone)

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** —
- **blocks:** 03, 04, 05, 07, 08

## Question

Flag-and-accept needs something, somewhere, that knows **which decks use which
slides at which version**. Today nothing does.

`deck.yaml` holds the slide list, but it lives in `decks/<slug>/`, which is
build scratch that gets deleted after publish (`CLAUDE.md`, layer 4). The
published snapshot stamps `data-slide-id` on every `<section>`, so parentage
survives per page, but the *recipe* (the ordered chapter picks, the variable
values, the entitlement clearance) does not.

Decide where the recipe lives, and settle these with it:

- Is the recipe a **row in the backend** (a `deck_recipes` table, or JSON on the
  `decks` row), **derived on demand** from `data-slide-id` in the current
  version's HTML, or **both** (row is truth, HTML is the check)?
- Does the recipe belong to the **deck** or to the **version**? A version is
  immutable; if the recipe is versioned, accepting an update is just a new
  recipe plus a new render. If it belongs to the deck, history gets murkier.
- Does `deck.yaml` survive at all, or does the CLI start writing the recipe
  straight to the backend and stop pretending the folder matters?
- What does the drift query look like: "given library slide X changed, which
  decks are now behind?" It has to be one cheap query, not a scan of every
  version's HTML.

This is the keystone. Chapters (02) can be defined without it, but nothing about
propagation, the app surface, customer decks or migration can be settled until
the recipe has a home.

## Answer — closed 2026-08-04

### The premise of this ticket was wrong: the recipe already exists

`tools/snapshot.py` embeds a `deck-meta` JSON block in every published version.
Management Outlook v2 carries:

```json
{"type":"management-outlook","client":"","allowed_entitlements":["public"],
 "slides":[{"id":"cover","role":"cover"},{"id":"when-time-matters",...}]}
```

Ordered slide ids with roles, plus type, client and clearance. Two of the four
questions therefore answer themselves:

- **The recipe belongs to the version.** It is already embedded per version and a
  version is immutable, so accepting an update naturally produces a new version
  with a new recipe. No decision required.
- **`deck.yaml` is input only.** Every reader was checked (`assemble-deck.py`,
  `deckstudio.py`, `publish-deck.py`, `deck_pdf_name.py`); all read it at build
  time and nothing reads it back. It survives as the CLI's input format and gains
  a `chapters:` key. It is not, and never was, a store.

What is actually missing is narrower: the recipe is **not queryable**, has **no
chapters**, and has **no content hashes**.

### What gets built

**One column, not a new store.** `deck_versions.recipe` (JSONB), written at
publish, holding per page `{chapter, slide_id, content_hash}` plus the deck-level
type, client and clearance. The embedded `deck-meta` block stays exactly as it is
and becomes the independent cross-check: verify can compare the column against the
rendered HTML and FAIL when they disagree. This matches what every tool in the
ticket 07 scan actually shipped, which was parentage inside the artefact, and adds
the server-side query none of them have.

**Drift is a hash comparison, not a version number.** The recipe records the
library slide's content hash as published; drift is `current library hash ≠ stored
hash`. No library version bookkeeping, no migration of `library/`, and it agrees
with ticket 04's recommendation.

**The drift query** is one indexed lookup over the current version of each deck,
rather than downloading and regex-parsing every version's HTML, which is the only
way to ask the question today.

### Decided: any change flags

Floris: *"any change, but with the notification that the new decks then need to be
updated, and the old ones are snapshots in PDF that i can share with customers.. so
those dont change of course."*

So the flag means **"the next version of this deck would differ"**. It is a
suggestion about the future, never an edit to the past. This is the safety property
that makes "flag on any change" tolerable, and it must hold in the build:

- A flag **never mutates** a published version, its HTML, or its PDF.
- A deck already sent to a customer stays byte-identical until Floris accepts.
- Accepting creates a **new version**; the old version and its PDF remain valid,
  shareable and downloadable.

Graded flags and deliberate slide-publishing were both rejected: the first guesses
at what matters, the second reintroduces exactly today's failure, where a fix you
forget to promote never reaches any deck.

## Recommended answer to react to

Recipe as a **versioned row**: `deck_versions` gains a `recipe` JSON column
holding the ordered chapter picks plus the variable values, and the CLI writes it
at publish. `data-slide-id` in the HTML stays as the independent check, so verify
can FAIL when the recipe and the rendered HTML disagree. `deck.yaml` stays as the
CLI's input format only, and stops being anything anyone reads back.
