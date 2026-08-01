# social/ — outward channel output (carousels, posts, images, thumbnails)

Everything Oppr publishes on a social channel lives here, made through
`/deckbuilder` ("I want a LinkedIn carousel/post", etc.). One folder per channel:

- `social/linkedin/<date>_<slug>/` — carousels (4:5 PDF + `post.txt`), posts,
  articles.
- `social/youtube/<date>_<slug>/` — thumbnails (1280×720).
- `social/x/…`, future channels beside these.
- `social/drafts/<slug>/draft.json` — a social draft staged by the app, built by
  the CLI, then cleared (same staging discipline as `decks/drafts/` and `dump/`).
The channel folders are **build scratch**, exactly like `decks/<slug>/`: the CLI
builds into one, publishes it, and the folder is then disposable. Nothing here is
committed. The published outputs on disk were deleted on 2026-08-01 after
confirming every one of them in `social_outputs`.

The **publish log** (per built output slug: `draft`/`posted`, the posted date and
the post link) is the `publish_log` **table**, read and written by the app's
Social output view through `/api/publish-log`. The old `_status.json` file
is retired. It is tracking metadata, never a built artifact; the app filters on
it (All / Draft / Posted) and turns the link into "open the post".

## Publishing is part of building, not a follow-up

Built output lives in the **backend**, not in this folder: the app lists the
`social_outputs` table, so a folder written here and never published does not
exist as far as Floris is concerned. Every build ends with:

```powershell
python tools\publish-social.py     # re-runnable: uploads files, upserts rows
```

Then read the row back and download one object to confirm the bytes landed, not
just the row. See "Nothing is done until it is in the backend" in the root
`CLAUDE.md`. `social/drafts/` is deliberately excluded from this: it is staging,
and the CLI turns a draft into a real output first.

Each built output carries `oppr` in its filename (see the naming rule in the root
`CLAUDE.md`). Best-practice facts and Oppr's own usage rules for each format live
in `knowledge/best-practices/<type>.md` and are the source the workflow reads.

## Category (the app's Social output tabs)

An optional `social/<channel>/<date>_<slug>/meta.yaml` with a `category:` field
tells the app which Social output tab the piece belongs under (carousel,
job-description, post, ...). The artifact shape cannot tell a job ad from a quote
card (both are a PNG), so the category is declared, not inferred. When the file is
absent the app falls back to the artifact shape, so existing carousels need no
back-fill. Keep the value kebab-case and matching a tab id in `app/web/js/areas.js`
(add a tab there when introducing a new category).

## Non-negotiable: social is public

Social is external, so **no customer-cleared material of any kind** ever
appears in a carousel, post, image or thumbnail. Entitlement gating applies
fully: the app only offers **public** graphics for social, and `verify` refuses
anything above public clearance. Brand rules hold: no em dashes (en dashes for
numeric ranges are fine), European numbers (€ 50.000 · 0,5%), payback labelled
illustrative and conservative, Capture → Connect → Execute framing.

## LinkedIn carousel (the proven path)

- A carousel is a **document post**: upload the **PDF**. Page **1080×1350
  (4:5 portrait)**, set by `@page` in `templates/linkedin.css`. 6–10 pages, one
  idea per page, body type large (38px+ on the 1080 canvas).
- Compose only from the documented carousel blocks in `templates/linkedin.css`
  (`.lpage--hook`, `.lpage--point`, `.lpage--cta`, `.lstat`, `.lband`). A new
  pattern graduates into `linkedin.css` first.
- Build:
  ```
  .\tools\build-carousel.ps1 -Carousel social\linkedin\<date>_<slug>
  ```
  Then the visual pass at feed size (readable type, no overflow, hook reads in
  the first second).

## LinkedIn post text

- Hook in the **first ~140 characters** (the mobile "see more" fold). Single
  blank line between paragraphs (LinkedIn collapses doubles). 0–3 hashtags. Put
  any link on the CTA page or in the first comment, not mid-post.
- **Unicode bold** (Mathematical Alphanumeric letters) only for 1–3 short
  phrases, never on numbers or searchable keywords (screen readers spell it out;
  search can't index it).
- Post from **Floris's personal profile** (far more reach than the Page); mirror
  on the Oppr Page if useful.

## Single social image (announcements)

- One **1080×1080 PNG**: a hire, a round, a date. It has to say its whole thing
  unswiped, so it is one card, not a carousel.
- Composed from `templates/linkedin.css` with
  `.carousel carousel--square carousel--single` + one `.lpage`. No page number,
  no open loop. Build:
  ```
  .\tools\build-social-image.ps1 -Image social\linkedin\<date>_<slug>
  ```
- See `knowledge/best-practices/social-image.md` and the worked example in
  `social/linkedin/2026-07-23_hiring-senior-developer/`.

## LinkedIn article + its hero (1200×627)

An **article** is a markdown body plus one wide banner. The banner is composed
from `templates/linkedin.css` with `.carousel carousel--hero` + one `.lpage`
(specimen: `library/design-system/blocks/linkedin-article-hero.html`). Ink
ground, because the banner sits directly under a headline LinkedIn renders in
its own chrome. The hero carries the **claim and nothing else** — no body copy,
no page number, no open loop — plus one optional stat set beside the claim so it
stays a single horizontal read at thumbnail size.

```
python tools\build-article-hero.py --draft social\drafts\<slug>
.\tools\build-social-image.ps1 -Image social\drafts\<slug>\hero -Width 1200 -Height 627
```

`build-article-hero.py` refuses a claim over 95 characters (a banner is a claim,
not a sentence), an em/en dash, and a mojibake replacement character — all three
are invisible in JSON and impossible to miss in the feed.

## Where a piece comes from: the Last-30-days pipeline

Most LinkedIn output now starts as an **idea** in `research/last30days/posts/`,
written off the brain. The chain is deliberate about what is cheap and what is
committed:

```
idea (cheap, disposable)  →  PROMOTE  →  social/drafts/<slug>/  →  /deckbuilder
research/last30days/posts/              draft.json + hero/         build + verify
                                                                        ↓
   brain learns which themes                                    social/<channel>/
   earned attention  ←── performance.json ←── posted + link ←── built output
```

**Promote** is the gate (the button on the app's Last 30 days → Ideas tab). It
copies the body into a social draft, keeps the lineage (`source_idea` + the
`themes` ids the idea came from), and for an article writes the hero page. It
deliberately does **not** build: `/deckbuilder` still owns that, with its verify
gate and human approval.

After posting, record the link and the engagement readings on the app's
**Performance** tab. Those numbers roll up per theme in
`research/last30days/performance.json`, which gives every belief in the brain a
second axis: `confidence` says the evidence repeated, `audience` says whether
anyone responded. See `research/CLAUDE.md`.

## Other formats

YouTube thumbnails (1280×720) follow the same shape: a template in `templates/`,
blocks composed only from the documented set, built by a tool, named with `oppr`,
verified, human-approved. See `knowledge/best-practices/` for each.
