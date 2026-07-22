---
type: research
status: closed
assignee: research-subagent
blocked-by: []
---

# 02 — Image library semantics

## Question

How should the image library describe its own contents so the assembly/personalize
step can retrieve the right image **by meaning** ("get me something that reinforces
'operators are the sensor'") rather than by remembering filenames?

## Why it matters

Floris named this a first-class pillar: "an image library that has understanding of
the image it has so that it can get it when it feels that adds value to the
messaging." Images are added when needed and should be pullable by intent.

## Approach (research)

Inspect the current setup (`brand/img/`, the contact sheet `brand/img/index.html`,
`tools/build-asset-index.ps1`) and propose 2–3 concrete approaches with trade-offs,
suited to an HTML + Claude-Code workflow that stays local and simple:
- a JSON/YAML manifest of per-image descriptions + tags + suggested-use keywords,
  regenerated alongside the contact sheet;
- lightweight keyword/tag search vs. embedding-based semantic search;
- how the assembly step (Claude) would query it during a build.

Recommend the lightest thing that gives real retrieval-by-meaning. Note whether an
embedding pipeline is worth it or overkill for this scale.

## Done when

A short findings note (under `.scratch/deck-tool/research/`) recommends an approach
with rationale and a sketch of the manifest shape + how a build would query it.

## Resolution

**A hand-checkable JSON sidecar manifest, `brand/img/library.json`, with
Claude-as-retriever at build time. No embeddings.**

Full findings: [research/02-image-library-semantics-findings.md](../research/02-image-library-semantics-findings.md).

- Per-image object: `description` + `tags` + `suggested_use` (message-level phrases
  in Oppr's Capture→Connect→Execute vocabulary) + `entitlement` / `orientation` /
  `type`. A few KB total for the current **23 images**.
- **At this scale Claude reading the manifest IS the semantic search** — it fuzzy-
  matches slide intent against the descriptions in context. A vector DB / embedding
  pipeline is overkill until ~150+ images, and even then would embed these same
  description strings, so the manifest is forward-compatible.
- **`entitlement` is load-bearing**: it lets retrieval honor the named-customer rule
  (Holliday/Venator → Mutares-entitled decks only) instead of trusting memory.
- Two free wins: seed `description`s by harvesting the meaning-rich `alt` text already
  in the two decks, and reuse each manifest `description` as the chosen image's `alt`.
- **Only tooling change:** extend `tools/build-asset-index.ps1` to render descriptions
  in `index.html` and warn on any file↔manifest mismatch — that is the whole sync
  mechanism.

**Feeds:** the element model (01) and repository structure (04) — images are library
elements too, and this fixes how they carry meaning + entitlement. The assemble
workflow (06) will consume the "Claude queries the manifest at build time" step.
