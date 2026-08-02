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

- 2026-07-30 — **Decks are a ladder, and each rung must sell the next rung's
  price, not the whole ladder's.** Showcase → Proposal → PoV document → annual
  documents. The rule that keeps them from fighting: the showcase argues *why*,
  the proposal argues *what, how, when, how much and how we decide*. Anything the
  showcase spends five slides on, the proposal spends one on, because a proposal
  is forwarded to people who never saw the showcase and must still survive
  standalone. When two documents in the ladder describe the same commercial step
  differently, the later one wins in the room and the earlier one looks like a
  bait-and-switch: the Attero proposal quietly folded the € 10.000 Analyze into
  the € 25.000 Proof, which deleted a step the showcase sells two slides earlier.
  Check every document against the ladder's prices before sending.
- 2026-07-22 — Seed doc from SPEC.md §9 and CLAUDE.md.
