# V2-SPEC.md — Deck Studio App v2: the full workbench

> Status: **BUILT (2026-07-22).** Floris approved via `/goal implement the plan`
> and all seven phases were built and verified in-browser, one commit each.
> Successor to APP-SPEC.md (v1). This document is the build instruction and the
> record. What shipped: sidebar IA + hash routing; Slides in card/section/table
> views with detail pages and git version history; compose as an explicit mode
> with a draft tray + multi-draft switcher; a Social studio (carousel + post
> composers, brief-only for article/image/thumbnail) with outputs under `social/`;
> a Graphics repository with usage cross-references and an import flow via
> `dump/_app/`; in-app Knowledge pages (design philosophy, living best-practices
> docs, recipes) and a whitelisted Config browser. The §10 carousel
> (`social/linkedin/2026-07-22_book-a-data-analysis`) was built and verified.

## 0. Principles carried over (unchanged, load-bearing)

- **The app composes; the CLI builds.** Every output still goes through
  `/deckbuilder` with its plan-approval gate and verify. The app's write fence
  widens only to: `decks/drafts/`, `social/drafts/`, and `dump/_app/` (image
  import staging — see §6). Nothing else, ever.
- **Zero-dependency stack stays.** Node built-ins + vanilla ES modules carried
  v1 fine; v2 adds no npm packages. New needs are met by: `child_process` git
  calls (version history), a small self-written markdown renderer
  (`app/web/md.js`, ~120 lines: headings, lists, links, bold/italic, code,
  tables, blockquotes — enough for our own docs, which we control), and more
  endpoints on the same server.
- **Python owns YAML/derivation.** All new derived data (sections, usage maps,
  version counts) comes out of `tools/build_app_index.py`, not Node.
- **Entitlement gating everywhere.** Social outputs are public by definition;
  the graphics view shows entitlement prominently; nothing above clearance ever
  reaches a public artifact.
- Brand rules (no em dashes in shipped content, European numbers, illustrative
  payback labelling) apply to every new output type, including social.

## 1. Information architecture — persistent left sidebar

Replace the top bar with a fixed left sidebar (collapsible to icons at narrow
widths; state in localStorage). The top strip keeps only the wordmark, the
global search, and the Compose-mode toggle (§4).

```
oppr. DECK STUDIO
├─ LIBRARY
│   ├─ Slides            (§3: card / section / table views)
│   ├─ Graphics          (§6: the image repository + usage)
│   └─ Design system     (renders library/design-system specimens)
├─ CREATE
│   ├─ Deck drafts       (v1 Draft + Handoff, merged into one flow)
│   └─ Social studio     (§5: carousel · post · article · image · thumbnail)
├─ OUTPUT
│   ├─ Decks             (canonicals + frozen variants, filmstrips + preview + PDF)
│   └─ Social            (everything under social/, browsable, with post text)
├─ KNOWLEDGE
│   ├─ Design philosophy (§7: BRAND.md + design-spec content, rendered)
│   ├─ Best practices    (§7: knowledge/best-practices/*.md, rendered)
│   └─ Recipes           (types/<type>/recipe.md, rendered)
└─ ⚙ Config              (§7: read-only browser over the whitelisted knowledge files)
```

Routing: hash-based (`#/slides`, `#/slides/kpi-payback`, `#/graphics`,
`#/social/new/carousel`, …) so the browser back button and deep links work —
v1 had none and it showed.

## 2. Repo restructuring (do first — everything else references it)

1. **`social/`** becomes the umbrella for outward channel output:
   `git mv linkedin social/linkedin`, and future channels sit beside it
   (`social/youtube/`, `social/x/`). Each output: `social/<channel>/<date>_<slug>/`.
   `social/drafts/<slug>/draft.json` holds social drafts (same staging
   discipline as `decks/drafts/`). Update: `linkedin/CLAUDE.md` →
   `social/CLAUDE.md` (expanded per-channel), `/deckbuilder` Route B paths,
   `tools/build-carousel.ps1` default path, root CLAUDE.md layer 8.
