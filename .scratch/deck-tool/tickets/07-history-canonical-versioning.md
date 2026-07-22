---
type: grilling
status: closed
assignee:
blocked-by: [03, 04]
---

# 07 — History & canonical "best version"

## Question

How does the system express slide/deck **history** and the **canonical "best
version"** marking Floris asked for, on top of the version-control baseline (03) and
the repository structure (04)?

## Why it matters

Floris's two explicit versioning asks: (a) mark a canonical best version so new decks
start from it and he knows which decks use which; (b) be able to look back at earlier
versions. This must be concrete and low-ceremony, not a heavyweight DAM.

## Depends on

- **03** (version-control baseline) — the history substrate (git commits/tags).
- **04** (repository structure) — what "a canonical" and "a variant" are, physically.

## Open sub-questions

- Does "best version" = a git tag/branch on a canonical deck, a `canonical: true`
  metadata flag, a naming convention, or a combination?
- How does a frozen variant record *which* canonical version it was cut from?
- What does "look back at old versions" resolve to in practice — git history is enough,
  or is a lighter human-facing view needed (defer the visual timeline to the app phase)?

## Done when

A history + canonical-marking mechanism is specified, including how a frozen variant
records its source canonical version.

## Resolution

Resolved by SPEC.md and **built**: §6 — git tags canonical/<type>@vN + variant manifest provenance; Phase 1.
