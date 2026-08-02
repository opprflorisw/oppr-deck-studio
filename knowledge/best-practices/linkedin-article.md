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
- **The hero block is `.carousel--hero` in `templates/linkedin.css`** (specimen:
  `library/design-system/blocks/linkedin-article-hero.html`). Ink ground, claim
  only, one optional stat beside the claim. Write it with
  `python tools/build-article-hero.py --draft social/drafts/<slug>`, render with
  `build-social-image.ps1 -Width 1200 -Height 627`. The tool hard-refuses a claim
  over 95 characters, an em/en dash, and a mojibake character.
- Articles usually start as an **idea** in `research/last30days/posts/` and reach
  `social/drafts/` through Promote. The draft keeps `source_idea` and `themes`,
  so post engagement can be attributed back to the belief it argued.
- Structure: a title that states a claim, a one-paragraph promise, then the
  argument in sections mirroring Capture → Connect → Execute or a proof story.
  Real numbers, European format, illustrative payback.
- Public only. Link to oppr.ai in the closing section.
- v2 ships this as a **brief-only** composer (structured intent → CLI writes the
  markdown). A richer editor can come later.

### Learnings

- 2026-07-29 — Added the `.carousel--hero` (1200×627) block and
  `tools/build-article-hero.py`. The hero was the one LinkedIn asset with a
  documented size but no documented block, so it was being improvised. Ink ground
  was chosen over the light ground used for the single announcement card: an
  article banner renders directly beneath LinkedIn's own headline chrome, so the
  dark ground is what separates our asset from the platform's furniture.

- 2026-07-22 — Seed doc, brief-only for v2.
