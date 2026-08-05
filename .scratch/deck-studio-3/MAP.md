# Map: Chapters and mother slides — Deck Studio 3

Wayfinder map. Tickets live in `tickets/NN-*.md`.
Started 2026-08-04. Driver: Floris Wyers.

## Destination

A locked spec at `.scratch/deck-studio-3/SPEC.md` describing:

1. the **chapter-based composition model** (library becomes chapters → slides; a
   deck recipe is an ordered list of chapters with a pick per chapter),
2. **mother-slide propagation** by flag-and-accept (improving a library slide
   marks every deck that uses it as behind; you accept per deck, which makes a
   new version; nothing already sent changes under you),
3. a **decided fix** for PDF weight and scroll performance.

No code changes during this map. The spec is handed to one build effort
afterwards. The map is done when nothing is left to decide.

## Notes

- **Domain:** Oppr Deck Studio (this repo). Read `CLAUDE.md` first; the layer
  list there is the current model this map is amending.
- **Skills:** `grill-me` for the HITL tickets, `prototype` for the ones that need
  something to react to.
- **Plan, don't do.** Tickets resolve decisions. No ticket edits `library/`,
  `tools/` or `app/` except a prototype clearly marked throwaway.
- **Do not commit or push.** The working tree already holds an unpushed app
  workstream awaiting Floris's go-ahead. That decision is not this map's.
- **House style applies to the map too:** no em dashes, European numbers.

## Decisions so far

<!-- one line per closed ticket; detail lives in the ticket -->

- [Destination and sharing scope](tickets/00-charting.md) — spec-then-build, not
  rebuild-in-place. Propagation is **flag-and-accept** per deck. Slides get **no
  length variants**; depth is chosen per **chapter**. A **slide refresh** (pick one
  winner per duplicate cluster) runs before chapters. Sharing target is a **fixed
  PDF**, not a shared link.
- [What other tools do about this](tickets/07-competitive-scan.md) —
  flag-and-accept is the **mainstream** answer (Figma, Templafy, Highspot,
  SlideLizard, empower); silent auto-propagation exists only where nothing is ever
  sent as a file. There are **four** override models, not three: the missing one is
  **keep both**. Overrides survive only on **stable element identity**, which is a
  new requirement on our slide format. **Nobody ships chapters**, and nobody stores
  a recipe either.
- [Kill the Type 3 fonts](tickets/08-kill-the-type3-fonts.md) — **the charting
  hypothesis was half wrong.** Type 3 costs bytes, not time: removing it entirely
  moves 18 pages from 4.714 ms to 4.369 ms, because PDFium caches each glyph after
  executing it once. The scroll cost is the **cover scrim**, three stacked
  full-bleed gradients Chrome writes as per-pixel shading functions. Page 1 costs
  2.671 ms against 70 to 130 ms for every other page. Both fixes together: **22,6 %
  smaller, 2,9x faster**. Fonts are decided (ten static instances in
  `brand/fonts-static/`); the scrim became ticket 11.

- [The slide refresh](tickets/02-the-slide-refresh.md) — three rounds, **26 kept,
  21 retired**, every one of the 47 decided. `role` proved a good chapter key and a
  bad dedup key. **The step chapter has no depth choice** (one step, one slide),
  which removes a question ticket 03 was going to ask. **Step 3 is Scale**;
  convert / extend / wind down is the gate closing Step 2, so `eng-scale-path`
  becomes `step3` and `step3-scale` retires. Open item 02 answered; item 01 still
  open.

