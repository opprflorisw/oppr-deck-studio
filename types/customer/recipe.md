---
type: customer
goal: >
  The deck you take into a named customer, before it is theirs. It carries the
  full story and leaves the customer-specific parts as variables, so making it
  specific for one plant is a copy and a fill, not a rewrite.
audiences: [an operations lead and their team at one named plant]
default_language: en
default_length: 14 to 18 slides
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
derived_from: engagement
---

# Customer deck (generic) — recipe

## Why this type exists

Every customer deck used to be a personalized copy of whichever master happened
to fit, so "what do we normally show a customer" had no answer you could open.
This is that answer: **one generic customer deck, at company level, that the
customer-specific ones are copies of.**

It is a company deck in every sense except its name. It names no customer, it is
cleared for `public` only, and it is the master of type `customer`.

## The rule that makes it work

**A customer deck is a COPY, never an edit of this one.** Personalize it from its
own page (or `--derived-from` in the CLI): that creates a new deck with its own
version timeline, records where it came from, and sets `client` so the entitlement
gate knows which customer's material it may carry.

Editing this one directly would be editing the template everybody copies from,
which is how a customer's name ends up in the next customer's deck.

## Skeleton

Start from the `engagement` master ("How we work together") and keep the
customer-shaped slots as variables rather than as text:

| # | role | default slide | required | note |
|---|---|---|---|---|
| 1 | cover | cover | yes | `{{cover_meta}}` carries the customer and the date |
| 2 | idea | eng2-idea | yes | |
| 3 | why-now | eng2-opportunity | yes | the load-bearing problem slide |
| 4 | evidence | outcomes-reference | yes | the verified numbers |
| 5 | evidence | running-projects-detail | strong | the portfolio, with what we did and what they said |
| 6 | engagement | engagement-ladder | yes | the three steps |
| 7 | step-detail | eng2-step1 / eng2-step2 / step3 | yes | one per step |
| 8 | acceptance | eng-criteria | strong | what both sides sign up to |
| 9 | kpi | kpi-payback | yes | what one improvement is worth |
| 10 | cta | eng-next-step | yes | how Step 1 starts; `{{start_target}}` |
| 11 | closer | back-cover | yes | contact + the LinkedIn QR |

## What becomes specific, and how

Everything below is a **variable or a variant-local override**, never an edit of
a library slide:

- `deck_footer` and `cover_meta` — the customer's name and the date
- `start_target` — the date you agreed
- `client` — the customer slug, which sets the PDF filename and the clearance
- `allowed_entitlements` — `public` plus that one customer, so their own material
  can appear and nobody else's can

## Intake questions

- Which customer, and which plant or line?
- Who is in the room: operations, quality, IT, finance?
- Is there anything of theirs we are cleared to show?
- Has a date been agreed for the Analyze?

## Learnings

<!-- newest first -->
- 2026-08-05 · Created. Split out of `engagement` so that "the customer deck" is
  a thing you can open rather than a shape you had to remember.
