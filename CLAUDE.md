# CLAUDE.md — Oppr Deck Studio

System for creating and maintaining Oppr sales/marketing decks as HTML, composed
from a reusable slide + image library, fine-tuned in Claude Code, printed to PDF
for sharing. Owner: Floris Wyers (floris@oppr.ai). Mirrors the oppr.ai brand.

This repo is **self-describing on purpose**: everything Claude needs to operate it
lives in checked-in files (this manual, the per-folder `CLAUDE.md`s, the two
command files), never only in a chat history. A fresh session in a clean clone
should be able to build a deck from these docs alone.

## The five layers

1. **Brand system** — `templates/deck.css` + `templates/showcase.css` (tokens,
   fonts, footer + page counter, building blocks) and `brand/`. See `brand/BRAND.md`.
2. **Element library** — `library/slides/<id>/` : every slide as a portable
   `slide.html` fragment + `meta.yaml`. `brand/img/library.json` : every image
   described so it can be retrieved by meaning. See `library/CLAUDE.md`.
3. **Deck types (recipes / the "living brain")** — `types/<type>/recipe.md` : the
   reusable brief per presentation type (goal, audience, skeleton, learnings).
   See `types/CLAUDE.md`.
4. **Canonical decks + frozen variants** — `decks/canonical/<type>/` are the
   masters (a `deck.yaml` composition); `decks/variants/<slug>/` are frozen,
   shipped snapshots. See `decks/CLAUDE.md`.
5. **Workflows** — `.claude/commands/new-deck.md` (Personalize) and
   `.claude/commands/edit-canonical.md` (Edit). The wall between them is real:
   Personalize writes only in `decks/variants/`; Edit changes the system itself.

The full design rationale is `.scratch/deck-tool/SPEC.md`.

## Setup (fresh clone)

```powershell
pip install -r requirements.txt   # PyYAML, pypdf, PyMuPDF (fitz), Pillow
```
Rendering also needs **Google Chrome or Microsoft Edge** installed (HTML → PDF/PNG).
The workflows are driven from the **Claude Code CLI**: `/new-deck` (make a deck) and
`/edit-canonical` (change the system). `/new-deck` has a hard approval gate — an
unattended run stops at the proposed plan and waits for a human to approve before building.

## How a deck is composed

A deck is not hand-written HTML. `deck.yaml` lists an ordered set of library slide
ids + deck-level variable values; `tools/assemble-deck.py` fills each fragment's
`{{variables}}` and writes a self-contained `index.html`.

Variables filled at assembly: `deck_title`, `deck_footer`, `cover_meta` (from
deck.yaml), `total` (computed slide count), `asset` (relative path to repo root,
computed from the output location). **Any unfilled `{{placeholder}}` is a hard
error** — none ever reaches a PDF. Variants may hold local slide overrides under
`decks/variants/<slug>/slides/<id>/slide.html` that win over the library.

## Build & verify (MANDATORY before calling a deck done)

```powershell
python tools\assemble-deck.py decks\<canonical-or-variant-path>
.\tools\build-pdf.ps1 -Deck decks\<...>
python tools\verify-deck.py decks\<...>
```

`verify-deck.py` is the automated gate (SPEC.md §9): page count == slide count ==
every `data-total`; page size 13.333×7.5 in; **zero em dashes**; zero unfilled
`{{...}}`; footer discipline; images resolve and their entitlement ≤ the deck's
clearance (no customer-name leaks); WARNs on Anglo euro formatting and blank pages.
Then still do the **visual pass**: render each page and actually look (overflow,
footers, images, page numbers). A WARN about the verbatim `€ 55,000` quote is fine.

Regenerate the browsable surfaces after changes:
`.\tools\build-slide-catalog.ps1` (slide catalog) · `.\tools\build-asset-index.ps1`
(image contact sheet + manifest drift check).

## Rules

- **Footer discipline.** Content slides carry `.slide-foot` (wordmark, deck meta,
  `.pageno` with `data-total`). Roles `cover`, `closer`, `cta` have no footer.
  `verify-deck.py` enforces this by role.
- **Personalization is variables, not editing.** Audience-specific content
  (prepared-for, footer, cover meta, client) is expressed as `{{variables}}` in
  deck.yaml, or as a variant-local slide override — never by editing the library
  from `/new-deck`. Named customer material only in decks cleared for it: the
  `entitlement` field in `brand/img/library.json` and `allowed_entitlements` in
  deck.yaml enforce this mechanically (Holliday/Venator → `mutares-family` only).
- **Brand + canonical language** live in `brand/BRAND.md` — colors, type, the
  Capture → Connect → Execute framing (never LOGS/IDA/DOCS as the story),
  Analyze → Prove → Scale path, verified reference stats, current pricing. Verify
  commercial facts against Floris before reusing them.
- **Design-system composition rule.** A new slide may only use documented
  design-system blocks (`library/design-system/`). Need a new pattern? Add its
  specimen and put its CSS in `showcase.css`/`deck.css` first, then use it.
- **Tone.** Short, declarative, concrete, no hype. European number formatting
  (€ 25.000 · 0,5%). No em dashes (en dashes for numeric ranges are fine). Payback
  claims are labelled illustrative and deliberately conservative.
- **Variants are frozen.** Improving a canonical never changes a shipped variant.

## Structure

- `brand/` — BRAND.md, wordmark/icon SVGs, fonts, `img/` (with `library.json`
  manifest and generated `index.html` contact sheet)
- `templates/` — `deck.css` (system), `showcase.css` (shared deck-local styles),
  `deck-starter.html` (legacy skeleton)
- `library/` — `slides/<id>/` (fragments + meta + thumb) and generated `catalog.html`;
  `design-system/` (block specimens)
- `types/` — `<type>/recipe.md` per presentation type
- `decks/` — `canonical/<type>/` (masters) and `variants/<slug>/` (frozen)
- `tools/` — `deckstudio.py` (engine), `assemble-deck.py`, `verify-deck.py`,
  `build-pdf.ps1`, `build-asset-index.ps1`, `build-slide-catalog.ps1`
- `.claude/commands/` — `new-deck.md`, `edit-canonical.md`
- `.scratch/deck-tool/` — the wayfinder map, SPEC.md, research, migration scripts

## Versioning

The repo is under git. Canonical "best versions" are git tags
`canonical/<type>@vN`; "look back" is `git log`/`git show` on a fragment or tag.
Variants record provenance in their `manifest.yaml` (source canonical + per-slide
commit). PDFs (canonical and variant) are committed — the shipped artifact and record.

## Roadmap (agreed, not yet built — keep to the spec until asked)

- Phase-2 visual browser / deck-builder app over the catalog + plan-approval.
- Team access & sharing (deliberately deferred — see the map).
- Translation-alignment tooling for language variants.
