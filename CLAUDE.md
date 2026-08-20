# CLAUDE.md — Oppr Deck Studio

System for creating and maintaining Oppr sales/marketing decks as HTML, composed
from a reusable slide + image library, fine-tuned in Claude Code, printed to PDF
for sharing. Owner: Floris Wyers (floris@oppr.ai). Mirrors the oppr.ai brand.

This repo is **self-describing on purpose**: everything Claude needs to operate it
lives in checked-in files (this manual, the per-folder `CLAUDE.md`s, the two
command files), never only in a chat history. A fresh session in a clean clone
should be able to build a deck from these docs alone.

## The layers

1. **Brand system** — `templates/deck.css` + `templates/showcase.css` (tokens,
   fonts, footer + page counter, building blocks), `templates/linkedin.css`
   (the 4:5 carousel format), and `brand/`. See `brand/BRAND.md`.
2. **Element library** — `library/slides/<id>/` : every slide as a portable
   `slide.html` fragment + `meta.yaml`. `brand/img/library.json` : every image
   described so it can be retrieved by meaning. `library/icons/` : the reusable
   line-icon set (used via the `{{icon:NAME}}` token, never re-drawn per slide).
   See `library/CLAUDE.md`.

   **Chapters (2026-08-04).** `library/chapters.yaml` groups the slides into
   ordered **chapters**, holding membership *and* order in one file so
   exclusivity is structural. A deck recipe is an ordered list of chapters with a
   pick from each, and **skipping a chapter drops every slide under it**. No slide
   has length variants: depth is chosen per chapter, and a slide covering the
   ground of three others is simply another slide you can pick instead. Each
   `meta.yaml` carries `chapter`, plus `goal` / `why` / `with` so a suggestion is
   possible at all. A retired slide keeps its folder (`retired: true`) so already
   published decks still resolve, but cannot be picked into anything new.
   `role` is **not** the chapter key and is never renamed: verify enforces footer
   discipline by role, so it is a render contract, not a grouping.
   See `.scratch/deck-studio-3/SPEC.md`.
3. **Deck types (recipes / the "living brain")** — `types/<type>/recipe.md` : the
   reusable brief per presentation type (goal, audience, skeleton, learnings).
   See `types/CLAUDE.md`.
4. **Artifacts (the one model)** — every built thing (deck, carousel, social
   image, article) is a row in `decks` with a `kind`, and its content is an
   immutable `deck_versions` row. **`decks/<slug>/` on disk is build scratch**:
   the CLI assembles there, publishes, confirms, and the folder is disposable.
   A master is a **tag** (`is_master`, one per type), not a folder. A new version
   is a new row, never a `<slug>-v2/` folder. See `decks/CLAUDE.md`.
5. **Two ways in, one permission model (2026-08-19, Deck Studio 5).** Building a
   deck is no longer a Claude Code skill. An **editor** composes a deck in the
   app's builder or through **Claude over MCP** — pick slides from the library,
   fill the deck's variables, check, publish — and needs neither this repo nor a
   terminal. What stays here is **owner** work, because it changes every deck
   built afterwards: `.claude/commands/edit-canonical.md` (the library, the
   masters, the CSS) and `ingest-dump.md` (the intake inbox), plus
   `npm run studio` for the mirrors, accounts and one-off builds.

   The old deckbuilder and new-deck commands are **deleted**. Their
   approval gate is not: it moved to `deck_check`, which shows the plan and the
   gate findings in the conversation, and `deck_publish`, which refuses without
   `confirm: true`. The gate is now enforced by the server instead of by a
   paragraph of markdown.
6. **Intake inbox** — `dump/` : drop past decks / event material / images here;
   `/ingest-dump` files each piece into its home (library, images, brief,
   references) and leaves `dump/` empty. See `dump/CLAUDE.md`.
