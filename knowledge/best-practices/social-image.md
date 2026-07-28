# Best practice — social image

## Platform practices

- **Square 1080×1080** is the safe single-image feed format across LinkedIn, X
  and Instagram. **1200×627** is the link-preview / shared-article image ratio
  (~1.91:1).
- Single images get less carousel-style dwell but are quick to produce and good
  for a one-line message or a quote card. Text on image should be large and high
  contrast; keep the key message out of the corners (platform UI overlaps them).

## How Oppr applies it

- **The square social image rides on `templates/linkedin.css`**, it does not fork
  a second set of tokens. Use `.carousel carousel--square carousel--single` with
  one `.lpage`, and compose from the documented LinkedIn blocks. A separate
  `social-image.css` only becomes worth it when 1200×627 lands (different canvas,
  different type scale).
- Public only. One idea, one accent, European numbers, no em dashes.
- Build:
  ```
  .\tools\build-social-image.ps1 -Image social\linkedin\<date>_<slug>
  ```
  Headless Chrome screenshot at the canvas size; the tool reports the real pixel
  size and warns if the crop drifted. Named with `oppr`, then the visual pass.
- No page number and no open loop on a single card: there is nothing to swipe to.

### Learnings

- 2026-07-23 — First real single image (hiring a Senior Developer). Four things
  learned. (1) **Light ground, not ink.** The ink page was tried first and lost:
  an announcement is read once, mid-scroll, by someone who did not ask for it, and
  the light ground is the higher-contrast, faster read at thumbnail size. Ink
  reads as a campaign, light reads as a notice. (2) A centred stack on a page whose
  wordmark is absolutely positioned lands visually low, because the slack splits
  evenly while the mark eats the top band. `.carousel--single` reserves that band
  as top padding. (3) **A headline that works inside a document does not work on a
  card.** The first headline was the source material's own sharpest line, and it
  needed the reader to decode a relationship before learning what the thing was.
  On a single card the headline states the subject plainly; the good line belongs
  in the post text, where the reader has already stopped. (4) Tag sets pack into
  two clean rows when ordered **longest-first**; source order leaves an orphan on
  a third row. Type size is not the lever there, the 26px floor holds.
- 2026-07-22 — Seed doc.
