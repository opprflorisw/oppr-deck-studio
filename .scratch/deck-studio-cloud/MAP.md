<!-- wayfinder:map -->
# Deck Studio in the cloud — colleagues, hosted rendering, and an MCP

## Destination

Deck Studio reachable over the internet by **named Oppr colleagues who log in and
edit**, with **rendering and verification running in the cloud** (no dependency
on Floris's machine being on), deployed on **Vercel** over the existing Supabase
backend — plus an **MCP server** so Claude can drive it from surfaces other than
this repo.

Reached when a colleague can open a URL, sign in, edit a deck, download a
correctly-verified PDF, and provably **cannot** read an artifact they are not
cleared for.

## Notes

- **This map executes** (Floris, 2026-08-02): decide each ticket, then build it,
  through to a deployed app. One hold: the access rules are **proved with
  adversarial tests before anything is publicly reachable**. A wrong rule here is
  not a broken button, it is customer-cleared material readable by the wrong
  person over the internet.
- **Settled at charting:**
  - The need is **colleagues who edit** — named accounts, not public share links.
  - Rendering **moves to the cloud**: headless Chromium in a function, and the
    verify gate ported off Python.
  - The **MCP is secondary**. It is what lets *Claude* drive Deck Studio from
    other surfaces; it does nothing for a colleague opening a link. It does not
    block hosting and hosting does not block it.
- **The security fact this map turns on** (measured 2026-08-02, not assumed):
  every table has RLS enabled and **zero policies**, which in Postgres means
  **deny everything**. Verified: the publishable key reads 0 rows from `decks`,
  `deck_versions`, `deck_assets`, `customers` and `publish_log`, and Storage
  refuses the same key and an unauthenticated URL. The only thing that reads
  anything is `app/server.mjs` holding `SUPABASE_SECRET_KEY`, which bypasses RLS
  by design.
  So the job is **not** closing something that is open. It is the harder,
  quieter one: **opening it exactly as far as each colleague should reach, and no
  further**. Every policy written from here is a grant, and a grant is where the
  leak would come from — not from the current state.
- **Clearance changes meaning.** `allowed_entitlements` currently gates what
  *content* may go in an artifact. With several users it must also gate *who may
  open the artifact*. Those are different questions and the second one does not
  exist yet.
- Supersedes Deck Studio 2.0's "local now, hosted-ready later". 2.0 deliberately
  added no new local-only dependency, which is the reason this is feasible.
- Standing constraints unchanged: brand rules, one clearance slug per customer,
  social is public, no secret ever in the repo.
- Current shape to work from: `app/server.mjs` (~1250 lines, Node built-ins only),
  `app/web/` (plain ES modules, no build step), `tools/verifylib.py` (the single
  rule source), Supabase project `deck_manager` (`ltnohjrrtyljrveftwii`).

## Decisions so far

<!-- one line per closed ticket; the detail lives in the ticket -->

_(none yet — charted 2026-08-02)_

## Not yet specified (fog)

- **Custom domain, and what the app is called in public.**
- **Audit trail** — who changed what, once more than one person can change it.
  `deck_versions.author` is a hardcoded string today.
- **Concurrent editing.** Two colleagues in the same deck: last-write-wins is
  probably acceptable at this size, but nothing currently detects it.
- **Whether the CLI keeps its own direct backend access** or starts going through
  the same API as everyone else. Sharpens after the secret-key ticket.
- Cost at rest (Vercel functions, Supabase egress, Chromium cold starts).

## Out of scope

- **Public share links for customers/investors.** Explicitly not chosen at
  charting: this map is colleagues-who-edit. A read-only link system is a
  separate effort with a different threat model.
- **Real-time collaborative editing** (cursors, live merge).
- **Moving authoring into the app.** The CLI still creates; Deck Studio 2.0's
  boundary holds.
- Anything that changes the brand system, the library, or the deck format.

## Tickets

Frontier = open + unblocked + unclaimed.

| Ticket | Type | Status / Blocked by |
|---|---|---|
| [Identity and roles](tickets/identity-and-roles.md) | grilling | **frontier** |
| [Cloud rendering](tickets/cloud-rendering.md) | prototype | **frontier** |
| [Port the verify gate off Python](tickets/port-verify.md) | prototype | **frontier** |
| [Lock the database down](tickets/lock-the-database-down.md) | task | blocked by Identity and roles |
| [Where the secret key goes](tickets/where-the-secret-key-goes.md) | grilling | blocked by Identity and roles |
| [Clearance as access control](tickets/clearance-as-access-control.md) | grilling | blocked by Identity and roles, Lock the database down |
| [Deployment shape on Vercel](tickets/deployment-shape.md) | grilling | blocked by Cloud rendering, Where the secret key goes |
| [The cache with no disk](tickets/cache-with-no-disk.md) | grilling | blocked by Cloud rendering |
| [The MCP server](tickets/the-mcp-server.md) | prototype | blocked by Where the secret key goes |
| [Prove it before it is public](tickets/prove-it-before-public.md) | task | blocked by everything above |
