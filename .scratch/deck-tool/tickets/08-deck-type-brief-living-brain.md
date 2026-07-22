---
type: grilling
status: open
assignee:
blocked-by: [01]
---

# 08 — Deck-type brief & the "living brain"

## Question

What does the **brief / recipe for a presentation type** capture, what shape does
it take, and how does it live as a **"living brain" on Claude's memory system** so
each new deck starts smarter instead of from a blank page?

## Why it matters

This is the intent layer that drives everything else. Floris: "a living brain to
better understand how to create a new slide deck ... we're not reinventing the wheel
every time." The intake session (ticket 06) reads these briefs to ask the right
questions and propose a plan; without a well-shaped brief the intake has nothing to
reason from.

## Settled going in (from charting)

- A brief is **per existing named cut** — Product Showcase, Management Outlook,
  Teaser, etc. One recipe each; the catalog grows as new kinds are made.
- The **"living brain" is substrated on Claude's memory** (`memory/`, which already
  holds `deck-management-level-style.md`), not a separate DB.

## Open sub-questions

- **What a brief captures**: goal/purpose · target audience · language · who to focus
  on · presenter (your side) · tone · the slide *roles* this type tends to use (its
  skeleton) · reference stats/claims it may draw on. Which of these are fixed in the
  recipe vs. asked fresh each time?
- **Recipe vs. instance**: the reusable per-type recipe vs. the filled-in brief for
  one specific deck (this audience, this client, this language). Where does each live?
- **Memory tie-in**: what belongs in `memory/` (cross-cutting, accumulating learnings
  and style) vs. in the repo alongside the decks (per-type recipes, per-deck briefs)?
  How does finishing a deck feed anything back?
- **Slide-role linkage**: how a brief names the slides a type uses, mapping to library
  elements (depends on the element model, 01) by *role* ("cover", "the idea in one
  sentence", "pricing", "CTA timeline") rather than by file.

## Depends on

- **01** (element model) — the brief references slide elements by role; needs to know
  what an element is to link cleanly. (The pure intent-schema could be drafted early.)

## Done when

The brief/recipe schema is specified (fields, recipe-vs-instance, file locations, the
memory tie-in), with a worked example: the recipe for one existing named cut
(e.g. Management Outlook) and a filled instance brief for a specific deck.
