# Best practice — social image

## Platform practices

- **Square 1080×1080** is the safe single-image feed format across LinkedIn, X
  and Instagram. **1200×627** is the link-preview / shared-article image ratio
  (~1.91:1).
- Single images get less carousel-style dwell but are quick to produce and good
  for a one-line message or a quote card. Text on image should be large and high
  contrast; keep the key message out of the corners (platform UI overlaps them).

## How Oppr applies it

- Template `templates/social-image.css` (Phase 4): page types for 1080×1080 and
  1200×627, brand tokens, huge type, one message. Documented blocks only.
- Public only. One idea, one accent, European numbers, no em dashes.
- Built by a render tool to PNG/PDF, named with `oppr`, verified (size, no
  unfilled placeholders), human-approved.
- v2 ships as a **brief-only** composer; the template lands with first real use.

### Learnings

- 2026-07-22 — Seed doc.
