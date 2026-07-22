---
id: 05
title: LinkedIn carousel & post format facts
type: research
status: closed
assignee: claude (subagent)
blocked-by: []
---

## Question

Surface the facts the LinkedIn workflow (06) depends on, as of mid-2026:

1. **Carousel (document post)**: accepted file type (PDF), recommended page
   aspect ratio & pixel size (1:1 1080×1080 vs 4:5 1080×1350), max pages, max
   file size, how text renders at feed size (min font size guidance).
2. **Post text**: character limit, where the "see more" fold falls, hashtag
   and mention behavior, line-break handling.
3. **Unicode formatting** (bold/italic via Mathematical Alphanumeric Symbols):
   what renders reliably on desktop/mobile, and the documented downsides
   (screen-reader accessibility, searchability) so we can use it deliberately
   and sparingly.
4. **Personal profile vs company page** differences for documents/carousels.
5. Any 2025–2026 changes to how LinkedIn treats documents/carousels
   (reach, dwell-time weighting) worth knowing for format choice.

Findings → `.scratch/deck-app/research/05-linkedin-formats.md`, cited.

## Resolution

Resolved 2026-07-22. Full cited findings: [../research/05-linkedin-formats.md](../research/05-linkedin-formats.md).

- Document posts accept PPT/PPTX/DOC/DOCX/PDF, max 100 MB / 300 pages (official
  LinkedIn Help); PDFs must be flattened, uniform page size; not editable after post.
- 2026 best practice page: 1080×1350 px (4:5 portrait) — taller = more dwell time
  on mobile; 8–10 pages, export < 5 MB. Font floor on 1080 canvas: body ≥ 32 px,
  headlines 60–80 px, one idea / ≤ 35 words per page.
- Post text: 3.000-char limit; "see more" fold ~210 chars desktop / ~140 mobile
  (write the hook in the first 140); blank lines collapse — single Enter between
  paragraphs; 0–3 hashtags (no reach boost since hashtag-follow was removed).
- Unicode bold = Mathematical Alphanumeric substitution: bold sans-serif renders
  reliably, but screen readers spell it letter-by-letter and search can't index it.
  Policy: max 1–3 short phrases per post, never numbers or searchable keywords.
- Personal profile reaches ~5–10x a Company Page; same document capabilities on
  both. 2026 algorithm weights dwell time and saves; carousels are the top
  engagement-rate format again after the 2024–25 video push.
