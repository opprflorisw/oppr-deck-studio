# Best practice — LinkedIn article

## Platform practices

- Articles are long-form (no hard character limit in practice), published to your
  profile with a cover image, a title, and rich text. They are indexed by search
  engines (unlike posts) and persist on your profile.
- They earn less immediate feed reach than a post/carousel but compound over time
  and are shareable as a link. Best paired with a short post that links to them.

## How Oppr applies it

- **An article is written once, in `article.yaml`, and built into three things**
  by `python tools/build-article.py --article social/linkedin/<date>_<slug>`:
  `index.html` (the artifact), `article.md` (the plain-text read), `post.txt`
  (the LinkedIn post that carries it), plus the hero via
  `build-article-hero.py`. Publish both artifacts with
  `python tools/publish-article.py --article <dir>`, which runs the real verify
  gate and refuses on a FAIL.
- The document is styled by **`templates/article.css`** (`.apage`), a third
  format beside `deck.css` and `linkedin.css`. Same tokens, different job: a
  carousel page is a poster sized in pixels, an article is a column of prose. Its
  `page_format` is `none`, so verify skips geometry and still runs every brand
  rule.
- **Block vocabulary is closed**: `h2`, `p`, `stat`, `quote`, `list`,
  `contrast`, `cce`, `caveat`. A block that is not in `article.css` does not
  exist, exactly as for slides.
- **Every outside claim carries a `[n]` marker** that resolves in the Sources
  list. The builder fails on a marker with no source *and* on a source nobody
  cites, because an uncited source is borrowed authority.
- **Every article carries a `caveat` block** naming what it does not prove. In a
  category where six vendors say the same six things, the piece that states its
  own evidence limits is the one that reads as written by someone who checked.
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

- 2026-08-19 (same day, after the first Download PDF) — **Two bugs that only
  appear when you print.** Publishing passed because verify skips the PDF checks
  when there is no PDF, so both hid until the app printed one. (1) The page-count
  rule asserted one PDF page per `<section>` on every format, and an article is
  one section that prints across four or five sheets: fixed with `paged` in
  `PAGE_FORMATS`, in both runners. (2) Every hero printed at 1080×1350, because
  `@page` is document level and `linkedin.css` can only declare one size, the
  carousel's. Heroes had always been screenshotted, never printed, so nothing
  had ever exercised it; `build-article-hero.py` now emits its own `@page`.
  The lesson for the next output type: **print it before you call it published**,
  because half the gate is unreachable without a PDF. That is also why the nine
  articles now carry stored PDFs, which gives `check-verify-parity.py` a fixture
  that actually exercises the rule.

- 2026-08-19 — First nine real articles, and the format that made them possible.
  Four things learned. (1) **The article was the last output with no HTML
  document**, which is what kept it outside the edit → verify → PDF loop; giving
  it `templates/article.css` + `build-article.py` closed the roadmap item, and
  the artifact is now editable in the app like everything else. (2) **The
  builder had to be a gate, not a renderer.** Uncited sources and unresolved
  `[n]` markers are the two failure modes of a sourced piece, and both are
  invisible on the page, so they are hard stops at build time. (3) **The
  research changes the angle more often than it confirms it.** The ISO piece was
  briefed as "the new clauses will not fix the floor gap" and the draft says the
  opposite: 7.1.6 is being strengthened, which turns the piece from a complaint
  into a position on the category's top search term. Research before outline,
  every time. (4) **A leftover customer named `test` failed all nine articles**
  on the name-leak gate, because `\btest\b` matches ordinary English and every
  piece argues for testing. The customer-creation guard only dry-runs against
  artifacts that exist *at the time*, so a short generic name stays harmless
  until the day it is not. Register customers with their full trading name.

- 2026-07-29 — Added the `.carousel--hero` (1200×627) block and
  `tools/build-article-hero.py`. The hero was the one LinkedIn asset with a
  documented size but no documented block, so it was being improvised. Ink ground
  was chosen over the light ground used for the single announcement card: an
  article banner renders directly beneath LinkedIn's own headline chrome, so the
  dark ground is what separates our asset from the platform's furniture.

- 2026-07-22 — Seed doc, brief-only for v2.
