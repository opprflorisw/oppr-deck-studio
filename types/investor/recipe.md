---
type: investor
goal: >
  Show Oppr to people who would fund it rather than buy from it: what the company
  is, the market it is in, what the product does on a real floor, the traction
  behind that, and where the money goes. Candid and numbers-forward.
audiences: [investors, seed lead (FORWARD.one), board, angels]
default_language: en
default_length: 14 slides
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
---

# Investor Update — Post-Round — recipe

A post-close update for existing investors. It reuses the showcase's product and
proof slides (investors still want the one-slide reminder and the verified
reference), then adds the investor-specific slides a pitch deck never carries:
an executive summary, highlights since the raise, a same-every-quarter metrics
scorecard, use of proceeds tied to milestones, a roadmap to the next round, the
hiring plan, and a candid risks + asks slide.

Register is identical to the showcase (short, declarative, European numbers, no
em dashes, payback illustrative). The difference from a pitch deck is the frame:
**report and be accountable**, do not re-sell the market to people who already
wrote a cheque. Lead with the scorecard, contextualise every number, put bad news
early with its mitigation, and make asks specific.

## The two registers of number

- **Verified / public** — the closed round and its lead, team size, the verified
  reference outcomes, pricing, geography. State plainly.
- **Operating figures** (ARR, pipeline, burn, runway, NRR, use-of-funds split,
  roadmap dates, headcount targets) — the founder supplies these. Until then they
  ship as clearly-labelled **illustrative placeholders** so the layout is real,
  and the deck's cover meta says "Draft for review". Never let an invented figure
  read as an actual in an investor's hands.

## Skeleton — PROPOSED, NOT YET BUILDABLE

**This type cannot be built today.** Seven of the slides below have no folder in
`library/slides/`: `exec-summary`, `highlights`, `the-numbers`, `use-of-funds`,
`roadmap`, `team-hiring`, `whats-next`. They were designed here and never made.

It is written down rather than deleted because the thinking is sound and the type
is wanted — but it is labelled, because a recipe that proposes slides which do
not exist is worse than no recipe: it sends whoever follows it into a build that
cannot complete. There is deliberately no `picks:` block for the same reason.

**To make this type real**, build the seven slides through `/edit-canonical`
(each needs a `meta.yaml` with a `chapter`, and any new visual pattern needs its
design-system specimen and CSS first), add them to `library/chapters.yaml`, then
replace this section with a `picks:` block. Until then, an investor update is
assembled by hand from the live library.

The intended shape, for whoever builds it:

| #  | intent        | proposed slide     | note |
|----|---------------|--------------------|------|
| 1  | cover         | cover *(exists)*   | cover_meta says Investor Update · Post-Seed · Confidential |
| 2  | summary       | exec-summary       | TL;DR: what closed, where we are, what's next |
| 3  | highlights    | highlights         | wins since the raise, in numbers (all verifiable) |
| 4  | why-now       | *(use `when-time-matters`)* | the market reminder; keep it brief |
| 5  | platform      | platform-cce *(exists)* | one-slide product reminder |
| 6  | outcomes      | outcomes-reference *(exists)* | the verified reference case |
| 7  | evidence      | evidence-quotes *(exists)* | customer voice |
| 8  | metrics       | the-numbers        | the quarterly scorecard; placeholders flagged |
| 9  | use-of-funds  | use-of-funds       | where the capital goes, tied to milestones |
| 10 | roadmap       | roadmap            | plan to the next raise, quarter by quarter |
| 11 | team          | team-hiring        | team today + the hiring plan the round funds |
| 12 | asks          | risks-asks         | candid risks with mitigations + specific asks |
| 13 | cta           | whats-next         | no footer; next update date + contact |
| 14 | closer        | back-cover *(exists)* | no footer |

## Intake questions

Everything in the "operating figures" register above, plus: round terms to
disclose, the two or three real discussion points for the meeting, the date of the
next update, and any named logos cleared to appear (entitlement rules apply — the
default build keeps customers anonymised by sector).

## Learnings
<!-- append-only; newest first -->

- 2026-07-23 — First instance built as a variant, not a canonical (the operating
  figures are placeholders until Floris supplies them, so freezing a canonical is
  premature). The round itself (€ 1,25M seed, FORWARD.one) is public via the
  oppr.ai press page and can be stated plainly; only the operating metrics are
  gapped. Kept all customer references anonymised by sector to pass verify without
  entitlement clearance — named logos are a deliberate, separate decision.
