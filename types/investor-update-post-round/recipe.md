---
type: investor-update-post-round
goal: >
  Update the people who already backed Oppr, just after closing the round. Not a
  pitch: an accountability and relationship deck. Show what the capital buys,
  where the numbers stand, the plan to the next raise, the risks, and specific
  asks. Candid, numbers-forward, same scorecard every quarter.
audiences: [existing investors, seed lead (FORWARD.one), board, angels]
default_language: en
default_length: 14 slides
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
canonical: (none yet — first instance is the 2026-07-23 variant)
derived_from: management-outlook
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

## Skeleton

| #  | role          | default slide      | required | note |
|----|---------------|--------------------|----------|------|
| 1  | cover         | cover              | yes      | no footer; cover_meta says Investor Update · Post-Seed · Confidential |
| 2  | summary       | exec-summary       | yes      | TL;DR: what closed, where we are, what's next |
| 3  | highlights    | highlights         | yes      | wins since the raise, in numbers (all verifiable) |
| 4  | why-now       | why-now            | strong   | the market reminder; keep it brief |
| 5  | platform      | platform-cce       | strong   | one-slide product reminder |
| 6  | outcomes      | outcomes-reference | yes      | the verified reference case (proof the method works) |
| 7  | evidence      | evidence-quotes    | strong   | customer voice |
| 8  | metrics       | the-numbers        | yes      | the quarterly scorecard; consistent metrics; placeholders flagged |
| 9  | use-of-funds  | use-of-funds       | yes      | where the capital goes, tied to milestones |
| 10 | roadmap       | roadmap            | yes      | plan to the next raise, quarter by quarter |
| 11 | team          | team-hiring        | yes      | team today + the hiring plan the round funds |
| 12 | asks          | risks-asks         | yes      | candid risks with mitigations + specific asks |
| 13 | cta           | whats-next         | yes      | no footer; next update date + contact |
| 14 | closer        | back-cover         | yes      | no footer |

`summary`, `highlights`, `metrics`, `use-of-funds`, `roadmap`, `team`, `asks` are
new role slots this type introduces. They carry footers (only cover / cta / closer
are exempt). The new slides compose only from documented blocks: `.grid2`,
`.stat-grid` / `.statcards`, `.levers` + `.multiply`, `.flowdown`, `.need-strip`.

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
