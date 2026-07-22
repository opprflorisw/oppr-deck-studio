---
type: grilling
status: open
assignee:
blocked-by: [01]
---

# 05 — Personalization / variable model

## Question

How are the swappable bits of a deck declared and filled during Personalize mode —
client name, "prepared for", logo, footer meta, language strings, and the
include/exclude of whole slides for length/goal cuts?

## Why it matters

Personalize is the common case ("change the title slide and footer for a specific
client", "make a teaser", "make a French version"). The model must let a
non-editing user do this safely without touching design, and must extend — not
fight — the existing `[DYNAMIC BLOCK]` + top-of-deck VARIABLES convention.

## Depends on

- **01** (element model) — variables live on/within elements; their representation
  determines how variables are declared and scoped.

## Open sub-questions to resolve

- Variable *declaration*: where a personalizable value is defined and its default.
- Variable *scope*: deck-level (footer, prepared-for) vs slide-level.
- Slide selection: how include/exclude of slides for length/goal variants is expressed.
- The boundary this creates with **Edit** mode (feeds ticket 06).

## Done when

A variable/personalization model is specified with a worked example: producing a
client + French teaser variant from a canonical deck by only changing variables and
slide selection.
