# Verify gate unification

Type: grilling · Status: open · Blocked by: Artifact model

## Question

There are three gates enforcing three different rule sets. Should there be one,
and what is the rule set per artifact type?

## Why it matters

Floris named this: "what passes in one place fails in another."

| Gate | Where | Enforces |
|---|---|---|
| `tools/verify-deck.py` (+ `verifylib.py`) | CLI and the app's build job | page count == slide count == `data-total`, 13.333 × 7.5 in, zero em dashes, zero unfilled `{{...}}`, footer discipline by role, image entitlement ≤ deck clearance, PDF filename contains `oppr` + client slug; WARNs on Anglo number formatting and blank pages |
| `tools/verify-carousel.py` | CLI, carousels only | the LinkedIn playbook (4:5, frame rules) |
| `app/lib/htmlcheck.mjs` | every app save | structural fingerprint only — says nothing about brand rules |

The app's editor also enforces the em-dash rule **client-side, silently**, which
is a fourth place the same rule lives.

## What a good answer settles

- Whether the rules split cleanly into **universal** (no em dashes, no unfilled
  placeholders, entitlement ≤ clearance, European number formatting) and
  **format-specific** (page size, footer discipline, frame count, filename), and
  whether one engine can carry both with a per-type rule set.
- Whether `verifylib.py` becomes the single source and everything else calls it —
  including a Node path for `htmlcheck.mjs`, or `htmlcheck.mjs` shelling to
  Python. Note the **hosted-ready-later** constraint from the map's Notes: a new
  hard Python dependency in the save path is a step backwards.
- Whether structural-fingerprint checking and brand-rule checking are the same
  gate or two gates that both must pass, and at which moments each runs (save,
  build, publish).
- What a FAIL does in each context — block the save, block the PDF, or warn.

## Evidence to gather while resolving

- `tools/verifylib.py`, `tools/verify-deck.py`, `tools/verify-carousel.py`,
  `app/lib/htmlcheck.mjs`
- `app/lib/jobs.mjs` `_run()` — how the report is parsed and stored
