---
type: task
status: open
assignee:
blocked-by: []
---

# 03 — Version-control baseline

## Question

Is this repo under version control, and what is the history baseline the system's
"canonical best version" + frozen-variant model will sit on top of?

## Why it matters

Floris explicitly wants slide/deck history ("look back at old versions", mark a
canonical best). The repo is currently **not a git repo** (per environment). Any
history/versioning decision (07) is blocked until there is a baseline. This is a
concrete prerequisite, not a decision — hence a task.

## Approach (task)

- Confirm current state (no `.git`).
- Decide + record the version-control substrate for the deck manager: almost
  certainly `git` locally, with a `.gitignore` for rendered PDFs / build junk as
  appropriate (or a deliberate choice to commit PDFs — flag the trade-off).
- **Do not run `git init` without Floris's go-ahead** — this is a repo-shaping act.
  Present the recommendation, get the yes, then establish the baseline commit.

## Done when

The repo has (or has an agreed plan for) a version-control baseline, and the
`## Resolution` records what history primitives later tickets (07) can rely on:
commit history per deck folder, tags for canonical "best" versions, etc.
