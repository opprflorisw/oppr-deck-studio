# Best practice — LinkedIn carousel (document post)

## Platform practices

Sources: LinkedIn Help (document posts) + 2026 marketing research; full cited
findings in `.scratch/deck-app/research/05-linkedin-formats.md` (2026-07-22).

- A carousel is a **document post**: upload a **PDF** (PPT/DOC also accepted).
  Hard caps: **100 MB, 300 pages**; one document per post; not editable after
  posting; animations flatten to static; uniform page size required; viewers can
  download the PDF.
- **Page size: 1080×1350 px (4:5 portrait)** is 2026 best practice (converged
  from older 1:1 advice, driven by mobile dwell time). **8–10 pages** typical.
  Export well under 5 MB.
- **Type floor** on the 1080 canvas: body ≥ 32 px, headlines 60–80 px. One idea
  and ≤ 35 words per page.
- The feed weights **dwell time** and **saves** (saves ≈ 5× likes). External
  links in the post body are down-ranked. Carousels are again a top
  engagement-rate format after the 2024–25 video push.

## How Oppr applies it

- Build on `templates/linkedin.css` (4:5, `@page` sized). Compose only from the
  documented blocks: `.lpage--hook`, `.lpage--point`, `.lpage--cta`, `.lstat`,
  `.lband`. New pattern → add it to `linkedin.css` first.
- **6 pages** is our default (hook → 3–4 point/stat pages → ink CTA). Public
  entitlement only. European numbers, no em dashes, payback illustrative.
- Page 1 is the whole hook: it must earn the swipe on its own. The CTA page names
  the action (visit oppr.ai / book a data analysis) and carries `oppr.ai`.
- Put the link in the post's first comment, not on the pages as live text.
- Build with `.\tools\build-carousel.ps1 -Carousel social\linkedin\<date>_<slug>`,
  then the visual pass at feed size.

### Learnings

- 2026-07-22 — First carousel (`operators-are-the-sensor`) confirmed the pipeline:
  on-screen page gap must be `@media screen` only, or blank PDF pages appear.
