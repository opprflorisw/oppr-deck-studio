# MAP — LinkedIn carousel series, July 2026

Wayfinder for the three-carousel series. Decisions and their reasons, so a later
session does not relitigate them. Doctrine that outlives this series lives in
`knowledge/best-practices/linkedin-carousel.md`; this file is the record of *this*
piece of work.

Date: 2026-07-23 · Owner: Floris Wyers

## What this series is

Three standalone carousels for one reader (**plant / operations manager**, mid-size
European manufacturer), sharing a spine (human half missing → one timeline →
improvement) but each doing a different job. They are **not** a numbered series:
no "Part N of 3" anywhere, because almost nobody sees every post and each has to
work cold.

| | Slug | Archetype | Job | Ask | Winning signal |
|---|---|---|---|---|---|
| C1 | `2026-07-23_cant-put-your-finger-on-it` | Mirror | Make the reader recognise a problem they have never named | A comment | Comment volume and specificity |
| C2 | `2026-07-23_no-hardware-no-rip-and-replace` | Path | Kill the fear that this dies like the last system | Visit oppr.ai | Profile visits, site sessions |
| C3 | `2026-07-23_three-industries-one-missing-piece` | Ammunition | Arm a champion to forward it | Forward it | Downloads, DMs, inbound from non-buyers |

**Posting order:** C1 → 7–10 days → C3 → 7–10 days → C2. Widest-reach Mirror first
to warm the account, Ammunition to convert warmth into forwards, Path last because
it reads best warm and has the lowest ceiling cold.

## Decisions taken, and why

**Awareness stage as the differentiator, then abandoned as a *sequence*.** The
series began as a funnel (problem → approach → proof) with "Part N of 3" markers.
That framing survives as the *job* split but not as an advertised sequence: each
carousel must work standalone, so the markers were removed.

**Prices are out.** € 10.000 and € 25.000 were the concrete substance of C2 and are
now gone from every page and post. Removing a number removes a signal, so the
signal was replaced in words: *"Small enough to decide without a business case."*
Never let the removal of price quietly turn this into a capex-shaped proposition.

**Results live only in C3.** C2 leans on ease and low risk; it does not import the
plastics outcome. Otherwise the two carousels compete for the same proof and
neither owns it.

**One number plus one mechanism.** The plastics case dropped from four numbers to
*"The drift tracked a process condition, not the machine. 30% less scrap within 90
days."* Four unattributed numbers read as marketing. The 40% fewer stoppages and
5 hrs/week figures move to sales collateral. If the customer agrees to semi-naming
("a Benelux extrusion producer") plus a one-line quote, all four numbers may
return: it is a one-row swap in `.lcase`.

**Recycling and chemical keep qualitative results.** *"The buying spec changed, not
the line"* is mechanistic proof and is stronger than a number we would have to
invent. Do not chase figures to fill the template.

**De-blame.** C1's hinge was *"Somebody already knew."* which accuses the reader of
not knowing what their own people knew. It is now *"The answer was in the building
by Tuesday afternoon. It just had nowhere to go."* Same insight, target moved from
the reader to the system. Contrast against systems is safe; contrast against the
reader's awareness is not.

**C2's hook attacks the real fear.** *"No new hardware, nothing ripped out"* answers
a sales-call objection. The fear that actually kills these projects is adoption
death, so the hook is now *"Every improvement system dies the same way. It asked
operators for ten minutes they did not have."* Hardware and rip-and-replace demote
to the reassurance chips on page 07, where objection-handling belongs.

**Tool screenshots ship as-is.** The data in them is hypothetical, so no demo
tenant was built and nothing is blurred. Blurring would have been the wrong answer
anyway: it tells every prospect that we screenshot customer environments.

**Visual register, one per carousel.** C1 photography, C2 real product screenshots,
C3 generated industry material. The floor photo with the numbered round overlay
carries C2's cover, because that photo *is* the round the copy describes.

**Recycling imagery is municipal waste.** The first generation produced paper and
cardboard bales, which is a different industry. Regenerated as mixed MSW on a
sorting belt with a trommel screen.

## Still open

- **Plastics attribution.** Ask the customer for semi-naming plus a one-line quote.
  Yes → four numbers return to C3 page 03. No → the current form stands.
- **Dutch edition of C1 only**, after the English C1 has run. Agreed in principle,
  not scheduled.
- **A higher-resolution floor photo.** The original is 462×657, which upscales
  roughly 2.3× to fill a 1080 square and reads soft. It works, but a larger
  original would visibly improve C2's cover.
- **`dump/` is not empty.** A HoSt Bioenergy introduction deck is still there. It is
  named-customer material and needs its own `/ingest-dump` decision.

## What was built for this

- `tools/generate-image.py` — Gemini image generation with full provenance.
- `tools/verify-carousel.py` — the automated gate for playbook section A7.
- `templates/linkedin.css` — `.lpage--full`, `.lshot`, `.ltrio`, `.lcase`,
  `.lcontact`, `.lband--tall/--short`.
- Eight product images filed from `dump/` into `brand/img/`.
