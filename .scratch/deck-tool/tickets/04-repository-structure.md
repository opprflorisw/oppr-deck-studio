---
type: grilling
status: open
assignee:
blocked-by: [01, 03]
---

# 04 — Repository & naming structure

## Question

What is the folder + naming + metadata scheme that distinguishes, and relates,
the three kinds of thing this system holds:
- **library elements** (reusable slides/blocks from 01, images from 02);
- **canonical decks** (the "best version" masters, e.g. Product Showcase);
- **frozen variants** (client / language / length / audience / goal cuts).

And how is a canonical deck's "best version" *marked*?

## Why it matters

This is the skeleton everything else is filed into. It must make canonical vs
variant unambiguous (variants are frozen snapshots), keep the element library
findable, and stay legible to both Floris and teammates.

## Depends on

- **01** (element model) — can't lay out a library without knowing what an element is.
- **03** (version-control baseline) — "mark the best version" leans on the history
  substrate.

## Done when

A concrete directory + naming convention is specified (with examples for a canonical
deck, a client variant, and a French variant), plus how "canonical/best" is marked.
