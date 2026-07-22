---
wayfinder: map
title: Oppr Deck Studio App — local viewer/composer + /deckbuilder orchestrator + LinkedIn
created: 2026-07-22
---

# Oppr Deck Studio App — viewer, composer, orchestrator

> **Wayfinder map.** Canonical artifact for this effort. An *index*, not a
> store: each decision lives in exactly one ticket under `tickets/`; this map
> only gists closed tickets and points at them. Graduated from the first map's
> fog item "Phase-2 visual browser / deck-builder app"
> (see `.scratch/deck-tool/MAP.md`).

## Destination

A written **super-detailed build instruction (`APP-SPEC.md`)** — not a built
tool — for:

1. **A local app** (`npm run dev`) that is a **viewer** over everything the
   studio has (library slides with thumbnails, canonical decks, variants,
   image library) and a **composer**: cherry-pick slides into a **draft deck**,
   reorder, attach a comment per slide ("this is what I want changed here"),
   insert **new-slide placeholders** with instructions, and preview the draft
   as a deck.
2. **The handoff**: the app saves the draft as structured files in
   `decks/drafts/<slug>/` and gives Floris one short line to paste into the
   CLI. The **CLI stays the engine** — assembly, new-slide creation, verify,
   PDF all happen there, with the existing approval gates.
3. **One orchestrator skill, `/deckbuilder`**, as the single CLI front door:
   "build this draft", "I want to make a LinkedIn carousel", etc. — it routes
   to the right workflow instead of Floris memorizing many commands.
4. **LinkedIn output in v1 scope**: brand-styled carousel (document post PDF)
   + post text with unicode formatting ready to paste, produced through
   `/deckbuilder`.
5. **PDF naming rule**: every built PDF carries `oppr` in the filename, plus
   the customer name for client-specific decks — enforced mechanically.

Reaching the destination = Floris signs off on `APP-SPEC.md` and it is ready
to hand to a build effort. **Nothing is built until then.**

## Notes

**This is a planning map.** Tickets resolve *decisions*, not build steps.
The deliverable is the spec. Do not start building the app.

**Settled while charting (do not re-litigate):**
- App shape: **local dev server that reads the repo live** and can save drafts
  back to disk. Started with `npm run dev`.
- Handoff: **draft folder + short prompt** (`decks/drafts/<slug>/` holding
  slide order, per-slide comments, new-slide briefs) — never one giant
  copy-paste prompt, never the app writing final `deck.yaml` variants itself.
- **The app composes; it never edits the library.** Edit mode stays
  `/edit-canonical` in the CLI. The Personalize/Edit wall from the first map
  holds.
- CLI front door: **one orchestrator skill `/deckbuilder`**, not many separate
  skills. Existing commands may become routes under it (ticket 01).
- **LinkedIn is in the v1 spec** (carousel + unicode post text, brand-styled).
- **Gemini image generation is a later phase** but the spec names its place.
  The API key lives ONLY in a gitignored `.env` as `GEMINI_API_KEY` — never in
  the repo, never in a spec file. The key pasted in chat on 2026-07-22 is to be
  **rotated** (ticket 09).
- PDF naming pattern (to confirm in ticket 08):
  `YYYY-MM-DD_oppr_<type-or-purpose>[_<client>].pdf`.

**Standing constraints** (from `CLAUDE.md` / `brand/BRAND.md`): entitlement
gating (no customer names in shareable output — applies to LinkedIn too);
no em dashes; European number formatting; Capture → Connect → Execute framing;
design-system composition rule for any new slide or carousel template.

**Skills every session should consult:** `grill-with-docs` / `grill-me` +
domain-modeling for grilling tickets; `prototype` for prototype tickets;
research subagents for research tickets.

**Local-markdown tracker** (same adaptation as `.scratch/deck-tool/MAP.md`):
tickets = `tickets/NN-<slug>.md` with frontmatter `type`, `status`
(`open`/`closed`), `assignee` (empty = unclaimed), `blocked-by: [ids]`.
Frontier = open, unblocked, unassigned. Claim by setting `assignee` first.
Resolve = append `## Resolution`, set `status: closed`, add a one-liner to
*Decisions so far*. Assets live under `.scratch/deck-app/` (e.g. `research/`,
`prototypes/`), linked from tickets.

## Decisions so far

<!-- one line per closed ticket; zoom the link for detail -->

## Frontier (takeable now)

- [01 — /deckbuilder orchestrator: scope & routes](tickets/01-deckbuilder-orchestrator.md) — grilling
- [02 — Draft model & lifecycle](tickets/02-draft-model-lifecycle.md) — grilling
- [03 — App UI prototype](tickets/03-app-ui-prototype.md) — prototype
- [05 — LinkedIn carousel & post format facts](tickets/05-linkedin-format-research.md) — research (subagent fired)
- [07 — Gemini image generation capabilities](tickets/07-gemini-imagegen-research.md) — research (subagent fired)
- [08 — PDF naming convention & enforcement](tickets/08-pdf-naming.md) — grilling (small)
- [09 — Rotate Gemini key + .env handling](tickets/09-gemini-key-env.md) — task (HITL)

## Blocked (specified, waiting on a prior decision)

- [04 — App tech stack & repo integration](tickets/04-app-stack.md) — needs 03
- [06 — LinkedIn workflow design](tickets/06-linkedin-workflow.md) — needs 01, 05
- [10 — APP-SPEC.md synthesis](tickets/10-spec-synthesis.md) — needs 01–09

## Not yet specified

<!-- in-scope fog; graduates into tickets as the frontier advances -->

- **Image-generation UX.** Where "make me an image" lives — a button in the
  app, a `/deckbuilder` route, or both — and how generated images enter
  `brand/img/` + the manifest with description/entitlement. Sharpens after
  tickets 03 and 07.
- **Other social formats.** Floris named "a LinkedIn post or a LinkedIn
  carousel or things like that" — X posts, one-pagers, email snippets may
  follow the same pattern. Sharpens once the LinkedIn workflow (06) exists.
- **Team access & hosting of the app** — carried from the first map. A local
  dev server is single-user by nature; whether/how colleagues get it changes
  the stack. Revisit after 04.
- **App write-back beyond drafts.** Today the app only writes
  `decks/drafts/`. Whether it ever gains safe edit affordances (e.g. editing
  a variant's own overrides) is undecided fog, leaning out-of-scope for v1.

## Out of scope

<!-- ruled beyond this effort's destination; never graduates -->

- Building the app in this effort — this map produces `APP-SPEC.md` only.
- Replacing the CLI as the engine: assembly, new-slide generation, verify,
  PDF, approval gates stay in Claude Code. The app is eyes + hands, not brain.
- Editing library slides or canonicals from the app (Personalize/Edit wall).
