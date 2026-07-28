# Consistent action grammar

**Type:** grilling · **Blocked by:** — (quick win) · **Status:** open

## Question

One rule for per-item action controls, applied everywhere. Today they diverge:
Decks rows use **labelled** buttons (Preview / PDF / Start draft); Social output
rows use **icon-only** (Preview, PDF, Post text, config, archive, delete); the
draft toolbar uses **icon + label**.

To settle:
- When is a control icon-only + tooltip vs icon + label? (e.g. primary actions
  labelled, secondary icon-only; or a density rule.)
- A fixed order and grouping for the common verbs (Preview, PDF, status, archive,
  delete) so they sit in the same place on every row.
- Accessibility: every icon-only control needs an aria-label, not just a title.
