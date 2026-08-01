# Docs match reality

Type: task · Status: open · Blocked by: One store of truth, CLI and app handover contract, Artifact model, Command surface consolidation

## Question

Rewrite the documentation set so a fresh session in a clean clone builds the
right thing — and so the docs cannot drift this far again.

Deliberately last: the docs describe the decisions, so they cannot be written
until the decisions exist.

## Why it matters

CLAUDE.md's own promise is that "a fresh session in a clean clone should be able
to build a deck from these docs alone". Floris confirmed the docs have drifted.
Known drift already visible:

- The root `CLAUDE.md` layer list still calls `decks/canonical/<type>/` "the
  masters (a `deck.yaml` composition)" in layer 4, then states two rules later
  that masters are a **tag**, not that folder. Both sentences are in the same
  file.
- "Build & verify (MANDATORY)" documents the CLI path; nothing documents the
  app's build path, which uses the same gate through different code.
- The app's editor — the capability Floris did not know existed — appears once,
  inside a dense paragraph in layer 7.
- `.scratch/deck-app/APP-SPEC.md` (v1) and `V2-SPEC.md` are cited as the design
  rationale, but `hybrid-editor/report_and_implementation.md` (v3) supersedes
  both, and the older nav-overhaul map records its own partial supersession.
- The roadmap section lists "Team access & sharing (deferred)" alongside items
  since built.

## Scope

- Root `CLAUDE.md` — the manual. Aim for shorter, not longer: it is currently
  carrying decisions that belong in the layer docs.
- Per-folder `CLAUDE.md`s: `library/`, `decks/`, `social/`, `types/`, `dump/`,
  `knowledge/`, `research/`
- `app/README.md`
- `.claude/commands/*.md` (whatever survives *Command surface consolidation*)
- `.scratch/*/` SPECs — mark superseded ones as superseded rather than leaving
  them cited as current

## What "cannot drift again" means

Decide one mechanism and implement it, do not just promise diligence. Candidates:

- A `--check` mode that fails when a documented path does not exist (precedent:
  `tools/research-brain.py --check` already does this for the brain)
- Every rule stated **once**, with the other places linking to it
- A dated changelog line per decision, so supersession is visible

## Execution

Rewrite, then verify by the file's own standard: read only the docs and check
that each of Floris's real tasks is answerable from them.