- [The app surface](tickets/05-the-app-surface.md) — the flag is a **count** beside
  the verify chip (same shape, different question: *sound* vs *current*); the
  sidebar counts **decks** behind. Accepting is a confirmation screen, not a manual
  merge, and states in the UI that the previous version and its PDF are untouched.
  **The boundary moves by exactly one hole**: accepting is allowed in the app
  because the replacement comes from the library and is checkable against the
  mother's hash. Choosing chapter picks stays CLI.
  [Mock](https://claude.ai/code/artifact/27697e51-1385-486f-b453-ffdfa4757083).
- [The chapter model](tickets/03-what-a-chapter-is.md) — A recipe
  is **chapters and nothing else**, ordered, and a deck may **skip a whole
  chapter**. Rules are **suggestions, never constraints**: any slide can go in any
  deck. The set is expected to **grow** as new deck types appear. The library
  records **intent per slide** (goal, why-use, companions) so a suggestion is
  possible. Coherence is an **advisory AI check** from the CLI, split out as ticket
  12. Narrative rules never block; **entitlement still does**. The set is **11
  chapters over 26 slides**, declared in one `library/chapters.yaml` (membership and
  order in one place, so exclusivity is structural). `role` stays as the render
  contract and is *not* renamed, because verify enforces footer discipline by it.
  Intent metadata (`goal`, `why`, `with`) goes on `meta.yaml`; suggested picks go in
  `types/<type>/recipe.md`, so `recipe.md` is the suggestion and
  `deck_versions.recipe` is the fact.

- [Where the recipe lives](tickets/01-where-the-recipe-lives.md) — **the premise was
  wrong: it already exists.** `snapshot.py` embeds a `deck-meta` block with the
  ordered slide ids in every published version, so the recipe is already per
  version and already immutable, and `deck.yaml` is confirmed input-only. What was
  missing is that it is **not queryable** and has no chapters or hashes. Fix is
  **one JSONB column** (`deck_versions.recipe`) with the embedded block kept as the
  cross-check. **Drift is a content-hash comparison**, and **any change flags** —
  but a flag only ever means *the next version would differ*: it never mutates a
  published version or its PDF, so anything already sent stays byte-identical.

- [Drift and local edits](tickets/04-drift-and-local-edits.md) — **the stable-id
  requirement is withdrawn.** `htmlcheck.mjs` enforces a byte-identical tag stream
  across every version of a deck, so position is already a stable element identity
  and the Figma failure cannot occur here. The rule: compare mother fingerprints.
  **Equal** (text-only, the common case) → merge by position, local edits kept,
  everything untouched updates. **Different** (structural, CLI-only) → **replace
  the page, listing every local edit that will be lost** first. Detach was rejected
  as silent rot. Accept per page, with accept-all.

- [The cover scrim](tickets/11-the-cover-scrim.md) — **bake it.** The lighter cover
  already existed as `.cover--open` and left the library with the two retired
  covers. Baking it into the hero is visually identical (mean delta 0,94/255),
  **3x faster** than today and **47 % smaller**, with zero shading objects. Cost:
  the scrim becomes a build step rather than a CSS value.
- [The story check](tickets/12-the-story-check.md) — reads the recipe **and** the
  assembled HTML, emits structured findings, **never blocks and exits 0 always**.
  Separate tool from `verifylib.py` so a judgement never looks like a rule and a
  model never sits in the path of a build. Skips cleanly with no API key.
- [Customer decks](tickets/06-customer-decks.md) — **master plus delta.** Tracks
  slide *content*, not chapter structure, so a wording fix reaches a sent deck but a
  new chapter never appears in one. Inline customer-only slides live in the recipe,
  not the library. Entitlement stays a hard gate.
- [Migration](tickets/09-migration.md) — **backfill nothing.** Retired ids are
  allowed to dangle because retired means kept. The three masters are **rebuilt**,
  not migrated; the two derived decks are left alone; social keeps a null recipe.

## Tickets

Open tickets are the files in `tickets/` whose status is `open`. The
**Every decision ticket is closed.** Only **10**, the spec, remains, and it is the
destination rather than a decision. The way to it is clear.

```
all twelve decisions closed ─► 10 spec (the destination) ─► build

closed: 00 charting · 01 recipe home · 02 slide refresh · 03 chapters ·
        04 drift · 05 app surface · 06 customer decks · 07 competitive scan ·
        08 Type 3 fonts · 09 migration · 11 cover scrim · 12 story check
```

## Not yet specified

- **How deep chapters nest.** If the chapter set (ticket 03) turns out to want
  sub-chapters, the recipe format changes shape. Cannot tell until the slides are
  sorted.
- **What happens to `types/<type>/recipe.md`.** Largely resolved by ticket 03: the
  deck recipe holds *what this deck is*, and `recipe.md` holds *what a deck of this
  type typically contains*, which is exactly the suggestion source the chapter model
  needs. They stop overlapping and become input and output. What remains open is the
  format: `recipe.md` is prose today, and a suggestion engine wants the chapter
  picks as data.
- **New verify rules the model makes possible.** A deck that skips a mandatory
  chapter, a chapter with two contradictory picks, a recipe that disagrees with
  the rendered `data-slide-id`s. Revisit once the model is settled.
- **Whether the slide refresh changes the two open items** from the 2026-08-03
  masters review (the ten weeks promise, criteria signed before the Proof). Those
  are Floris's calls and are still open.

## Out of scope

- **Sharing decks by link** instead of by file (viewer page, access control,
  open-tracking). Ruled out at charting: the target is a PDF that is light and
  scrolls instantly. Revisit as a separate effort.
- **New output kinds** (X posts, one-pagers). Roadmap already covers them and
  they do not interact with chapters.
- **The Product Showcase entitlement blocker** (three Holliday screenshots on
  `product-flow-setup`). A disclosability call for Floris, tracked outside this
  map.
