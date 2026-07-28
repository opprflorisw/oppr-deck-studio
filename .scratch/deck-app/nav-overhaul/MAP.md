<!-- wayfinder:map -->
# Deck Studio App — role & navigation overhaul

## Destination

Redefine what the Deck Studio App is **for**, now that all building happens in the
CLI, and fix the navigation clunkiness along the way. End state: a short spec
covering the app's role, its top-level information architecture, a **company
intake flow** (drop a company logo + material into `dump/` → the CLI builds a
customer-specific presentation), a **unified Archive/History home**, and a
consistent, icon-clear navigation — with **no in-app builder**. Decided one
ticket at a time; nothing is built until the spec is approved.

## Notes

- **Superseded in part by the v3 hybrid build (2026-07-27).** The
  `.scratch/deck-app/hybrid-editor/report_and_implementation.md` effort was built:
  decks now live in a Supabase backend as versioned HTML, the app gained an
  in-place **editor** + **regenerate PDF** + **version history** + **personalize**,
  and masters became a tag. This settles **Unified Archive & History** for decks
  (version timeline) and **Fate of the in-app builder** (the editor/personalize
  replace the composer; the old `draft.js`/`compose.js` remain only because
  `slides.js` still imports `renderTray` — a small follow-up cleanup).


- **Planning, not building** — EXCEPT the two settled keystones + the intake, which
  were **executed 2026-07-23** at Floris's direction (`/goal execute`). Built:
  the customer-first sidebar (Customers · Output · Library · Knowledge, Create
  removed), tab icons on every area's tabs, Output = Masters (canonical) + Social,
  the **Customers** area (list + detail + New-customer intake that stages to
  `dump/_app/<slug>/`), the `build_customers()` index + `POST /api/customer-intake`
  endpoint. Verified in-browser, no console errors. The old builder code
  (`draft.js`, `compose.js`, social composers, `carousel-build.js`) is now
  **unreferenced** but left on disk pending *Fate of the in-app builder*.
- Remaining tickets stay **planning** — resolve before building.
- Owner: Floris. The app is local / single-user.
- The pivot that opened this map (2026-07-23, Floris): "we build everything
  through the CLI, so we don't need a separate builder for now; the goal is using
  `/dump` where a user adds a company logo and the CLI creates the customer-
  specific presentation."
- Standing constraints: the app writes only staging areas (`decks/drafts/`,
  `social/drafts/`, `dump/_app/`) + `social/_status.json`; entitlement gating;
  brand rules; social output is public.
- Current-state inventory of every nav element was taken 2026-07-23 (see the
  session analysis, or read `app/web/js/**` and `app/web/index.html`).
- When resolving a ticket, use `/grilling` + `/domain-modeling`; use `/prototype`
  where "how should it look/behave" is the crux.

## Decisions so far

<!-- one line per closed ticket; the detail lives in the ticket -->
- [App role after CLI-only building](tickets/app-role-after-cli-only-building.md)
  — **Customer-first cockpit, not a builder.** Sidebar: Customers (home) ·
  Output (Masters + Social) · Library · Knowledge. Create removed; frozen variants
  move under their customer; masters stay in Output.
- [Customer as a first-class object](tickets/customer-as-a-first-class-object.md)
  — **A CLI-owned `customers/<slug>/` folder** (customer.yaml + logo, no clearance),
  read by the app; decks matched by `client:` slug; clearance unchanged. Starting a
  customer **stages** logo + brief to `dump/_app/` for the CLI to file.
- **Company decks** (2026-07-24, patch to the two decisions above). "Frozen variants
  move under their customer" silently assumed every variant *has* a customer. A
  teaser and the post-round investor update are frozen variants with **no `client:`**,
  so they were excluded from Masters and unclaimable by any Customer page: invisible
  in the app. Output → Masters now renders a second section, **Company decks**, for
  variants where `client` is empty. A variant *with* a client still stays out of
  Output on purpose. Variant-local slides have no library thumbnail, so the filmstrip
  gives them a labelled placeholder frame instead of a broken image.

## Not yet specified (fog)

- Generated-image intake (the Gemini roadmap) feeding the same dump flow.
- Whether Knowledge/Config ever gains editing (today it is read-only).

## Out of scope

- Building the CLI's customer-deck generator itself — that is CLI work, not app
  navigation. This map decides how the app *feeds* it, not how it builds.
- Gemini image generation wiring (roadmap; a separate effort).

## Tickets

Frontier = open + unblocked. Work one per session; record the answer here on close.

| Ticket | Type | Status / Blocked by |
|---|---|---|
| [App role after CLI-only building](tickets/app-role-after-cli-only-building.md) | grilling | ✅ closed 2026-07-23 |
| [Customer as a first-class object](tickets/customer-as-a-first-class-object.md) | grilling | ✅ closed 2026-07-23 |
| [Company intake via the dump folder](tickets/company-intake-via-the-dump-folder.md) | prototype | 🔨 built (first pass) 2026-07-23 — refine later |
| [Unified Archive & History home](tickets/unified-archive-and-history-home.md) | grilling | **frontier** |
| [Fate of the in-app builder](tickets/fate-of-the-in-app-builder.md) | grilling | **frontier** |
| [Tab identity and icons](tickets/tab-identity-and-icons.md) | grilling | **frontier** (quick win) |
| [Consistent action grammar](tickets/consistent-action-grammar.md) | grilling | **frontier** (quick win) |
| [Search scope](tickets/search-scope.md) | grilling | **frontier** (quick win) |
| [Wayfinding polish](tickets/wayfinding-polish.md) | grilling | blocked by archive |
