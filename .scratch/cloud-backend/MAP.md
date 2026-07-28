# MAP — from folders-as-database to a deployed backend

`wayfinder:map` · charted 2026-07-23 · owner: Floris Wyers

Tickets live in `./tickets/`. Open tickets are not listed here; the frontier is
whatever is open, unblocked and unclaimed. This file is an index: a decision
lives in its ticket, and gets one line here when it closes.

## Destination

**An agreed target architecture and migration plan**, written down well enough to
hand to any competent engineer: the record model (identity vs display name vs
derived filename), where content and artifacts live, how builds run, how auth and
entitlement work for a team, and a staged migration that never breaks the local
workflow on the way. **Nothing is built inside this map.**

## Notes

**Domain.** Today the filesystem *is* the database. `social/<channel>/<date>_<slug>/`
is simultaneously the identity, the key in `social/_status.json`, the cache key in
`app/index.json`, the URL and the stem of the PDF filename. Renaming breaks all
four at once. Git is the real store: outputs are committed, `manifest.yaml` records
provenance as `canonical/<type>@vN` plus per-slide commit SHAs, and versioning is
git tags. `app/server.mjs` is a thin local shim over the repo, bound to 127.0.0.1,
with no users.

**Naming is enforced, not incidental.** `deck_pdf_name.py` derives the PDF name from
`deck.yaml` and `verify-deck.py` FAILs a name missing `oppr` or the client slug.
Any "editable names" design must keep a derived, rule-checked filename underneath
the mutable label. This is a traceability control, not a nicety.

**Entitlement is currently a build-time convention.** `public` /
`named-customer` / `mutares-family` are enforced by verify scripts on one laptop.
Deployed and multi-user, this becomes access control, and a leak has real
consequences. Treat it as a security requirement throughout, not a field.

**Standing decisions from charting** (do not relitigate without redrawing the map):

- Users are **the Oppr team** — several named people, not just Floris. This
  reverses the app README's "team access deliberately deferred".
- The **CLI stays, containerised behind the app.** `assemble-deck.py`,
  `build-pdf`, `verify-deck.py` and `verify-carousel.py` remain authoritative and
  keep running; the container needs Python, Chrome and a content checkout.
  `/deckbuilder` still works locally.

**Skills to consult:** `/grill-me` and `/prototype` for the HITL tickets.

## Decisions so far

<!-- one line per closed ticket -->

_None yet — charted this session._

## Not yet specified

Fog toward the destination. Graduates into tickets as the frontier advances.

- **Cost envelope.** Cloud Run with a Chrome-bearing container, a database and
  storage is not free. There is no stated ceiling, and cost may decide between
  always-on and scale-to-zero, and between managed Postgres and Firestore.
- **Backup, disaster recovery and "the record".** If git stops being the store,
  something has to inherit its role as the durable, auditable history. If git
  stays, backups of a cloud checkout still need defining.
- **Where the verify gates run in a deployed pipeline.** They are the quality
  contract; today they run when a human types the command. Deployed, they need a
  trigger, a failure surface and a way to block publishing.
- **Secrets in the cloud.** `GEMINI_API_KEY` currently lives in a gitignored
  `.env` on one laptop. Shared and billed, it needs Secret Manager, per-user
  attribution and a spend limit.
- **Image generation as a shared service.** `tools/generate-image.py` assumes one
  key and one machine, and writes provenance into `brand/img/library.json`.
- **Environments and domain.** dev/prod separation, a custom domain, and whether
  the team ever sees a staging copy.
- **Observability.** What "the build failed" looks like to a teammate who never
  opens a terminal.
- **Do frozen variants survive mutable names?** `decks/variants/` are frozen
  snapshots by design. If display names become editable, what exactly is frozen.

## Out of scope

Ruled beyond this destination while charting. Returns only if the destination is
redrawn, and then as a fresh effort.

- **Customer-facing share links.** Users are the Oppr team; prospects opening a
  link is a different product with a much harder entitlement story.
- **Rewriting the CLI as backend services.** Considered and rejected while
  charting: the verify gates and assembly code are working and tested, and the
  "a fresh clone builds a deck from these docs alone" property is deliberate.
- **Building the deployment.** This map produces the spec and migration plan.
  Execution is a separate effort.
