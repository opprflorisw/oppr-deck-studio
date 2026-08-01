# Navigation and discoverability

Type: prototype · Status: open · Blocked by: The CLI and app handover contract, Artifact model

## Question

Where does every action live, so that the thing you need is where you look for
it — and so a capability can never again exist without you knowing?

## Why it matters

**This is the ticket the whole map came from.** Floris did not know the editor
existed. That is a navigation failure, not a missing feature — and Floris asked
for "the buttons in the right spot".

Current shape (`app/web/js/main.js`, `sidebar.js`, `areas.js`): sidebar =
Customers (home) · Decks · Social output · Library · Last 30 days · Knowledge.
Views: 16 modules, `social.js` at 454 lines and `research.js` at 424 the
largest. The previous nav overhaul (`.scratch/deck-app/nav-overhaul/`) settled
the sidebar but left four tickets open: **Unified Archive & History**,
**Fate of the in-app builder**, **Tab identity and icons**, **Consistent action
grammar**, **Search scope**, **Wayfinding polish**.

## What a good answer settles

- Whether to **absorb the open nav-overhaul tickets into this map** or close them
  as superseded. Do not leave two live maps arguing about the same sidebar.
- The **action grammar**: one verb name per operation everywhere (Edit vs
  Fine-tune vs Open, Regenerate vs Build vs Print, Download vs Export). Today
  these vary per view.
- Where **Edit** appears so it cannot be missed — deck list row, deck detail,
  viewer, or all three.
- What each area's landing state shows when empty, and whether an artifact can
  be **invisible** in the app (the previous map already hit this: variants with
  no `client` were unreachable until "Company decks" was added — that class of
  bug must become impossible).
- Search scope: one search across everything, or per-area.
- Whether **Last 30 days** and **Knowledge** are peers of Decks in the sidebar or
  belong somewhere else (see the map's fog on `research/`).

## How to resolve

`/prototype`. Sketch the information architecture and the action grammar as a
concrete artifact, then walk Floris's real tasks through it: "change one word and
send the PDF", "make a carousel for this post", "find that Wavin deck".

## Evidence to gather while resolving

- `app/web/js/main.js`, `sidebar.js`, `areas.js`, `router.js`, `icons.js`
- `.scratch/deck-app/nav-overhaul/MAP.md` and its open tickets
