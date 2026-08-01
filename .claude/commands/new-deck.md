---
description: Intake -> proposed plan -> approval -> assemble a new deck variant from the library
---

# /new-deck — make a new deck by personalizing the library

You are running the Oppr Deck Studio intake workflow. You **propose a plan and
wait for Floris's approval before building anything.** You may write ONLY inside
`decks/`. Never modify `library/`, `types/` skeletons, or
`decks/` from this command — that is Edit mode (`/edit-canonical`).

Read `SPEC.md` sections 5–7 and `CLAUDE.md` if you need context. Then:

## Step 0 — Check the dump inbox
If `dump/` has anything besides `.gitkeep`, offer to run `/ingest-dump` first: it
files past decks / event material / images into their homes and pre-fills the
brief from any audience/goal notes it finds. Ingest, then continue with the
extracted brief and the newly available library slides/images. If `dump/` is
empty, skip straight to Step 1.

## Step 1 — Choose the type
List the recipes in `types/`. Ask which type this deck is, or whether it is a new
type. If new, create `types/<slug>/recipe.md` first by interviewing (seed it from
the closest existing recipe). Load the chosen `recipe.md` — its skeleton and fixed
choices drive everything below.

## Step 2 — Intake questions
Ask these in one compact pass (fill any the user already gave; take defaults from
the recipe):
1. Audience — company, role, what they already know of Oppr.
2. Named client? name, "prepared for" line, logo — **requires entitlement clearance**.
3. Language — en / fr / de / nl / …
4. Entitlement — public, or cleared for a named customer? Clearance is one slug
   per customer (`holliday`, `attero`, `wavin`, …); a deck must be cleared for
   exactly the customers it names or shows.
5. Goal & emphasis — full vs. teaser; numbers-heavy vs. illustration-heavy; the one action the audience should take.
6. Presenter from Oppr's side.
7. Length target and date of use.

## Step 3 — Propose the plan (HARD approval gate)
Read the recipe skeleton, each candidate slide's `library/slides/<id>/meta.yaml`,
and `brand/img/library.json`. Present ONE table and stop for approval:

| # | role | plan | source | note / variable values |
|---|------|------|--------|-------------------------|
| 1 | cover | reuse | cover | cover_meta = "<Type> · <Month Year> · Confidential · oppr.ai" |
| … | … | reuse / adjust / new | `<slide-id>` or — | what changes; images chosen BY MEANING from library.json |

Also state: the `deck_footer` and `deck_title` values, the language, the
entitlement clearance, and which images you'll pull (by their manifest
`description`, honoring `entitlement`). **Do not proceed until Floris approves or
edits the plan.**

## Step 4 — Assemble the variant
Create `decks/YYYY-MM-DD_<purpose-or-client-slug>/` containing:
- `brief.md` — the intake answers + the approved plan (this deck's contract).
- `deck.yaml` — `title`, `type`, `vars` (deck_footer, cover_meta), optional
  `allowed_entitlements` (e.g. `[public, holliday]` only if cleared), and
  the ordered `slides` list.
- For any **adjust** or **new** slide, write the fragment to
  `slides/<id>/slide.html` inside the variant folder (local override — never edit
  the library). Keep the `{{deck_footer}}`, `{{total}}`, `{{asset}}` placeholders
  so it composes like any slide; new slides must use only documented design-system
  blocks (see `/edit-canonical` and `library/design-system/`).
- `manifest.yaml` — provenance: `type`, `canonical` (tag or path), `assembled`
  date, `language`, `entitlement`, and the list of slide ids with the git commit
  short-hash of each fragment used.

Then run:
```
python tools/assemble-deck.py decks/YYYY-MM-DD_<slug>
```
It fails loudly on any unfilled `{{placeholder}}`.

## Step 5 — Build + verify
```
.\tools\build-pdf.ps1 -Deck decks\variants\YYYY-MM-DD_<slug>
python tools/verify-deck.py decks/YYYY-MM-DD_<slug>
```
Fix any FAIL and rebuild. Then do the visual pass CLAUDE.md requires: render each
page and actually look — overflow, footers, images, page numbers. A WARN about a
verbatim euro quote is fine.

## Step 5b — Publish to the backend (v3)
The deck's living home is the backend, not this folder. Publish the verified deck:
```
python tools/publish-deck.py decks/YYYY-MM-DD_<slug> `
    [--customer <slug>] [--derived-from <deck-slug> [--derived-from-version N]]
```
Use `--customer` for a named-client deck (it links/creates the customer row),
`--derived-from` when this deck was built from an existing deck/master. After
publish the deck appears in the app, where Floris fine-tunes and re-prints it.
Building **from an existing deck** (reproduction): first
`python tools/fetch-deck.py <slug>` and read the fetched HTML as content source.

## Step 6 — Record + learn
The published version is an immutable snapshot (the old "frozen variant" rule is
now versions). The repo `decks/` copy is a working artifact; commit it if you like:
```
git add decks/YYYY-MM-DD_<slug> && git commit -m "variant: <slug> from <type>@<tag>"
```
Finally ask: **anything to feed back into the brain?** A per-type lesson appends to
`types/<type>/recipe.md` `## Learnings`; a cross-cutting style lesson goes to a
`memory/` file (see [[deck-management-level-style]]). That closing question is what
keeps the brain living.

## Hand back to the app

A build is not finished when the file exists; it is finished when Floris can see
it. Close every run by naming where:

> Published as `<slug>`. Open it at **http://127.0.0.1:4173/#/decks** — Edit to
> change any wording, Download PDF when it reads right.

Then delete `decks/<slug>/`: it was build scratch, and the deck now lives in the
backend.
