---
type: product-showcase
goal: >
  Show a manufacturing prospect the whole Oppr story end to end — problem,
  product in action, proof, commercials, company — enough to want the Analyze step.
audiences: [operations leaders, plant management, process experts, mixed technical+management rooms]
default_language: en
default_length: 20 slides (full)
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
canonical: decks/canonical/product-showcase
---

# Product Showcase — recipe

The full narrative deck. The richest cut; every other type is a trim or
re-emphasis of this skeleton. Register is management-level: one idea per slide,
big type, terracotta accent as the through-line, no hype, European number
formats, no em dashes.

## Skeleton

| #  | role                | default slide          | required | note |
|----|---------------------|------------------------|----------|------|
| 1  | cover               | cover                  | yes      | hero + unified timeline; no footer |
| 2  | idea                | idea-one-sentence      | strong   | the Attero-style one-sentence lede |
| 3  | why-now             | why-now                | yes      | dashboards say what, not why |
| 4  | problem-recognition | recognize-problems     | optional | five familiar problems |
| 5  | when-time-matters   | when-time-matters      | yes      | EBITDA / speed / capex, management hook |
| 6  | platform            | platform-cce           | yes      | Capture / Connect / Execute |
| 7  | product-flow        | product-flow-setup     | optional | floorplan -> builder -> round |
| 8  | product-flow        | product-flow-insight   | optional | capture -> analyze -> SOP |
| 9  | outcomes            | outcomes-reference     | yes      | outcomes + verified reference stats |
| 10 | evidence            | evidence-quotes        | strong   | three anonymised operations-leader quotes |
| 11 | kpi                 | kpi-payback            | yes      | one improvement x multiply |
| 12 | engagement          | engagement-ladder      | yes      | Analyze / Prove / Scale + needs strip |
| 13 | step-detail         | step1-analyze          | optional | only in a full/commercial cut |
| 14 | step-detail         | step2-prove            | optional | " |
| 15 | step-detail         | step3-scale            | optional | " |
| 16 | acceptance          | operator-acceptance    | strong   | adoption is the whole game |
| 17 | running-projects    | running-projects       | optional | three engagements by process type, no names |
| 18 | who-is-oppr         | who-is-oppr            | yes      | company + principles + founder |
| 19 | cta                 | cta-next-step          | yes      | next-step timeline; no footer |
| 20 | closer              | back-cover             | yes      | contact; no footer |

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
