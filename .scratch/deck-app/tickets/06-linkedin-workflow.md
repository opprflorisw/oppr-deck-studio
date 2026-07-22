---
id: 06
title: LinkedIn workflow design (/deckbuilder route)
type: grilling
status: closed
assignee:
blocked-by: [01, 05]
---

## Question

Design the "/deckbuilder — I want to make a LinkedIn carousel/post" route:

1. **Carousel as a mini-deck**: portrait/square page templates as new
   design-system patterns (deck.css tokens at carousel size) — which template
   set does v1 need (hook page, point pages, CTA page)? How does content flow
   from an existing deck's slides ("carousel-ify this deck") vs. from scratch?
2. **Post text**: the walkthrough that produces the accompanying text —
   hook, body, CTA, hashtags — with unicode formatting applied only where
   research (05) says it's safe, ready to copy-paste.
3. **Outputs & home**: where results live (`linkedin/<date>_<slug>/` with
   PDF + post.txt + provenance?), naming (must carry `oppr`), and whether
   they're committed like deck PDFs.
4. **Gates**: entitlement rules apply fully (public by definition!), verify
   equivalent for carousels (page size, fonts, no em dashes, no unfilled
   placeholders), and a human approval stop before anything is called done.

## Resolution

Built 2026-07-22. `templates/linkedin.css` = self-contained 4:5 (1080×1350) page
format with `.lpage--hook/point/cta`, `.lstat`, `.lband`; on-screen gap gated to
`@media screen` so each page = one PDF page. `tools/build-carousel.ps1` renders a
4:5 PDF named with `oppr`. Outputs live in `linkedin/<date>_<slug>/` (index.html +
PDF + post.txt). Proven with `linkedin/2026-07-22_operators-are-the-sensor/`
(6 pages, visually verified). Public by definition: entitlement gating applies,
no named-customer material. Route B in `/deckbuilder`. Post-text + unicode rules
from ticket 05.
