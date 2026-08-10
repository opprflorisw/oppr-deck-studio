<!-- wayfinder:map -->
# Deck Studio 4 — the commercial team, and Deck Studio over MCP

## Destination

Deck Studio used by **Oppr's commercial team**, not only by the two people who
built it: anyone on the team registers a customer, builds their staged decks
(teaser, then engagement, then proof of value), sends them, and records what went
out — from the app **or from Claude on a phone**, with the company's own material
protected from being reshaped by accident.

Reached when a salesperson with an `editor` account can go from "new customer
called me" to "deck sent and recorded" without a checkout and without being able
to change what every future deck is made of.

## Notes

- **Charted and largely built 2026-08-07**, in one session, from a grilling that
  started as "put everything in Supabase and add an MCP" and turned out to be a
  question about **blast radius** rather than about storage.
- **The organising idea is mother and leaf.** A library slide and a master are
  *mothers*: editing one changes every deck built afterwards. A customer's deck
  is a *leaf*: it affects one customer. Almost every decision below is that
  distinction applied somewhere — to permissions, to the MCP tool list, to what
  may move to Supabase, and to what a "version" even means.
- **The security fact this map turned on** (measured, not assumed): a policy
  named `allow_authenticated` — `PERMISSIVE`, role `authenticated`, cmd `ALL`,
  `USING(true) WITH CHECK(true)` — was live on **eight tables**. Postgres OR's
  permissive policies, so it nullified every `is_member()`/`is_editor()`/
  `is_owner()` rule beside it: any signed-in member, including a `viewer` and
  including a `disabled` account, could read, write and **hard-DELETE** decks and
  immutable versions straight through PostgREST. `check-access.py` reported 17/17
  throughout, because it only ever tested as `anon`.
  Fixed and proved the same day; the invariant is now machine-checked.
  **The lesson recorded here: an adversarial suite that models only outsiders is
  half a suite.**
- **The previous map's assumption is dead.** `deck-studio-cloud` said the MCP was
  "almost certainly not creating a new artifact — that is CLI work". The
  2026-08-05 hosted assembler removed the reason, so the MCP creates and records
  freely at the leaf, and creates nothing at the mother.

## Decisions

1. **The slide library moves to Supabase with `slide_versions`**, mirroring
   `deck_versions`. Git keeps the gates, the CSS, the design-system specimens and
   the code. **Phase 2 — agreed, not built.**
2. **The MCP is a route on the Vercel app**, sharing the browser's handlers.
   Runners stay at two, parity checks stay at two. A Supabase Edge Function would
   have been a third implementation of assemble/verify/publish, or a way to write
   rows with no gate at all.
3. **OAuth 2.1 delegated to Supabase's OAuth server**, tokens verified against
   the project JWKS. Not a personal access token: a phone and a claude.ai
   connector have nowhere safe to paste one.
4. **The Python assembler retires**; JavaScript becomes the only assembler and
   `check-assemble-parity.py` retires with it. **Phase 2.** Found while scoping:
   `deckstudio.py` is imported by 12 tools, so this is a module split, not a
   deletion, and ~11 tools read `library/` off disk.
5. **MCP first, library migration second.** The MCP ships value over today's
   library; the migration then has a consumer proving its shape.
6. **Anyone registers a customer, guarded mechanically.** Registering creates a
   gated term, so the derived pattern is dry-run against every published version
   first. Verified: "Data" would have broken **16 of 20 decks**.
7. **A send is `deck_sends`, pinned to `(deck_id, version_n)`** — because the
   question you actually ask is "what are they holding", and an immutable version
   is the only thing that answers it.
8. **Masters are owner-only; editors propose via Save as a new deck.** Same
   mother/leaf line, applied to permissions.
9. **Any active member reads everything**; the MCP inherits the caller's
   identity. Per-customer read walls buy no threat removal at this size. Revisit
   for contractors or partners.
10. **MCP tools are task-shaped, named after the sales journey**, with no master
    or library-write tools at all. The absence is the boundary.

## Built (2026-08-07)

| What | Where |
|---|---|
| `allow_authenticated` removed from 8 tables; library reads require an active member | migrations |
| `policy_audit()` + 2 insider checks — **22/22**, regression-proved by planting a policy | `tools/check-access.py` |
| `deck_sends` + routes + customer timeline with a stale-version pill | `server.mjs`, `views/customers.js` |
| Customer name collision guard | `namescope.mjs`, `verify.mjs`, `server.mjs` |
| Mother/leaf enforcement: static, per-row, per-field, and per-slug on `/api/build` | `lib/guard.mjs` |
| MCP server: Streamable HTTP, stateless, 8 tools | `lib/mcp.mjs` |
| MCP auth: JWKS ES256, RFC 9728 PRM, 401 challenge | `lib/mcpauth.mjs` |

## Fog

- **`verifylib.py`'s fate in Phase 2.** Once Python stops assembling,
  `check-verify-parity.py` compares the live gate against a museum piece, and
  museum pieces rot. Retire it, or keep a genuine second opinion on the rule that
  blocks customer-name leaks?
- **Offline building is given up** by decision 4. Implied, never confirmed.
- **Sales stage is assumed to be the deck's `type`.** Breaks if a customer needs
  two teasers, or a different stage order per deal.
- **Concurrent editing** — inherited fog, and five editors makes it likelier.
- **The seven local-only actions** stay local; whether that blocks the team is
  untested.
- **Supabase `aud`** — whether its OAuth server honours RFC 8707 `resource` and
  sets `aud` to the MCP URL is unverified, because the server is disabled. The
  code is strict by default with a documented, opt-in relaxation.

## Blocked on a human

**Enable Authentication → OAuth Server** in the Supabase dashboard. Until then
`registration_endpoint` and `client_id_metadata_document_supported` are absent,
so Claude cannot register a client, and `/mcp` answers every tool call 401.
