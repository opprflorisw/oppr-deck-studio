# .scratch — the design history

Why the system is the way it is. Every effort here was charted with `/wayfinder`:
a `MAP.md` (destination, decisions, fog) plus `tickets/` holding the detail.

**These are kept on purpose.** The drift that caused Deck Studio 2.0 happened
because rules got restated in several places and nobody could tell which
statement was current. Deleting the record would make that worse, not better.
The fix is this index: **exactly one map is live at a time**, and every other map
says what superseded it.

## Live

| Effort | What it decides |
|---|---|
| [`deck-studio-2/`](deck-studio-2/MAP.md) | **The current map.** Consolidate, standardize and prune the whole system: one store of truth, a visible CLI/app boundary, an edit → verify → PDF loop for every artifact type, and a repo with nothing unused in it. |

## Current design rationale (still true, still cited)

| Doc | Covers |
|---|---|
| [`deck-tool/SPEC.md`](deck-tool/SPEC.md) | The studio: library composition, `deck.yaml`, assembly, the verify gate. |
| [`deck-app/hybrid-editor/report_and_implementation.md`](deck-app/hybrid-editor/report_and_implementation.md) | **v3** — decks as versioned HTML in Supabase, the in-app editor, masters as a tag. Supersedes the app specs below. |

## Superseded — history only, do not build from these

| Effort | Superseded by |
|---|---|
| `deck-app/APP-SPEC.md` (v1), `deck-app/V2-SPEC.md` (v2) | the v3 hybrid-editor report above |
| `deck-app/MAP.md` | v3, then Deck Studio 2.0 |
| `deck-app/nav-overhaul/` | **Deck Studio 2.0**. Its open tickets (archive/history, fate of the in-app builder, tab icons, action grammar, search scope, wayfinding polish) were absorbed by `deck-studio-2/tickets/navigation-and-discoverability.md`. |
| `cloud-backend/` | **Supabase**, not GCP. The map charted a GCP-hosted backend; v3 shipped Supabase instead. Its store-of-truth reasoning fed `deck-studio-2/tickets/one-store-of-truth.md`. |
| `deck-tool/MAP.md` | delivered; the surviving doctrine is in `SPEC.md` and the root `CLAUDE.md`. |

## Records of one piece of work (not system design)

- `carousel-series/` — the July 2026 three-carousel series. Doctrine that outlived
  it moved to `knowledge/best-practices/linkedin-carousel.md`.
- `welcome-colleague/` — the "welcome a colleague" output type.

## The rule

Starting a new effort: chart it with `/wayfinder`, add it to **Live**, and move
the previous live map to **Superseded** with a line saying what replaced it.