7. **Deck Studio App** — `app/` : the local cockpit (`npm run dev` →
   http://127.0.0.1:4173). **This is where you change and ship anything.**
   Sidebar, grouped (2026-08-04): **Work** — Customers (home) · Decks · Social
   output · Last 30 days; **System** — Library · Knowledge; and pinned at the
   bottom behind a rule, **Accounts** · **Settings**, because neither is
   somewhere you go to do the work. Settings has two tabs: **Connect Claude**
   (how to add the MCP connector) and **Studio files** (the old Knowledge →
   Config browser).

   **Deck builder is not a sidebar area (2026-08-20).** It was, and its landing
   page listed the same decks as **Decks** with less on each row — no note, no
   star, no verify chip, no page count — so the app had two deck lists that
   disagreed about what a deck list looks like. The builder is a workspace bound
   to a deck; a sidebar entry implied it was somewhere you go. **New deck** now
   sits at the head of the Decks list, and the drafts that were the builder
   page's only unique content are a **Not published yet** section there.
   `#/build` redirects to `#/decks`.

   **Two kinds of deck (2026-08-05), not three.** "Masters" and "company decks"
   described how a deck was tagged rather than what it is, and in practice the
   company decks *are* the masters. So the index has **Company decks** (one
   reusable deck per type, grouped and labelled by type) and **Customer decks**
   (copies made for one named customer, grouped by that customer). The generic
   **customer deck** is itself a company deck: you copy it per customer and never
   edit it for one, which is how a customer's name stays out of the next
   customer's deck. A deck leaves the index by being **archived**, never deleted:
   its versions, PDFs and lineage all survive and one click brings it back.

   The artifact overview answers *which one do I want* without opening anything:
   each row states its page count, when it last changed and who changed it, the
   **note** you wrote about it, and a **star** you can filter to. The note is
   edited where it is read and the filter bar searches notes as well as titles.
   **Edit is not in the list** — it is on the artifact's own page, one click in.

   **Edit is two doors** (2026-08-04), because the server already treats them as
   two jobs: **Edit slides** opens the deck in the **Deck builder** (which
   slides, in what order), and **Edit text** opens the in-place editor (words,
   spacing, images). The builder is a workspace *bound to a deck* — `#/build/new`
   is one that does not exist yet, `#/build/<id>` is an existing deck — which is
   what makes the version
   rule structural rather than advisory: **a new deck always publishes as v1, and
   a new version can only come from opening an existing deck.** Slug, client and
   clearance are inherited by every version and are not re-pickable, so a version
   can never widen what a deck is allowed to carry. A variant is **Save as a new
   deck**, not a version. Composing is saved as you go in `decks.draft_recipe` —
   a draft, never a version, surfaced as **unpublished changes**.

   **A customer's first deck is built, not staged (2026-08-06).** **New deck** on
   a customer opens `#/build/new?for=<slug>`: the create dialog bound to that
   customer, so client and clearance are fixed up front and the deck it publishes
   is filed under them instead of landing nowhere and needing to be re-homed. The
   dialog asks one more thing — **Start from**: an empty deck, or an existing one.
   Starting from a deck **copies its recipe** (its slides and their order) into
   the builder, which is a copy and not a link: the deck you copied is untouched
   and this one still publishes as its own v1. A customer deck defaults to
   copying the generic **customer** master, because that is what the generic one
   is for. Two things the copy does on the way in: it drops any slide the new
   deck's clearance does not cover (so one customer's material cannot ride into
   another's deck), and it keeps the footer and cover meta of the *new* title
   rather than the copied one. A deck whose version predates recipes is offered
   but not selectable — it says so rather than starting you silently empty.
   Copying the published *document* instead of the recipe is a different act and
   still exists: that is **Personalize** on a master.

   **Clearance is derived, never picked (2026-08-20).** The create dialog used to
   end in a grid of customer chips, which was a control with no meaning for the
   person using it: `deriveClearance()` recomputes clearance from the client for
   everyone except an owner, so an editor's ticks were discarded on the way in.
   It also asked a question the dialog already knew the answer to — a deck is
   cleared for the customer it is for. The dialog now **states** the clearance
   (`public` plus the client's slug, the same string `namescope.mjs` derives) and
   the picker greys out exactly what the gate would fail on. No deck ever built
   has carried more. An owner who genuinely needs two customers on one deck
   passes `allowed_entitlements` in a recipe to `npm run studio -- build`, which
   is still honoured. Two dropdowns were simplified with it: **Type** is the six
   deck types from `app/web/js/decktypes.js` in that registry's order (it used to
   read the distinct `type` values off existing rows, so it offered `article`,
   `carousel` and `image`, alphabetically), and **Start from** groups decks the
   way the Decks page groups them — **Company decks** by type, then **Customer
   decks** by customer.

   Open any artifact and **Edit** it in place: click text and retype, nudge
   spacing, swap an entitlement-filtered image. Every save is a new immutable
   version. **Download PDF** always gives you the version on screen, printing it
   on demand if it has not been printed yet. **Rename** sets the title and the
   filename's middle segment. Carousels and social images work exactly like
   decks, because they are the same artifact model, and carry their channel copy
   in **Post text** (the Unicode post editor, saved as `decks.post_text`; a
   caption is not a version). Social output can be viewed flat or grouped by
   type, with posted state as a checkbox in one fixed column. In the Library, any
   slide or design-system block can be **downloaded on its own** as
   self-contained HTML, PNG or PDF.

   Sign in with **email and password** (2026-08-03, replacing magic links).
   Accounts are invitation-only and restricted to `@oppr.ai`, both enforced by
   triggers on `auth.users`: an owner adds people on the **Accounts** page, or
   with `python tools\manage-users.py` when nobody can sign in yet.

   **Deck Studio over MCP (2026-08-07).** `/mcp` on the same Vercel app is a
   second front door for Claude on desktop, web or a phone: list customers,
   register one, read a deck, see what a customer holds, record a send, search
   the library. It shares the browser's handlers and `app/lib/guard.mjs`, so it
   is not a second pipeline and not a second permission model. **There is
   deliberately no tool for editing a master or the library** — that absence is
   the mother/leaf boundary made structural. Streamable HTTP, **stateless** (no
   session id: one serverless instance's session means nothing to the next), spec
   `2025-11-25` and its two predecessors. Auth is OAuth 2.1 delegated to
   **Supabase's OAuth server**, with the token verified against the project JWKS
   in `app/lib/mcpauth.mjs` (ES256, via `node:crypto`, so no new dependency).
   A refusal is an HTTP **401 with `WWW-Authenticate`**, never a 200 carrying
   `isError` — only the former makes Claude offer a Connect button.
   **Requires the OAuth server to be enabled** in the Supabase dashboard
   (Authentication → OAuth Server); until it is, `/mcp` answers every tool call
   with 401 by design.
   **How to connect it is documented in the app**, at **Settings → Connect
   Claude** — the address (derived from the host you are reading it on, and
   checked live against the discovery document), the steps, the tools split by
   read vs write, and the failure modes. A colleague who wants Deck Studio on
   their phone should never need a chat history to find that.

   The browser talks only to the **local agent** (`app/server.mjs` + `app/lib/*`),
   which holds the Supabase secret key and runs print/verify; the browser never
   sees the key. Creating anything new, and any structural change, stays CLI —
   the app tells you when you have hit that wall and hands you the prompt. See
   `app/README.md`.
8. **Social output** — `social/<channel>/<date>_<slug>/` : brand-styled
   carousels (4:5, `tools/build-carousel.ps1`), posts, articles, images,
   thumbnails. Built by an owner from this repo. Public by definition — no named-customer
   material. See `social/CLAUDE.md`.
9. **Market listening** — `research/last30days/` : every `/last30days` run
   recorded as structured knowledge (`runs/<slug>/run.json`), folded by
   `tools/research-brain.py` into an accumulating **brain** (themes gain
   confidence as evidence repeats) plus LinkedIn drafts in `posts/`. This
   folder is `LAST30DAYS_MEMORY_DIR`; research lives in the repo, not in
   `~/Documents`. Ideas are cheap; **promoting** one turns it into a
   `social/drafts/` draft (with its 1200×627 hero for an article) that
   an owner then builds. Engagement recorded after posting rolls back up
   per theme, so every belief carries both `confidence` (did the evidence
   repeat) and `audience` (did anyone respond). Surfaced in the app's
   **Last 30 days** area, which reads the folder from disk locally and from
   Storage when hosted (on Vercel there is no repo on disk), so the same pages
   work in both places. See `research/CLAUDE.md`.
10. **Knowledge** — `knowledge/` : the design brain in the open —
   `design-philosophy.md` and living `best-practices/<type>.md` docs
   (platform facts + how Oppr applies them + dated learnings). Surfaced in the
   app's Knowledge/Config pages. See `knowledge/CLAUDE.md`.

The full design rationale is `.scratch/deck-tool/SPEC.md` (studio),
`.scratch/deck-app/APP-SPEC.md` (app v1) and `.scratch/deck-app/V2-SPEC.md`
(the v2 workbench).

## Setup (fresh clone)

```powershell
pip install -r requirements.txt   # PyYAML, pypdf, PyMuPDF (fitz), Pillow
copy .env.example .env            # then fill in secrets; .env is gitignored
#   GEMINI_API_KEY  — image generation (optional)
#   SUPABASE_URL + SUPABASE_SECRET_KEY — the deck backend (v3); the app + the
#     deck tools (publish-deck.py / fetch-deck.py) need these. Server-side only.
#   ANTHROPIC_API_KEY — only tools/check-story.py, the advisory narrative pass.
#     Without it that check prints one line and exits 0; nothing that can FAIL a
#     deck depends on it.
```
Rendering also needs **Google Chrome or Microsoft Edge** installed (HTML → PDF/PNG).
Check the machine with `npm run studio -- doctor`, which reports Node, the
browser, the backend and whether the library is on disk.

**Python is optional and owner-only** since 2026-08-19. Nothing in the artifact
pipeline uses it, and nothing an editor does needs it. What remains is a handful
of utilities with no good Node equivalent: image generation, static font
instancing, the two shareable kits, the cover scrim, the vector QR, and the
research brain.

Owner workflows are `npm run studio -- <command>` plus two Claude Code commands,
`/edit-canonical` and `/ingest-dump`.

The **Deck Studio App** is not optional: it is where decks are built. Needs
**Node 18+**: `npm install && npm run dev` **from the repo root** →
http://127.0.0.1:4173. Three npm dependencies, all for rendering when hosted:
`pdf-lib`, `puppeteer-core` and `@sparticuz/chromium`. Locally it prints with the
Chrome or Edge already on the machine. `npm test` runs the suite; CI runs it on
every push, and `.githooks/pre-push` runs it before one leaves the machine
(`git config core.hooksPath .githooks` once per clone).

**The Node project is the repo root; the app is `app/`** (2026-08-05).
`package.json` + `package-lock.json` + `vercel.json` live at the root, with
`"main": "app/server.mjs"`, because Vercel builds a GitHub push from the repo
root: a root with no entrypoint is a failed build, and the green deploys before
this were hand-pushed from inside `app/`, which is not something a push can do.
One manifest, one lockfile, one `node_modules`, and **`git push` is the deploy**.

## How a deck is composed

A deck is not hand-written HTML. A **recipe** names an ordered set of library
slide ids grouped by chapter, plus the deck's variable values;
`app/lib/assemble.mjs` fills each fragment's `{{variables}}` and produces a
self-contained snapshot.

Variables filled at assembly: `deck_title`, `deck_footer`, `cover_meta`, `total`
(the computed slide count) and `asset`, plus whatever the picked slides declare.
**Any unfilled `{{placeholder}}` is a hard error** — none ever reaches a PDF.

The recipe comes from one of three places, all of which run the same five gates:
the app's Deck builder, the MCP `deck_start` → `deck_publish` loop, or
`npm run studio -- build <recipe.json>` for an owner. There is one assembler and
one gate; the parity apparatus that used to hold two implementations together
retired with the second implementation.

## Nothing is done until it is in the backend (MANDATORY, every artifact)

The repo is **tool-only**. Content lives in Supabase, and the app shows what the
backend holds, not what happens to be on this disk. **A file written to the repo
is invisible to Floris.** So every build ends with its publish step, and the run
is not finished, reported or called done until that step has run and been checked.

| What you built | Publish it with | Lands in |
|---|---|---|
| A deck (`decks/<slug>/`) | `python tools\publish-deck.py decks\<slug> [--customer <s>]` | `decks` + `deck_versions` (+ PDF object, assets) |
| Any social output (`social/<channel>/<slug>/`) | `python tools\publish-social.py` then `python tools\import-social.py` | `decks` + `deck_versions` as `kind=carousel\|image\|article` |
| A `/last30days` run or the brain | `POST /api/research/sync` (app), after `python tools\research-brain.py` | Storage |

Then **verify it landed** — publishing is not proof. Query the row back and
download one stored object; a registry row whose bytes never uploaded looks
identical to a healthy one from the CLI's output:

```powershell
python -c "import sys;sys.path.insert(0,'tools');from supa import Supa;sb=Supa();`
r=sb.select('social_outputs',{'slug':'eq.<slug>','select':'*'});print(r);print(len(sb.download(r[0]['pdf_path'])))"
```

Two things that are **deliberately not** published, so do not 'fix' them:
`social/drafts/` and `decks/drafts/` are staging (the CLI builds them into real
outputs first), and anything personal or named-recipient never becomes public
social output at all. If a piece belongs in neither place, say so explicitly in
the hand-off rather than leaving it on disk and calling it delivered.

## Build & verify (MANDATORY before calling anything done)

Every route runs the same five gates — compose, assemble, print, verify, publish
— through `app/lib`. There is no second pipeline.

**An editor** builds in the app's Deck builder, or through Claude:
`deck_start` → `deck_slides` → `deck_vars` → `deck_check` → `deck_publish`.
`deck_check` is the approval step: it shows the plan and every gate finding in
plain words, and `deck_publish` refuses without `confirm: true`.

**An owner**, for a one-off or a reproduction:

```powershell
npm run studio -- doctor                     # can this machine build?
npm run studio -- fetch <slug>               # a published artifact back onto disk
npm run studio -- build <recipe.json> --dry-run
npm run studio -- build <recipe.json>        # runs the same five gates, then publishes
npm run studio -- verify <slug>              # the gate over a published artifact
npm run studio -- verify --all               # the gate over the whole corpus
npm test                                     # the suite, including the docs gate
```

Nothing is written to `decks/` any more: the pipeline assembles in a temp
directory and removes it, pass or fail. The artifact lives in the backend from
the moment it is published.

`app/lib/verify.mjs` is the gate, and it is **format-aware**: the rules come from
the artifact's `page_format` (see `PAGE_FORMATS`), so a carousel is checked as a
carousel and an article is not checked as a canvas. Universal for everything:
**zero em dashes**; zero unfilled `{{...}}`; images resolve and their entitlement
≤ the deck's clearance (no customer-name leaks); `oppr` in the PDF name; European
number formatting (a WARN). Structural rules — footer discipline, `data-total`,
one section per printed page — apply only to the formats that have them.

**`page_format` is written into every snapshot** and a missing one is a WARN
rather than a silent default: it was absent for a while, and everything the JS
assembler built was quietly checked as a 16:9 deck.

Then still do the **visual pass**: open the pages and actually look (overflow,
footers, images, page numbers). A WARN about the verbatim `€ 55,000` quote is
fine.

Two things the gate cannot see, so they are said here rather than warned on every
report: **blank pages** are not raster-scanned (the check needed PyMuPDF and was
not worth a cold start), and a **reclassified image** does not re-check artifacts
already carrying it — `studio verify --all` is how you find that, and it is how
the Holliday screenshot inside a public carousel was found.

After changing the library, mirror it: `npm run studio -- sync-library`
(`--check` reports drift without writing, and belongs in CI). Forgetting it is
invisible in the worst way — the hosted builder serves the old fragment while the
drift flag reports everything current, because the flag compares against the very
mirror that did not update.

## Rules

- **Footer discipline.** Content slides carry `.slide-foot` (wordmark, deck meta,
  `.pageno` with `data-total`). Roles `cover`, `closer`, `cta` have no footer.
  `verify-deck.py` enforces this by role.
- **Personalization is variables, not editing.** Audience-specific content
  (prepared-for, footer, cover meta, client) is expressed as `{{variables}}` in
  deck.yaml, or as a variant-local slide override — never by editing the library
  while composing a deck. Named customer material only in decks cleared for it: the
  `entitlement` field in `brand/img/library.json` and `allowed_entitlements` in
  deck.yaml enforce this mechanically. **Clearance is one slug per customer**
  (2026-08-01): `public` plus `mutares`, `holliday`, `venator`, `attero`,
  `keeeper`, `omniplast`, `sonneborn`, `host`, `selo`, `wavin`. The old
  `mutares-family` grouping and the generic `named-customer` bucket are gone:
  Mutares is a company in its own right and each company acquired through it is a
  separate customer at the same level, because a PE-level pitch and a plant-level
  pitch are different decks. A deck must be cleared for exactly the customers it
  names, so a Holliday deck naming Attero is now a hard FAIL.

  **The customers table drives clearance (2026-08-06).** That list above is the
  *built-in* set, and it is a historical contract: never rename or remove an
  entry, because published decks carry these slugs in `allowed_entitlements` and
  a rename retroactively fails a deck that was correct when it was built.
  **Registering a customer now adds its clearance and its name gate on top.**
  Before this, a customer added in the app could not be cleared for anything and
  no deck naming them was gated, so the newest customers were exactly the ones
  the leak rule did not cover. One rule, implemented per runner and proved equal:
  `app/lib/namescope.mjs` and `verifylib.build_name_scope()` derive byte-identical
  patterns, and `check-verify-parity.py` feeds both the same customers. A
  customer whose name a built-in scope already claims collapses into it rather
  than creating a second scope for the same words: HoSt Bioenergy stays `host`.
- **Mother work and leaf work (2026-08-07).** The permission line is **blast
  radius**, not seniority. **Leaf** work affects one customer's artifact: register
  the customer, copy a company deck into their teaser/engagement/proof-of-value
  deck, edit its text, publish a version, record that it was sent. Any **editor**
  may do it, from the app or over MCP, because it is the daily job of the
  commercial team. **Mother** work changes every deck built from then on: editing
  a **master**, archiving a library slide, reassigning `is_master`, rebuilding the
  index or the research brain. That needs an **owner**. A colleague who wants to
  improve the pitch uses **Save as a new deck**, which already records where it
  came from, and an owner promotes it. One implementation, in
  `app/lib/guard.mjs`, imported by both the browser routes and the MCP server:
  the rule is enforced in code, and a rule written twice eventually disagrees
  with itself. Motherhood is per-row for `versions`/`restore`/`assets`/`build`
  (a master is only a deck with `is_master`) and per-field for `PATCH`
  (`title`/`pdf_core`/`type`/`archived` are structural on a master; note, star
  and post text never are).
- **Registering a customer creates a gated term, so it is checked first.**
  `buildNameScope` derives `\b<name>\b` from a customer row, which is right for
  "Rhyze" and a disaster for "Data": every published deck using that ordinary
  word would start failing. `POST /api/customers2` therefore dry-runs the derived
  pattern against every current version before accepting the name, and refuses
  with the list of decks it would break (an owner can `force`). The prediction
  and the gate share one implementation — `patternForCustomer` in
  `namescope.mjs`, `wouldNewlyFail` in `verify.mjs` — because a guard that
  predicts the gate with different code will one day predict wrongly.
- **A send is an event, not a property.** `deck_sends` records which deck, **which
  version**, when, to whom. Pinned to `(deck_id, version_n)` because versions are
  immutable and the deck keeps moving: "sent on the 7th" cannot answer what the
  customer is holding, and comparing the sent version to `current_version_n`
  gives "they have v1, we are on v3" for free. It is a table rather than columns
  on `decks` because there can be many per deck — which is exactly why it does
  not violate the "note, star and post_text are columns, not a side table" rule.
- **Brand + canonical language** live in `brand/BRAND.md` — colors, type, the
  Capture → Connect → Execute framing (never LOGS/IDA/DOCS as the story),
  Analyze → Prove → Scale path, verified reference stats, current pricing. Verify
  commercial facts against Floris before reusing them.
- **Design-system composition rule.** A new slide may only use documented
  design-system blocks (`library/design-system/`). Need a new pattern? Add its
  specimen and put its CSS in `showcase.css`/`deck.css` first, then use it.
- **Tone.** Short, declarative, concrete, no hype. European number formatting
  (€ 25.000 · 0,5%). No em dashes (en dashes for numeric ranges are fine). Payback
  claims are labelled illustrative and deliberately conservative.
- **Every artifact lives in the backend as versioned HTML.** After a CLI build,
  the artifact is **published** to Supabase as a self-contained snapshot (inlined
  CSS + bundled assets). From there it *is* the artifact: the app edits it and
  every save is a new immutable version; the "current" pointer moves; git
  versions the tool, not the content. Masters are a **tag** (one per type).
- **One artifact model (2026-08-01).** A deck, a carousel, a social image and an
  article are the same record, told apart by `kind` on the `decks` row, with
  `page_format` declaring the geometry (`deck-16x9`, `linkedin-4x5`,
  `square-1x1`, `hero-1200x627`). That is what lets **one** editor, **one**
  verify gate, **one** build job and **one** version history serve all of them.
  Never add a parallel store for a new output type: give it a `kind`. The same
  rule covers what an artifact carries *about* itself: the note, the star and the
  channel copy (`post_text`) are columns on the `decks` row, not a side table,
  and none of them makes a version.
- **One verify gate, several rule sets.** `tools/verifylib.py` is the single
  source. The brand rules (no em dashes, no unfilled placeholders, no
  customer-name leak, image entitlement ≤ clearance, European numbers, `oppr` in
  the filename) are **universal**. Three things vary by `page_format`, from
  `verifylib.PAGE_FORMATS`: page geometry (`size`), the deck-specific structural
  rules (`structural`: footer discipline, `data-total`), and whether one page
  `<section>` prints as exactly one PDF page (`paged`). A **flowing** document is
  not paged: an article is one `<section>` of prose that legitimately prints
  across five sheets, and asserting 1 == 5 there FAILed every article
  (2026-08-19). `app/lib/htmlcheck.mjs` is a different gate with a
  different job: it checks a save is structure-preserving.
- **PDF naming, and the freshness rule.** Every built PDF carries `oppr`, and a
  named-client deck carries the client slug:
  `YYYY-MM-DD_oppr_<core>[_<client>].pdf` (master: `oppr_<type>.pdf`).
  `verify-deck.py` FAILs a PDF missing `oppr` or the client slug. The app's
  **Rename** sets `<core>` and the title only; the date, `oppr` and the client
  slug stay system-owned so a rename cannot defeat the gate. **A downloaded PDF
  is always the version on screen** — a version with no PDF is printed on demand
  rather than falling back to an older file.
- **Secrets never in the repo.** Real keys live only in `.env` (gitignored);
  `.env.example` lists the variable names. Nothing checked in ever contains a key.
- **The CLI creates; the app changes and ships.** This is the boundary, and it
  runs in both directions so you are never stuck on the wrong side of it.
  **Revised 2026-08-04:** the app gained a **Deck builder**, so composing a deck
  from library slides now happens on either side. It is not a second pipeline:
  the app shells out to `tools/build-from-recipe.py`, which runs the CLI's own
  compose → assemble → build-pdf → verify → publish. **One gate, not two.**

  **Revised 2026-08-05: the builder works hosted.** On Vercel there is no Python
  to shell out to, so the same five steps ran in JavaScript. **Revised
  2026-08-19 (Deck Studio 5): that is now the only pipeline.** The Python
  assembler, gate, publisher and renderers are gone, and the two parity checks
  that held them to the JS side retired with them — a guard is only worth its
  chance of being run, and those needed a live backend, could not run on a fresh
  clone, and nothing fired them automatically.

  | Owner (this repo + `npm run studio`) | Everyone (the app, or Claude over MCP) |
  |---|---|
  | A new **library slide** or design-system block | **Compose a deck** from the library, from either door |
  | Image generation, ingest, research runs | Reorder, add and remove slides; publish a version |
  | Retiring a slide (`meta.yaml`), archiving one | Register a customer; record a send |
  | Moving which deck is the **master** | Edit text, spacing, images in place |
  | The mirrors: `sync-library`, accounts | Download the PDF; rename; regenerate |

  What has **not** moved: `verify-deck.py` still blocks, and entitlement is not a
  suggestion. Editing an existing version is still text/attribute level only,
  enforced by `app/lib/htmlcheck.mjs`.

  It is enforced in code, not by convention: `app/lib/htmlcheck.mjs` fingerprints
  every save server-side and rejects anything beyond text/attribute level, so the
  boundary never depends on the browser. When the app refuses, it shows the exact
  CLI prompt and **clicking it copies it**. The app writes only staging areas
  (`dump/_app/`, `decks/drafts/`, `social/drafts/`) and the backend; it never
  writes `library/`, `brand/` or `templates/`.
- **Documentation is checked, not trusted.** `python tools\check-docs.py --check`
  fails when a path, tool or command named in any `CLAUDE.md` / README does not
  exist. Run it after moving or deleting anything. It is the mechanical half of
  the anti-drift rule; the other half is stating each rule **once** and linking
  to it from everywhere else.

## Structure

- `brand/fonts-static/` — generated static instances of the variable fonts, which
  are what the **print** stylesheets load. Regenerate with
  `python tools\build-static-fonts.py`. `brand/fonts/` keeps the variable fonts
  for the screen and for the brand kit.
- `brand/` — BRAND.md, wordmark/icon SVGs, fonts, `img/` (with `library.json`
  manifest and generated `index.html` contact sheet), `qr/` (generated vector QR
  codes, e.g. the LinkedIn code on the back cover), and `kit/` — the
  **shareable brand kit**: the logo as outlined SVG + PNG, a standalone page and
  `oppr-brand-kit.zip`, all generated by `tools/build-brand-kit.py` and surfaced
  in the app's Library → Brand tab. This is the one thing in the repo built to
  be sent *outside* Oppr, so its assets carry no font dependency.
- `templates/` — `deck.css` (system), `showcase.css` (shared deck-local styles),
  `linkedin.css` (4:5 carousel format), `article.css` (the article reading
  document), `deck-starter.html` (legacy skeleton)
- `library/` — `slides/<id>/` (fragments + meta + thumb) and generated `catalog.html`;
  `design-system/` (block specimens); `icons/` (reusable icon set + `icons.json`);
  `kit/` — the generated **design kit**, the whole visual system as one shareable
  zip (`tools/build-library-kit.py`), offered from the Library's area bar
- `types/` — `<type>/recipe.md` per presentation type. Six of them, and the app
  names and orders them in `app/web/js/decktypes.js`: `teaser` ·
  `management-outlook` · `product-showcase` · `engagement` ("How we work
  together") · `customer` · `investor`.
- `decks/` — **build scratch only** (gitignored): the CLI assembles into
  `decks/<slug>/`, publishes, confirms it landed, and the folder is disposable.
  Plus `drafts/<slug>/` (pending drafts from the app; normally empty). The deck
  itself lives in the backend.
- `customers/<slug>/` — one folder per customer (`customer.yaml` + logo);
  CLI-owned (filed by `/ingest-dump` from a `dump/_app/` intake), read by the app.
  A customer's decks are matched by the `client:` slug on its variants.
- `social/` — `<channel>/<date>_<slug>/` outputs (carousels, posts, articles,
  images, thumbnails) + `drafts/` staging
- `knowledge/` — `design-philosophy.md`, `best-practices/<type>.md` (living docs)
- `research/last30days/` — recorded `/last30days` runs (`runs/<slug>/run.json`
  + `raw.md` + `brief.html`), the generated `brain.json`/`brain.md`, and
  LinkedIn drafts in `posts/`. Rebuild with `python tools/research-brain.py`.
- `package.json` · `package-lock.json` · `vercel.json` — the Node project, at the
  repo root so a `git push` builds on Vercel. `"main"` points into `app/`.
- `app/` — the Deck Studio App, split the obvious way: `server.mjs` (the router)
  and `lib/*.mjs` (auth, Supabase, verify, htmlcheck, render, jobs, deck cache,
  env) are the **back end**; `web/` (`index.html`, `app.css`, `js/`) is the
  **front end**, plain ES modules with no build step. Run it from the repo root
  with `npm run dev`.
- `tools/` — the owner's command line, plus the utilities that are genuinely
  command-line shaped. **The pipeline is not here any more**: since 2026-08-19 it
  is `app/lib`, and `tools/studio.mjs` is a thin shell over it, so there is
  nothing to keep in step.
  - **`studio.mjs`** (`npm run studio -- <cmd>`): `doctor` (can this machine
    build?), `verify` (one artifact, a folder, or `--all` over the whole corpus),
    `fetch`, `build`, `sync-library` (`--check` for CI), `users` (accounts, the
    break-glass path when nobody can sign in).
  - **still Python, still owner-only** — no Node equivalent worth writing, and
    none of it is in the artifact pipeline or needed by an editor:
    `generate-image.py` (Gemini, with provenance into `brand/img/library.json`),
    `build-static-fonts.py` (fontTools instancing; Chrome cannot serialize a
    variable font into a PDF and falls back to Type 3, which is what made the
    PDFs heavy), `build-brand-kit.py` and `build-library-kit.py` (both outline
    the wordmark from the woff2 so a kit needs no font installed) with
    `check-kit.py` (every reference must resolve inside the kit and nothing may
    reach the network — a kit is opened from a filesystem with no server),
    `build-cover-hero.py` (bakes the cover scrim into the hero so the PDF carries
    no per-pixel shading), `build-qr.py` (vector, because a raster QR blurs
    through print and a blurred QR does not scan), `research-brain.py`.
  - **still Python, still shelled to by the app**, and scheduled to port:
    `build_app_index.py` (the Library index; hosted reads a mirrored copy
    instead), `build-article-hero.py`, `export-element.py`, `pdf-thumbs.py`,
    `publish-assets.py` (the Storage mirror), `check-drift.py`.
  - **frozen, pending deletion**: `deckstudio.py`, `snapshot.py`,
    `snapshot_html.py`, `assemble-deck.py`, `verifylib.py`, `verify-deck.py`,
    `verify-carousel.py`, `build-from-recipe.py`, `publish-deck.py`,
    `fetch-deck.py`, `publish-social.py`, `import-social.py`,
    `build-article.py`, `publish-article.py`, the three `.ps1` renderers,
    `deck_pdf_name.py`, `supa.py`, `manage-users.py`, and both parity checks.
    They are the old pipeline. `DECK_PY_BUILD=1` still routes a build through it
    as a way back; the flag and the files go together.
  - **gates that are now tests**: the doc-drift and chapter checks are
    `app/test/gates/docs.test.mjs`, run by `npm test` and by CI. `check-docs.py`
    never read `.claude/commands/`, which is where three dead paths lived;
    the port does, and also refuses a recipe that proposes a retired slide and an
    app string that tells an editor to open a terminal.
  - **access**: `check-access.py` — adversarial only, never a happy path. Since
    2026-08-07 it also checks the **insider** case via the `policy_audit()` RPC:
    no policy may grant unconditionally to a non-service role. That check exists
    because an `allow_authenticated` policy (`ALL`, `USING(true)`) sat on eight
    tables while the suite reported 17/17 — it tested only as `anon`, and an
    outsider test cannot see a grant made to `authenticated`. On 2026-08-19 the
    same shape was found on `storage.objects`, which the RPC could not see
    because it was scoped to the `public` schema; both RPCs now look in `public`,
    `storage` and `auth`.
- `dump/` — the intake inbox (drop material to seed a deck; ends empty)
- `.env.example` — names of secrets; copy to `.env` (gitignored) and fill in
- `.claude/commands/` — `edit-canonical.md`, `ingest-dump.md`. Owner workflows
  only: `deckbuilder.md` and `new-deck.md` were deleted on 2026-08-19, because
  building a deck is the app's job and the connector's job, and a colleague with
  neither a checkout nor Claude Code could not do it at all.
- `supabase/migrations/` — the schema, in the repo. Every change is a file here;
  hand-editing in the dashboard is how two policy holes got in.
- `.scratch/` — the design history. `README.md` there says which map is **live**
  and what superseded each of the others. Exactly one map is live at a time.

## Versioning

The repo is under git, and git versions **the tool**. Content is versioned in the
backend: `deck_versions.n`, immutable, one row per save, with the "current"
pointer on the deck row. "Look back" on an artifact is its version timeline in
the app; "look back" on the tool is `git log` / `git show`.

The old `canonical/<type>@vN` git tags are **retired** — a master is the
`is_master` flag, and folder-suffix versioning (`engagement-v2/`) is the mistake
this replaced.
A published artifact records its provenance in the backend: `derived_from_deck_id`
+ `derived_from_version_n` for a personalized deck, and `change_note` per version.
PDFs are **not** committed; the PDF of record is the `pdf_object` on its version.

## Roadmap (agreed, not yet built — keep to the spec until asked)

- Other social formats (X, one-pagers) follow the LinkedIn pattern: give the new
  output a `kind` and a `page_format`, never a parallel store.
- ~~**Hosting the app.**~~ **Done.** All three anchors moved: Chrome-print became
  `app/lib/render.mjs` (serverless Chromium), Python-verify became
  `app/lib/verify.mjs`, and the agent holds the secret key server-side on Vercel.
  Composing followed on 2026-08-05 (`app/lib/assemble.mjs` + `publish.mjs`), so
  **a deck can now be built from the hosted app as well as from this laptop.**
- Team access & sharing (deliberately deferred — the app is single-user/local).
- Translation-alignment tooling for language variants.
- ~~An **article** has no HTML document.~~ **Done 2026-08-19.** `article.yaml` →
  `tools/build-article.py` → an `index.html` styled by `templates/article.css`,
  published by `tools/publish-article.py` as `kind=article` with
  `page_format: none`, so verify skips geometry (an article is a column, not a
  canvas) and still runs every brand rule. Its hero publishes beside it as
  `kind=image`. Articles are now editable, versioned and printable like any
  other artifact.

**Built in Deck Studio 2.0 (2026-08-01):** the one artifact model (decks and
social output merged behind `kind` + `page_format`), the format-aware verify
gate, print-on-demand PDF with rename, the editor extended to carousels, plain-
language verification, library element download, the unified action grammar, and
the repo purge. The map is `.scratch/deck-studio-2/MAP.md`.

## Image generation

`tools/generate-image.py` generates on-brand illustrations with the Gemini
Interactions API (`gemini-3.1-flash-image` at 2K by default) and files each one
in `brand/img/library.json` with full provenance: `source: generated`, the exact
prompt, model, style references, aspect ratio, date and `synthid: true`. The key
lives only in `.env` as `GEMINI_API_KEY` (image models need a billed Tier-1 key;
there is no free tier). Needs `google-genai >= 2.0`.

```powershell
python tools\generate-image.py --id gen/<slug> --prompt "…" `
  --description "…" --tags a,b --style-ref brand/img/capture.jpg --aspect 16:9 --size 2K
```

Rules: a frozen brand style block is prepended to every prompt, so the set stays
coherent; generated images are always `entitlement: public` and are typed
`illustration`, never `photo`. They carry an invisible SynthID watermark and are
therefore **illustrations only, never presented as real customer or reference
photography** — for a customer story, generate material and process, not people
or an identifiable plant. Re-encode large outputs before use (a 2K frame comes
back at 2–3 MB; a carousel should stay well under 5 MB).
