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
| [`deck-studio-5/GUIDE.md`](deck-studio-5/GUIDE.md) | **The current map.** Deck Manager 2.0: **one runtime** (JavaScript; the Python/PowerShell pipeline retires), **deck building moves into MCP** so a colleague builds and sends a deck from Claude on a phone with no Claude Code and no CLI, the deck-building skills are deleted, and the whole system gets a test suite and CI. Two ways to connect, one permission model: the owner works in the repo on mother work, editors connect the MCP connector and the app for leaf work. Share links are deliberately out of scope -- the deliverable is the PDF. Phased 0-5, each phase shippable. |

## Delivered

| Effort | What shipped, and what it parked |
|---|---|
| [`deck-studio-4/`](deck-studio-4/MAP.md) | **Delivered 2026-08-07**, superseded as the live map by `deck-studio-5/`. Its decisions still stand and carry forward: mother work needs an owner and leaf work is any editor's, `deck_sends` pinned to a version, the mechanical guard on customer names, and the MCP server itself. Deck Studio 5 re-scopes its two parked Phase 2 items -- the Python assembler retires there for real, and the library migration is deferred again in favour of a mirror that carries `why` and `with`. Also records the `allow_authenticated` RLS hole found and fixed on 2026-08-07. |
| [`deck-studio-3/`](deck-studio-3/SPEC.md) | **Delivered 2026-08-04**, superseded as the live map by `deck-studio-4/`. Its decisions still stand: chapters over slides, mother-slide propagation by flag-and-accept, the PDF fix, the advisory story check. Deck Studio 4 sits above it and generalises its mother/leaf idea from slides to permissions. |
| [`deck-studio-cloud/`](deck-studio-cloud/MAP.md) | **Destination reached 2026-08-03.** Deck Studio deployed on Vercel, colleagues sign in with email and password, rendering and verification run in the cloud, and access is proved by `tools/check-access.py` (17 adversarial checks, all passing). Deliberately parked as fog rather than decided: custom domain, concurrent editing, whether the CLI keeps direct backend access, and cost at rest. Not superseded by Deck Studio 3, which sits above it. |

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
| [`deck-studio-2/`](deck-studio-2/MAP.md) | **delivered 2026-08-01** and superseded as the live map by `deck-studio-cloud/`. Its decisions still stand: the one artifact model, the format-aware verify gate, print-on-demand PDFs, the unified action grammar. Its "local now, hosted-ready later" note is what the cloud map now acts on. |

## Records of one piece of work (not system design)

- `carousel-series/` — the July 2026 three-carousel series. Doctrine that outlived
  it moved to `knowledge/best-practices/linkedin-carousel.md`.
- `welcome-colleague/` — the "welcome a colleague" output type.

## The rule

Starting a new effort: chart it with `/wayfinder`, add it to **Live**, and move
the previous live map to **Superseded** with a line saying what replaced it.
