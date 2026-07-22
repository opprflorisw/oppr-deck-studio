# Best practice — decks

## Platform practices

Decks are shown on a projector/screen and shared as PDF. The frame is 16:9
(13.333×7.5 in). They are read in a room while someone talks, and later skimmed
alone as a PDF, so each slide must stand on its own and the deck must survive
being read without narration.

## How Oppr applies it

- Composed, not hand-written: `deck.yaml` lists library slide ids + vars;
  `tools/assemble-deck.py` fills placeholders. One idea per slide (see
  `knowledge/design-philosophy.md`).
- The narrative spine (sections): Opening → Problem → Product → Proof → Path →
  Trust → Closing. A recipe (`types/<type>/recipe.md`) picks the slots.
- Footer discipline by role; no em dashes; European numbers; payback illustrative
  and conservative.
- Every deck is built + verified before it is called done:
  `assemble-deck.py` → `build-pdf.ps1` → `verify-deck.py`, then the human visual
  pass. PDF name carries `oppr` (and the client slug for a named-client deck).
- Named-customer material only in decks cleared for it (`allowed_entitlements`).

### Learnings

- 2026-07-22 — Seed doc from SPEC.md §9 and CLAUDE.md.
