---
type: teaser
goal: >
  Provoke a first call from a cold or lightly-warmed manufacturing prospect. Show
  just enough — pressure, outcome, proof, payback, next step — to earn 30 minutes.
audiences: [cold prospects, event contacts, top-of-funnel management]
default_language: en
default_length: 6 slides
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
derived_from: management-outlook
picks:
  ch-open:
  - cover
  ch-problem:
  - when-time-matters
  ch-evidence:
  - outcomes-reference
  - evidence-quotes
  ch-commercials:
  - kpi-payback
  ch-close:
  - eng-next-step
  - back-cover
skips:
- ch-idea
- ch-platform
- ch-engagement
- ch-decision
- ch-company
- ch-annex
---

# Teaser — recipe

The shortest cut: a management-outlook trim to six slides for the top of the
funnel. Register identical to the other decks. Because it is **derived from**
management-outlook / product-showcase, every slide is a shared library slide.

## Skeleton

**The `picks:` block in this file's front matter is the skeleton.** It names the
chapters this type uses and the slides picked from each, in chapter order, and it
is what the builder reads.

This type had no `picks:` until 2026-08-19 — only a table, written before the
chapters model, which had gone on naming slides retired on 2026-08-04. The picks
above are that table brought to the live library. Depth is chosen per chapter,
skipping a chapter drops every slide under it, and any live slide may be picked
into any deck: `picks:` is a suggestion, never a constraint.

## Intake questions

Same set as the other recipes (audience, client, language, entitlement, goal/
emphasis, presenter, length/date). For a teaser, default emphasis to a single
sharp hook + the payoff; keep it public unless a named reference is explicitly
cleared.

## Cover handling

The cover is usually overridden locally (`decks/variants/<slug>/slides/cover/`)
with a teaser-specific lede — one sentence promising a short, high-value read.
Choose the hero image by meaning from `brand/img/library.json` (default
`hero-plate.jpg`). Keep `{{cover_meta}}` / `{{asset}}` placeholders.

## Worked example

`decks/variants/2026-07-22_teaser-demo/` is a built six-slide teaser following
this skeleton (with a local-override cover). Use it as a starting template.

## Learnings
<!-- append-only; newest first -->

- 2026-07-22 — Six-slide skeleton (cover, when-time-matters, outcomes, evidence,
  kpi, cta) established as the default teaser.
