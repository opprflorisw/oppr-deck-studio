---
type: grilling
status: closed
assignee:
blocked-by: [01, 04, 05, 08]
---

# 06 — Intake, plan & assemble vs edit workflow

## Question

What is the concrete end-to-end workflow — the "somewhere I go when I have a new
idea" — from intake to finished deck:
1. **Intake**: the interactive session that, driven by the chosen deck-type brief
   (08), asks who/what/language/focus/presenter/goal;
2. **Propose a plan**: from the answers, produce the filled brief + a recommended
   slide list — reuse these library slides, adjust those, create these new — and
   **wait for approval before building** (settled principle);
3. **Assemble**: cherry-pick the approved slides, pull images by meaning (02), fill
   variables (05), and produce a frozen variant + its PDF;
4. **Edit**: rework a canonical deck itself.

And what is the guardrail boundary between Personalize and Edit modes?

## Why it matters

This is the actual daily experience of the tool. It must feel like answering a few
questions and getting a proposed deck to approve, not reinventing the wheel — with a
clear, deliberate step into full edit. It also has to fold in the existing
build/verify loop (`tools\build-pdf.ps1` + the PDF page-count / visual checks in
CLAUDE.md).

## Depends on

- **01** (elements), **04** (structure), **05** (variables) — the workflow operates
  on all three.
- **08** (deck-type brief) — the intake reads the brief to know what to ask and what
  slide skeleton to propose.

## Open sub-questions

- Entry point: a Claude-Code command/prompt (the intake is a conversation), a
  browsable index, or both?
- What the intake asks vs. what it infers from the brief; how it presents the proposed
  plan for approval.
- How cherry-picking presents the library (this is where the phase-2 visual app will
  eventually plug in — name the seam).
- Where PDF build + verify sits in the flow.
- What "more feedback while in the tool" (Floris's phrase) concretely means here.

## Done when

The end-to-end flow (intake → proposed plan → approval → assemble) and the Edit flow
are each specified as a concrete sequence of steps, with the mode boundary and the
build/verify integration named.

## Resolution

Resolved by SPEC.md and **built**: §7/§8 — /new-deck + /edit-canonical; Phase 4 (teaser variant proves it).