2. **`knowledge/best-practices/`** (new): one living document per output type —
   `deck.md`, `linkedin-carousel.md`, `linkedin-post.md`, `linkedin-article.md`,
   `social-image.md`, `youtube-thumbnail.md`. Fixed two-part structure:
   **"Platform practices"** (researched facts, cited, dated — seed carousel/post
   from `.scratch/deck-app/research/05-linkedin-formats.md`) and **"How Oppr
   applies it"** (our own rules + a dated, append-only **Learnings** list). The
   `/deckbuilder` closing question ("anything to feed back into the brain?")
   gains a second target: type-lessons go to the recipe, **format-lessons go
   here**. That is the update loop Floris asked for.
3. **Section taxonomy** for slides — the narrative spine, derived from role (a
   `ROLE_SECTIONS` map in `build_app_index.py`, documented in `library/CLAUDE.md`;
   no meta.yaml changes needed):
   Opening (cover, idea) · Problem (why-now, problem-recognition,
   when-time-matters) · Product (platform, product-flow) · Proof (outcomes,
   evidence, kpi) · Path (engagement, step-detail) · Trust (acceptance,
   running-projects, who-is-oppr) · Closing (cta, closer).
4. **Templates for new social formats** (added in Phase 4, not before):
   `templates/social-image.css` (1080×1080 + 1200×627 link-image page types) and
   `templates/youtube-thumb.css` (1280×720, huge type, high contrast). Same
   pattern as `linkedin.css`: self-contained, `@page` sized, documented blocks
   only, `@media screen` gap for browsing.

## 3. Slides — three view modes + detail + versions

**View switcher** (persisted): **Cards** (v1 grid) · **Sections** · **Table**.

- **Sections view:** slides grouped under the §2.3 taxonomy in spine order,
  with section headers ("Problem — make them recognize themselves") and a
  per-section count. This is the "walk the story" view: it shows which sections
  are rich and which are thin (a section with one slide is a library gap).
- **Table view:** dense rows — thumb (small), id, title, role, section, tags,
  entitlement, language, used-in decks (chips), images used, versions count,
  last-changed date. Click-to-sort columns, same filters as cards. Built for
  "what do we actually have" audits.
