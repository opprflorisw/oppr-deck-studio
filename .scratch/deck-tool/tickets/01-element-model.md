---
type: prototype
status: open
assignee:
blocked-by: []
---

# 01 — Element model: what a reusable slide actually is

## Question

What is the concrete, portable representation of a reusable slide (and any
sub-slide "block"), such that it can travel from one deck into another despite
today's realities:
- slides are `<section>`s inside one monolithic `index.html`;
- they depend on shared classes in `templates/deck.css` + `templates/showcase.css`
  **and** deck-local `<style>` blocks;
- they carry `[DYNAMIC BLOCK]` variables (client, "prepared for", footer, named refs).

Decide the representation and prove it on real slides.

## Why it matters

Foundational. The repository structure (04), variable model (05), and the whole
assemble/edit workflow (06) all hang on what an "element" is. Getting this wrong
makes everything downstream leaky.

## Approach (prototype)

Take 3–4 real slides from `decks/2026-07-21_product-showcase/index.html` (pick ones
with different dependencies: a plain content slide, one using `showcase.css`
classes, one with a `[DYNAMIC BLOCK]`, one with an image) and try representing each
as a self-contained, reusable element. Options to weigh concretely:
- one `.html` fragment per slide + a small metadata sidecar (tags, variables, which
  stylesheets it needs);
- a slide *catalog* that references sections in existing decks by id (no copy);
- a partials/include system assembled at build time.

Surface what breaks (CSS coupling, variable leakage, image paths) and recommend one.

## Done when

A recommended element representation is written up, with a worked example of the
same slide living in the library and being dropped into a second deck.
