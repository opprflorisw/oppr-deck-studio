# Company intake via the dump folder

**Type:** prototype · **Blocked by:** — (unblocked 2026-07-23 by customer-object) · **Status:** open

> Model settled by *Customer as a first-class object*: a customer is
> `customers/<slug>/` (CLI-owned, app-read); starting one **stages** name + logo +
> brief to `dump/_app/<company>/` for the CLI to file. This ticket now also covers
> the **Customers area layout** (read `customers/`, list companies with logo,
> drill into a company's decks + any pending intake from `dump/_app/`).

## Question

How does a user add a **company** in the app — its logo and any material — so the
CLI can build that customer's presentation from it?

To settle:
- What the user provides in the app (company name, logo upload, notes, target
  deck type, entitlement/clearance).
- What the app **writes** (staging only — `dump/_app/<company>/` with the logo +
  a brief.md?), and the exact CLI handoff (`/ingest-dump` then `/deckbuilder`? a
  new `/deckbuilder new-customer <company>`?).
- How this relates to the existing `dump/` intake and `/ingest-dump` workflow —
  reuse it, or a dedicated customer lane.
- Whether generated logos/images (Gemini roadmap) plug into the same lane later.

Prototype the intake screen (rough) to react to before speccing it.
