# Best practice — LinkedIn article

## Platform practices

- Articles are long-form (no hard character limit in practice), published to your
  profile with a cover image, a title, and rich text. They are indexed by search
  engines (unlike posts) and persist on your profile.
- They earn less immediate feed reach than a post/carousel but compound over time
  and are shareable as a link. Best paired with a short post that links to them.

## How Oppr applies it

- Output is a markdown file + a hero image reference under
  `social/linkedin/<date>_<slug>/` (article.md + hero). The markdown is the
  paste-in source; the hero is a 1200×627 brand image.
- Structure: a title that states a claim, a one-paragraph promise, then the
  argument in sections mirroring Capture → Connect → Execute or a proof story.
  Real numbers, European format, illustrative payback.
- Public only. Link to oppr.ai in the closing section.
- v2 ships this as a **brief-only** composer (structured intent → CLI writes the
  markdown). A richer editor can come later.

### Learnings

- 2026-07-22 — Seed doc, brief-only for v2.
