---
type: management-outlook
goal: 'Convince a management / economic buyer (portfolio management, PE operating partners,
  plant leadership) that Oppr moves EBITDA fast and low-risk — enough to take the Analyze
  step. Skip the deep product mechanics.

  '
audiences:
- portfolio-company management
- PE operating partners
- economic buyers
- plant leadership
default_language: en
default_length: 12 slides (trimmed)
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
derived_from: product-showcase
picks:
  ch-open:
  - cover
  ch-idea:
  - eng2-idea
  ch-problem:
  - eng2-opportunity
  - when-time-matters
  ch-evidence:
  - outcomes-reference
  ch-engagement:
  - engagement-ladder
  ch-commercials:
  - kpi-payback
  ch-company:
  - operator-acceptance
  - who-is-oppr
  ch-close:
  - eng-next-step
  - back-cover
skips:
- ch-platform
- ch-decision
- ch-annex
---

<!-- picks/skips are the SUGGESTION for this deck type (Deck Studio 3, SPEC §2).
     They are never a restriction: any slide can go in any deck. The deck's actual
     picks are deck_versions.recipe in the backend. -->

# Management Outlook — recipe

A trimmed cut of the Product Showcase for management and economic buyers. Keeps
the value, the proof and the commercials; drops the idea slide, the two product-
screenshot flows, the five-problems recognition slide, the three step-detail
slides, and running projects. Register identical to the showcase.

Because this type is **derived from** product-showcase, every slide it uses is a
shared library slide. If a shared slide is edited in the showcase, re-check this
cut (they compose from the same fragments, so most edits flow through on rebuild).

## Skeleton

**The `picks:` block in this file's front matter is the skeleton.** It names the
chapters this type uses and the slides picked from each, in chapter order, and it
is what the builder reads.

There used to be a table here as well. Two statements of the same thing drift,
and this one did: it went on naming slides that were retired on 2026-08-04, so a
deck proposed from it started with pages that can no longer be built. The rule is
the repo's own — state a thing once, and point at it from everywhere else.

Depth is chosen per chapter. Skipping a chapter drops every slide under it, and
any live slide may be picked into any deck: `picks:` is a suggestion, never a
constraint.

## Intake questions

Same set as product-showcase (audience, client, language, entitlement, goal/
emphasis, presenter, length/date). Because the audience is economic, default the
emphasis to numbers/outcomes over product mechanics.

## Learnings
<!-- append-only; newest first -->

- 2026-07-21 — This 12-slide order is the agreed management/economic cut.
