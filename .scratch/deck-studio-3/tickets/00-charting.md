# 00 — Charting: destination and scope

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris
- **blocked by:** —
- **blocks:** all

## Question

What is this effort finding its way to, how should mother-slide changes reach the
decks that use them, what did "multiple versions of the mother slides in different
proportions" actually mean, and is link-sharing part of the target?

## Answer

**Destination: a locked spec, then one build effort.** Not rebuild-in-place. The
propagation model touches publish, verify, the app editor and every existing deck
at once, so deciding it half-built produces two systems.

**Propagation: flag and accept, per deck.** Decks stay recipes. Editing a mother
slide marks every deck using it as behind, the app shows which pages drifted and a
side-by-side of old against new, and Floris accepts per deck (or per page), which
creates a new version. A deck already sent to a customer stays exactly as sent
until accepted. Rejected: automatic republish (silently changes what was emailed),
build-time-only (does not solve the actual problem), and a two-tier split
(two behaviours to keep straight).

**No length variants of a slide.** Floris, verbatim: *"i dont want the same slide
in different lengths.. we are going to use more slides if we need more explained..
then we can keep the slides consistent and not have variations of that specific
slide."*

Instead, depth is chosen per **chapter**. A chapter (subject, section) holds
several slides. The Product Showcase takes more slides from a chapter, the
Management Review takes fewer. A slide that covers the ground of three others is
**not** marked as a summary slide and is not a special kind: it is simply one more
slide in that chapter that you can choose instead of the three. Floris: *"it's more
going to be 1 of the slides in that specific chapter or section of the deck that
you can then choose from."*

This is already latent in the content. Building the two masters on 2026-08-03,
Management Outlook took `engagement-ladder` alone while Product Showcase took
`engagement-ladder` plus `step1-analyze` / `step2-prove` / `step3-scale`. That is a
chapter pick made by hand with nowhere to record it.

**A slide refresh runs before chapters.** Added mid-charting: the library holds
three near-copies of many slides across the three masters, and Floris picks one
winner per cluster before anything is sorted into chapters. Explicitly a content
exercise, not tooling: *"we don't need to build a tool around it."* Ticket 02.

**Sharing: fix the PDF, do not add a link viewer.** PDF stays the thing you send:
opens everywhere, works offline, survives forwarding, prints. Link-sharing is
recorded as out of scope on the map.

## Evidence gathered while charting

- `tools/snapshot.py` already stamps `data-slide-id` and `data-role` on every
  `<section>`, so a published deck records its parentage per page. The deck's
  *recipe* is not stored anywhere in the backend: it lives only in `deck.yaml` in
  a build-scratch folder that gets deleted after publish.
- The Product Showcase PDF (18 pages, 2.868.605 bytes) carries **57 Type 3 font
  objects**, 7 to 21 per page. Real images account for about 1,8 MB across three
  pages. Chrome's print path cannot embed the variable fonts
  (`Archivo-var.woff2`, `JetBrainsMono-var.woff2`) and falls back to Type 3, where
  every glyph becomes a vector drawing procedure re-declared per page. That
  explains why compressing to 800 KB leaves it just as slow: the cost is the
  viewer re-executing glyph procedures, not the byte count.

  > **Corrected by ticket 08, 2026-08-04.** The Type 3 finding is right about
  > **size** and wrong about **speed**. PDFium caches each Type 3 glyph after
  > executing it once, so removing Type 3 entirely moves the 18-page deck from
  > 4.714 ms to 4.369 ms. The scroll cost is the cover scrim: three stacked
  > full-bleed gradients written as per-pixel shading functions, costing 2.671 ms
  > on page 1 against 70 to 130 ms on every other page. Both are worth fixing, for
  > different reasons. See ticket 11.
