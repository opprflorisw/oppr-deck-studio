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
---

# Teaser — recipe

The shortest cut: a management-outlook trim to six slides for the top of the
funnel. Register identical to the other decks. Because it is **derived from**
management-outlook / product-showcase, every slide is a shared library slide.

## Skeleton

| # | role              | default slide       | required | note |
|---|-------------------|---------------------|----------|------|
| 1 | cover             | cover               | yes      | usually a variant-local cover with a teaser lede; no footer |
| 2 | when-time-matters | when-time-matters   | yes      | the pressure / EBITDA hook |
| 3 | outcomes          | outcomes-reference  | yes      | outcome + reference stats — the payoff |
| 4 | evidence          | evidence-quotes     | strong   | one or more operations-leader quotes |
| 5 | kpi               | kpi-payback         | yes      | what one improvement is worth |
| 6 | cta               | cta-next-step       | yes      | the ask: a 30-minute call; no footer |

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
