---
id: 06
title: LinkedIn workflow design (/deckbuilder route)
type: grilling
status: open
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
