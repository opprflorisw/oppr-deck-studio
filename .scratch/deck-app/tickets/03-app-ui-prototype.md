---
id: 03
title: App UI prototype — viewer + composer wireframe
type: prototype
status: open
assignee:
blocked-by: []
---

## Question

Raise fidelity with a cheap clickable wireframe (static HTML is fine, reusing
deck.css tokens) covering the flows Floris described:

- **Browse**: all library slides as thumbnail cards (roles, tags, entitlement
  badges), existing decks as filmstrips, the image library.
- **Compose**: cherry-pick slides into a draft strip; see the 10 picked slides
  as a draft deck; reorder; click a slide to attach a comment; press
  "**+ add new slide**" between any two slides and type the instruction.
- **Handoff**: a "Generate handoff" view showing what gets saved to
  `decks/drafts/<slug>/` and the one-line prompt to paste into the CLI.

React to it together, then feed the agreed layout into tickets 02 (draft
model) and 04 (stack). Asset lands in `.scratch/deck-app/prototypes/`.
