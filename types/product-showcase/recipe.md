---
type: product-showcase
goal: 'Show a manufacturing prospect the whole Oppr story end to end — problem, product in
  action, proof, commercials, company — enough to want the Analyze step.

  '
audiences:
- operations leaders
- plant management
- process experts
- mixed technical+management rooms
default_language: en
default_length: 20 slides (full)
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
picks:
  ch-open:
  - cover
  ch-idea:
  - eng2-idea
  ch-problem:
  - recognize-problems
  - eng2-opportunity
  - when-time-matters
  ch-platform:
  - platform-cce
  - product-flow-setup
  - product-flow-insight
  ch-evidence:
  - outcomes-reference
  - running-projects
  - evidence-quotes
  ch-engagement:
  - engagement-ladder
  - eng2-step1
  - eng2-step2
  - step3
  ch-commercials:
  - kpi-payback
  ch-company:
  - operator-acceptance
  - who-is-oppr
  ch-close:
  - eng-next-step
  - back-cover
skips:
- ch-decision
- ch-annex
---

<!-- picks/skips are the SUGGESTION for this deck type (Deck Studio 3, SPEC §2).
     They are never a restriction: any slide can go in any deck. The deck's actual
     picks are deck_versions.recipe in the backend. -->

# Product Showcase — recipe

The full narrative deck. The richest cut; every other type is a trim or
re-emphasis of this skeleton. Register is management-level: one idea per slide,
big type, terracotta accent as the through-line, no hype, European number
formats, no em dashes.

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

Ask fresh every time (these drive the plan):
- audience & what they already know of Oppr
- named client? (fills prepared-for / logo — needs entitlement clearance)
- language (en / fr / de / nl / …)
- entitlement (public, or cleared to show named customers?)
- goal & emphasis (full vs. teaser; numbers-heavy vs. illustration-heavy)
- presenter from Oppr's side
- length target and date of use

Fixed by this recipe: management-level register, terracotta through-line, the
skeleton order above, Capture→Connect→Execute framing, Analyze→Prove→Scale path.

## Commercials (verify against Floris before reuse — see brand/BRAND.md)

- Analyze: € 10.000 fixed, 2–3 weeks, 100% credited.
- 10-Week Proof: € 25.000 fixed, all-in. Total to a verified improvement: € 25.000.
- Annual (Scale): priced on operational size; 50% of Proof fee credited on conversion.

## Learnings
<!-- append-only; the accumulating half of the brain. Newest first. -->

- 2026-07-23 — **Fill the slide, and name the platform's three words.** Edit pass
  on the shared library: CAPTURE / CONNECT / EXECUTE now appear as mono labels on
  the idea cards (the room should hear the three words, not three sentences); the
  four "when time matters" cards are numbered 01-04 so they read as an ordered
  set; the reference stats on `outcomes-reference` became icon cards in the same
  language as the other grid cards, rather than four loose figures beside a list.
  Type went up across `flowdown`, `probs`, `grid2`, `cce-legend`, `flowsteps` and
  `out-list`, and the `flowsteps` frames grew to 332px.
- 2026-07-23 — **Bigger type costs copy, every time.** Raising the card and row
  sizes pushed `recognize-problems` and `operator-acceptance` past the content box
  and straight through the footer. The fix is never "shrink it back": it is to cut
  the trailing clause. `operator-acceptance` lost four of them plus a two-line
  subcopy, and reads better for it. Budget the slide at **582px of content**
  (720 canvas minus 60 top and 78 bottom padding); the `.slide-foot` rule sits at
  ~674 and anything reaching it is already broken.
- 2026-07-23 — Dropped "Every step is fixed-fee and stops whenever the numbers say
  stop" from `when-time-matters`. The engagement ladder says it with more
  authority three slides later.

- 2026-07-21 — Icons on the four "when time matters" cards and the four
  "built with operators" cards test well; keep them.
- 2026-07-21 — Running projects read cleanest with NL / FR shortcuts, not full
  country names.
- 2026-07-21 — Cover dropped "Discussion draft"; meta line is
  "<Type> · <Month Year> · Confidential · oppr.ai".
