# Best practice — YouTube thumbnail

## Platform practices

- **1280×720 (16:9)**, ≥ 640 px wide, under 2 MB, JPG/PNG/GIF. Shown very small
  in feeds and very large on a TV, so it must read at both.
- High contrast, 1–4 large words, one clear focal point (a face or a single
  object works best). Avoid clutter and small text; the bottom-right corner is
  covered by the duration stamp.

## How Oppr applies it

- Template `templates/youtube-thumb.css` (Phase 4): 1280×720, oversized type,
  high-contrast brand grounds (ink or accent), one message. Documented blocks
  only.
- Keep the key words out of the bottom-right (duration overlay). Public only.
- Built to PNG, named with `oppr`, human-approved.
- v2 ships as a **brief-only** composer; template lands with first real use.

### Learnings

- 2026-07-22 — Seed doc.