- **Slide detail page** (`#/slides/<id>`, click anywhere on a card/row): large
  live preview (assembled fragment in an iframe with preview vars), full meta,
  **Used in** (decks listing it — from deck.yamls, computed at index time, not
  just meta's `used_in`), **Images** (linked to their Graphics pages), and:
- **Version history.** Server endpoint `GET /api/history/slide/<id>` runs
  `git log --follow --format=... -- library/slides/<id>/slide.html` (and
  `meta.yaml`); returns commits (hash, date, subject). `GET
  /api/history/slide/<id>/<hash>` returns that version's fragment via `git show
  <hash>:<path>`, which the app renders in the same preview iframe with current
  CSS — so Floris can flip through how a slide evolved. Read-only, no checkout,
  no new storage; a "compare" toggle shows old and current side by side.
  (Index builder adds `versions: <count>` + `last_changed` per slide so the
  table view can show them without N git calls — one `git log` pass at index
  build time.)

## 4. Compose is a mode

Composing becomes an explicit state instead of always-on buttons:

- A **Compose** toggle in the top strip (and "Start draft from this deck" still
  enters it). Entering asks: continue the active draft or start new (deck draft
  or social draft — §5 shares the mechanic).
- **In compose mode:** a persistent bottom **tray** shows the active draft
  (mini-thumbs, count, entitlement warnings live); cards/rows/sections all grow
  add affordances; a slide already in the draft shows its position number.
  Browsing is untouched otherwise — the tray is the only chrome addition.
- **Out of compose mode:** no add buttons anywhere; the library is a clean
  reference. The draft is never lost by leaving the mode (localStorage +
  saved drafts as in v1).
- Multiple drafts: the tray has a draft switcher (active draft is one of the
  saved drafts; "save" from the tray, handoff from the draft page as in v1).

## 5. Social studio

A creation flow per output type, all landing in `social/drafts/<slug>/draft.json`
with `kind: carousel | post | article | image | youtube-thumbnail`, all handed
off as `/deckbuilder build social <slug>`, all gated by the CLI as ever.

- **Carousel composer:** page-pattern picker (hook / point / stat / quote /
  image-band / cta — the documented `.lpage--*` blocks), per-page content
  fields, drag-reorder, live 4:5 preview per page (iframe on `linkedin.css`),
  page-count guidance from the best-practices doc (6–10), image picker limited
  to **public** graphics. Draft carries per-page content + chosen pattern.
- **Post composer:** structured fields (hook ≤ 140 chars with a live counter,
  body, CTA, 0–3 hashtags); a preview that folds at the "see more" line; the
  unicode-bold rule surfaced as a lint hint (1–3 short phrases, never numbers).
- **Article / image / thumbnail:** v2 ships them as **brief-only** composers
  (structured intent → draft.json → CLI builds); their dedicated templates
  (§2.4) land with the first real use. Article output is a markdown file +
  hero image reference under `social/linkedin/`.
- **Output browser:** `#/social` lists everything under `social/` with PDF/image
  preview, the post text ready to copy, and "which graphics it used".

## 6. Graphics — a real repository

- Rename the nav concept from "Images" to **Graphics** (covers photos, diagrams,
  product shots, logos, generated art).
- **Usage cross-reference** (the headline feature): at index-build time Python
  computes, per graphic: which **slides** reference it (meta.yaml `images` +
  grep of fragments), which **decks** those slides sit in, and which **social
  outputs** used it. Shown as chips on the card and a full list on the graphic's
  detail page (`#/graphics/<file>`), with reverse links everywhere (slide detail
  → graphics; graphic detail → slides/decks). "Unused" becomes a filter — the
  cleanup view.
- **Import flow (consistency gate):** the app gets an **Import graphics** drop
  zone that writes files to **`dump/_app/<date>/`** plus a `note.md` (who/what/
  suggested tags typed in the app). That is deliberately the existing intake
  inbox: `/ingest-dump` proposes the manifest entry (description, tags,
  suggested_use, entitlement), Floris approves in the CLI, and only then does it
  enter `brand/img/` + `library.json`. The app never edits the manifest — that
  is what keeps every graphic *described* and entitlement-correct.
- Detail page shows the manifest entry verbatim (description, tags,
  suggested_use, entitlement, `source: generated` provenance when the Gemini
  phase lands).

## 7. Knowledge in the app

- **Design philosophy** (`#/knowledge/design`): renders `brand/BRAND.md` plus a
  distilled design-philosophy page (new `knowledge/design-philosophy.md`,
  seeded from the deck-design-spec artifact's Rules/Anatomy sections: one idea
  per slide, footer discipline, the palette's meaning, tone rules), with links
  into the live design-system specimens.
- **Best practices** (`#/knowledge/best-practices/<type>`): renders the §2.2
  documents. Each page shows its "last updated" and the Learnings tail — the
  living part is visible, not buried.
- **Recipes** (`#/knowledge/recipes/<type>`): renders `types/<type>/recipe.md`.
- **⚙ Config** (`#/config`): a read-only file browser over an explicit
  **whitelist** served by `GET /api/knowledge`: all `CLAUDE.md` files,
  `brand/BRAND.md`, `types/*/recipe.md`, `knowledge/**`, `.env.example`,
  `.claude/commands/*.md`, and the two SPECs. Rendered with `md.js`, raw view
  toggle. Nothing outside the whitelist is exposed, nothing is editable — "run
  through the folder without the folder", exactly as asked.

## 8. Server API additions (all localhost, all read-only except the two staging writes)

```
GET  /api/history/slide/<id>          git log for a fragment (+meta)
GET  /api/history/slide/<id>/<hash>   one historical fragment body
GET  /api/usage/graphic/<file>        slides/decks/social using it (from index)
GET  /api/knowledge                   whitelist tree
GET  /api/knowledge/<path>            one whitelisted file (raw markdown)
PUT  /api/social-drafts/<slug>        social draft staging (fenced like deck drafts)
POST /api/import-graphics             multipart → dump/_app/<date>/ only
```

`build_app_index.py` grows: `section` per slide, `versions`/`last_changed` per
slide (single git pass), the graphics usage map, social outputs listing, and the
knowledge whitelist tree. Everything else stays derived, never hand-kept.

## 9. Build order (phases, each with its gate)

| Phase | Scope | Gate before next |
|---|---|---|
| 1 | Repo restructure (§2: social/ move, knowledge/ seeded, section map) + docs + /deckbuilder path updates | all decks + carousel still verify PASS; old paths gone from docs |
| 2 | Sidebar IA + hash routing + Slides card/section/table + slide detail | visual pass in browser; deep links work; v1 features intact |
| 3 | Version history (server git endpoints + index version counts + detail UI) | flip through kpi-payback's history in the app |
| 4 | Compose mode + tray + multi-draft; deck draft flow merged into it | full cherry-pick → save → handoff run in-browser |
| 5 | Graphics repository: usage x-ref, detail pages, import → dump/_app + /ingest-dump extension | import a test image end to end (app → ingest → manifest → visible with usage) |
| 6 | Social studio: carousel + post composers, output browser, `/deckbuilder build social` route | build the §10 carousel through the new flow |
| 7 | Knowledge & Config pages + md.js | every whitelisted doc renders; nothing outside whitelist reachable |

Estimated shape: ~1 session per phase; 2 and 6 are the big ones.

## 10. First deliverable after approval — the "call us for a data analysis" carousel

Defined now so Phase 6 (or a pre-v2 `/deckbuilder` run — it needs nothing from
v2) can build it immediately. Audience: **operational owners / plant and ops
directors**. Goal: **visit oppr.ai and book a data analysis → proof of value.**
6 pages on `templates/linkedin.css`, public entitlement only, European numbers,
no em dashes:

| # | Pattern | Working content |
|---|---|---|
| 1 | hook | "The € 100k in your plant that no dashboard will ever show you." sub: "Six pages on where it hides, and the 10-week way to prove it." |
| 2 | point | Recognition: recurring stops "we always fix", off-spec written off as normal, the workaround only the night shift knows. The losses are known on the floor and invisible in the numbers. |
| 3 | point | The method: Capture what operators see → Connect it to machine data on one timeline → Execute the improvement as standard practice. (Optionally `.lband` with the platform-loop diagram, public.) |
| 4 | stat | € 50–100k per line, per year — one verified improvement, conservative assumptions, illustrative not a promise. Then: × your lines and sites. |
| 5 | point | The offer: **a data analysis on one line** — ten weeks, one clear question, payback known before the proof starts. Entry credited in full. |
| 6 | cta (ink) | "Ready to see your own floor's blind spots?" → oppr.ai · book a data analysis. |
| post | — | Hook (<140 chars): "Your floor already knows where the € 100k is. Your dashboards don't." Body: 3 short paragraphs mirroring pages 2–5, one unicode-bold phrase max, link in first comment, 3 hashtags. |

Verification: 6 PDF pages at 4:5, name carries `oppr`, visual pass at feed size,
facts checked against `brand/BRAND.md` pricing/claims before shipping.

## 11. Out of scope for v2 (unchanged fog)

Gemini image generation wiring (researched, `.env` ready — its UI hook is the
Graphics import flow, later); team access/hosting (still single-user local);
translation alignment; editing anything from the app (the wall stands).
