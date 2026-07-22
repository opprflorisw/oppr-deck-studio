---
wayfinder: map
title: Oppr deck system — reusable slide + image library with personalize/edit modes
created: 2026-07-22
---

# Oppr deck system — reusable slide + image library

> **Wayfinder map.** This is the canonical artifact for this effort. It is an
> *index*, not a store: each decision lives in exactly one ticket under
> `tickets/`; this map only gists closed tickets and points at them.

## Destination

A written **spec + agreed approach** (not a built tool) for an Oppr deck system that:

1. Turns slides and images into a **described, reusable library** — slides that
   can travel between decks, and an image library that understands its own
   contents well enough to be retrieved by meaning.
2. Puts an **intent layer in front of every new deck**: a reusable **brief /
   recipe per presentation type** (goal, audience, language, focus, presenter,
   the slides that type tends to use) and an **interactive intake session** that
   asks those questions, then **proposes a plan** (reuse these slides, adjust
   those, create these new) for approval before building. A "living brain"
   substrated on Claude's memory so each deck starts smarter, not from blank.
3. Supports two modes: **Personalize** (assemble/adapt a canonical deck for a
   situation — client, language, length, audience, goal/emphasis — producing a
   frozen variant, no code required) and **Edit** (rework the canonical itself).
4. Keeps **canonical "best" versions** with history underneath.
5. Is built as a **structured Claude-Code library first**, with a **visual
   browser / deck-builder app named as a later phase** (not designed here).

Reaching the destination = Floris has signed off on this spec and it is ready to
hand to a build effort. **Nothing is built until then.**

## Notes

**This is a planning map.** Tickets resolve *decisions*, not build steps. The
deliverable is the spec. Do not start building the tool.

**Settled principles (established while charting — do not re-litigate):**
- Variants are **frozen snapshots**; canonical improvements never propagate back.
- Approach is **hybrid: library first, visual app later**. Stay HTML + Claude Code;
  no PowerPoint, no SaaS deck tool.
- **Team access is deferred** — an open scoping question, not answered now (see fog).
- Variant axes in scope: client · language · length/format · audience/industry ·
  goal/emphasis. All composed from the same library of elements.
- **A brief/recipe is per existing named cut** (Product Showcase, Management
  Outlook, Teaser, …) — one recipe each, growing as new kinds are made.
- The intake **proposes a plan and waits for approval, then builds** — it never
  silently auto-assembles a deck.
- The **"living brain" is substrated on Claude's memory system** (the `memory/`
  dir already holding deck-style prefs), not a separate database.

**Standing brand constraints** (from `CLAUDE.md` / `brand/BRAND.md`): no customer
names in shareable decks; no em dashes; European number formatting (€ 25.000 · 0,5%);
Capture → Connect → Execute framing; Analyze → Prove → Scale path.

**Skills every session should consult:** `grill-with-docs` / `grill-me` +
domain-modeling for decision tickets; `prototype` for prototype tickets;
`deep-research` / a research subagent for research tickets.

**Local-markdown tracker adaptation** (no git tracker configured, repo is not yet
a git repo). Wayfinder operations map to files as:
- **Map** = this file (`wayfinder: map` in frontmatter).
- **Tickets** = files in `tickets/NN-<slug>.md`, each with `type`, `status`
  (`open`/`closed`), `assignee` (empty = unclaimed = the claim mechanism),
  `blocked-by: [ids]`.
- **Frontier** = open tickets whose `blocked-by` are all closed and `assignee` empty.
- **Claim** a ticket by setting `assignee` before doing any work.
- **Resolve** = append a `## Resolution` section to the ticket, set `status: closed`,
  add a one-line pointer to *Decisions so far* below.
- **Assets** (prototypes, research notes) live under `.scratch/deck-tool/` and are
  linked from their ticket, not pasted into it.

## Decisions so far

<!-- one line per closed ticket; zoom the link for detail -->

- [02 — Image library semantics](tickets/02-image-library-semantics.md) — a hand-checkable
  `brand/img/library.json` manifest (description + tags + suggested_use + entitlement);
  Claude reads it at build time as the retriever, no embeddings at this scale.

## Draft destination delivered — [SPEC.md](SPEC.md)

At Floris's request (2026-07-22) the complete build instruction was drafted
directly, proposing resolutions for the open tickets rather than working them
one by one: element model (01 → §3), git baseline (03 → §6), repo structure
(04 → §2), variables (05 → §3), intake/assemble/edit workflow (06 → §7–8),
history & canonical marking (07 → §6), deck-type briefs & living brain
(08 → §5). Two additions settled mid-draft: the **self-describing repo /
knowledge layer** (§10a — Claude CLI + CLAUDE.md files are how the system is
understood and operated) and the **design system built with Claude Design**
(§10b — specimens in-repo, synced to a claude.ai/design project, new slides
compose only from documented blocks).

**Open tickets stay open until Floris approves the spec's checklist; on
approval they close as "resolved by spec" and building starts at Phase 0.**

## Frontier (takeable now)

- [01 — Element model: what a reusable slide is](tickets/01-element-model.md) — prototype
- [03 — Version-control baseline](tickets/03-version-control-baseline.md) — task

## Blocked (specified, waiting on a prior decision)

- [04 — Repository & naming structure](tickets/04-repository-structure.md) — needs 01, 03
- [05 — Personalization / variable model](tickets/05-personalization-variables.md) — needs 01
- [08 — Deck-type brief & the "living brain"](tickets/08-deck-type-brief-living-brain.md) — needs 01
- [06 — Intake, plan & assemble vs edit workflow](tickets/06-assemble-edit-workflow.md) — needs 01, 04, 05, 08
- [07 — History & canonical "best version"](tickets/07-history-canonical-versioning.md) — needs 03, 04

## Not yet specified

<!-- in-scope fog, toward the destination; graduates into tickets as the frontier advances -->

- **Language / translation alignment.** How FR/DE (and other) variants are produced
  and kept aligned with the source, given variants are frozen. Sharpens once the
  variable model (05) lands.
- **Team access & sharing** — the original "usable by people in my company, easily
  shareable" ask. Deliberately deferred; revisit once the library/workflow shape is
  settled, since who-uses-it changes what sharing means.
- **Phase-2 visual browser / deck-builder app.** The spec should *name* its role and
  rough scope, not design it. Sketch once the phase-1 element/workflow model exists.
- **Final spec synthesis** — assembling the resolved decisions into the single
  hand-off document that is this map's destination.

## Out of scope

<!-- ruled beyond this effort's destination; never graduates -->

- Building any part of the tool in this effort — this map produces the spec only.
- Moving to PowerPoint or a third-party SaaS deck tool — explicitly ruled out.
