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
5. **Workflows** — `.claude/commands/deckbuilder.md` is the **orchestrator front
   door** (`/deckbuilder`) that routes a plain-language request to the right
   workflow. Underneath: `new-deck.md` (Personalize), `edit-canonical.md` (Edit),
   `ingest-dump.md`. The Personalize/Edit wall is real: Personalize writes only
   in `decks/variants/`; Edit changes the system itself.
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
   spacing, images). The builder is a workspace *bound to a deck* — `#/build`
   chooses one, `#/build/<id>` is that deck — which is what makes the version
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
   thumbnails. Made via `/deckbuilder`. Public by definition — no named-customer
   material. See `social/CLAUDE.md`.
9. **Market listening** — `research/last30days/` : every `/last30days` run
   recorded as structured knowledge (`runs/<slug>/run.json`), folded by
   `tools/research-brain.py` into an accumulating **brain** (themes gain
   confidence as evidence repeats) plus LinkedIn drafts in `posts/`. This
   folder is `LAST30DAYS_MEMORY_DIR`; research lives in the repo, not in
   `~/Documents`. Ideas are cheap; **promoting** one turns it into a
   `social/drafts/` draft (with its 1200×627 hero for an article) that
   `/deckbuilder` then builds. Engagement recorded after posting rolls back up
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
The workflows are driven from the **Claude Code CLI**: `/deckbuilder` (the front
door), `/new-deck`, `/edit-canonical`, `/ingest-dump`. `/new-deck` and every
building route of `/deckbuilder` have a hard approval gate — an unattended run
stops at the proposed plan and waits for a human to approve before building.

The **Deck Studio App** (optional, for browsing/composing visually) needs
**Node 18+**: `npm install && npm run dev` **from the repo root** →
http://127.0.0.1:4173. It calls Python for its library index, and has three npm
dependencies, all of them for rendering when hosted: `pdf-lib`, `puppeteer-core`
and `@sparticuz/chromium`. Locally it prints with the Chrome or Edge already on
the machine.

**The Node project is the repo root; the app is `app/`** (2026-08-05).
`package.json` + `package-lock.json` + `vercel.json` live at the root, with
`"main": "app/server.mjs"`, because Vercel builds a GitHub push from the repo
root: a root with no entrypoint is a failed build, and the green deploys before
this were hand-pushed from inside `app/`, which is not something a push can do.
One manifest, one lockfile, one `node_modules`, and **`git push` is the deploy**.

## How a deck is composed

A deck is not hand-written HTML. `deck.yaml` lists an ordered set of library slide
ids + deck-level variable values; `tools/assemble-deck.py` fills each fragment's
`{{variables}}` and writes a self-contained `index.html`.

Variables filled at assembly: `deck_title`, `deck_footer`, `cover_meta` (from
deck.yaml), `total` (computed slide count), `asset` (relative path to repo root,
computed from the output location). **Any unfilled `{{placeholder}}` is a hard
error** — none ever reaches a PDF. Variants may hold local slide overrides under
`decks/variants/<slug>/slides/<id>/slide.html` that win over the library.

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

## Build & verify (MANDATORY before calling a deck done)

```powershell
python tools\assemble-deck.py decks\<slug>
.\tools\build-pdf.ps1 -Deck decks\<slug>
python tools\verify-deck.py decks\<slug>
# publish the verified artifact: from here on, THIS is the artifact
python tools\publish-deck.py decks\<slug> [--master --type <t>] [--customer <slug>] `
    [--derived-from <deck-slug>]        # or --version-of <slug> to add a version
python tools\check-docs.py --check      # if you moved, renamed or deleted anything
```
Then **delete `decks/<slug>/`**: it is build scratch, and the artifact now lives
in the backend. A social output publishes with `publish-social.py` and then
`import-social.py`, which brings it into the same artifact model as a deck.

To build a new deck **from an existing one** (reproduction), first
`python tools\fetch-deck.py <slug>` and read the fetched HTML as content source,
then compose + publish with `--derived-from <slug>`.

`verify-deck.py` is the automated gate, and it is **format-aware**: the rules it
applies come from the artifact's `page_format` (see `verifylib.PAGE_FORMATS`), so
a carousel is checked as a carousel. For a deck: page count == slide count ==
every `data-total`; page size 13.333×7.5 in; **zero em dashes**; zero unfilled
`{{...}}`; footer discipline; images resolve and their entitlement ≤ the deck's
clearance (no customer-name leaks); WARNs on Anglo euro formatting and blank pages.
Then still do the **visual pass**: render each page and actually look (overflow,
footers, images, page numbers). A WARN about the verbatim `€ 55,000` quote is fine.

Regenerate the browsable surfaces after changes:
`.\tools\build-slide-catalog.ps1` (slide catalog) · `.\tools\build-asset-index.ps1`
(image contact sheet + manifest drift check). The Deck Studio App reads
`tools/build_app_index.py` live (its **Refresh library** button), so it needs no
manual regeneration.

## Rules

- **Footer discipline.** Content slides carry `.slide-foot` (wordmark, deck meta,
  `.pageno` with `data-total`). Roles `cover`, `closer`, `cta` have no footer.
  `verify-deck.py` enforces this by role.
- **Personalization is variables, not editing.** Audience-specific content
  (prepared-for, footer, cover meta, client) is expressed as `{{variables}}` in
  deck.yaml, or as a variant-local slide override — never by editing the library
  from `/new-deck`. Named customer material only in decks cleared for it: the
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
  the filename) are **universal**. Only page geometry and the deck-specific
  structural rules (footer discipline, `data-total`) vary, by `page_format`, from
  `verifylib.PAGE_FORMATS`. `app/lib/htmlcheck.mjs` is a different gate with a
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
  to shell out to, so the same five steps run in JavaScript
  (`app/lib/assemble.mjs` composes and snapshots, `render.mjs` prints,
  `verify.mjs` blocks, `publish.mjs` writes the rows) over the library mirrored
  into Storage. Still **one transform**, now with two runners:
  `tools/check-assemble-parity.py` builds the same recipe both ways and diffs the
  snapshot **byte for byte**, asset bundle included, so the second runner cannot
  drift. Same guard, same shape as `check-verify-parity.py`. Change one
  assembler, change both, run the check.

  | The CLI creates | The app changes and ships |
  |---|---|
  | A new **library slide** or design-system block | Compose a deck from chapters (Deck builder) |
  | Image generation, ingest, research runs | Reorder, add and remove slides; publish a new version |
  | Retiring a slide in the repo (`meta.yaml`) | **Archive** a slide so it cannot be picked |
  | | Edit text, spacing, images in place |
  | | Accept a master update; rename; regenerate the PDF |

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
  `linkedin.css` (4:5 carousel format), `deck-starter.html` (legacy skeleton)
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
- `tools/` — the engine and the gates:
  - **compose + publish**: `deckstudio.py`, `assemble-deck.py`, `snapshot.py`
    (deck folder → self-contained snapshot), `snapshot_html.py` (an already-built
    HTML document → self-contained snapshot), `publish-deck.py`, `fetch-deck.py`,
    `publish-social.py`, `import-social.py` (social output → the one artifact model)
  - **gates**: `verifylib.py` (the single rule source), `verify-deck.py`,
    `verify-carousel.py` (the LinkedIn playbook), `check-docs.py` (doc drift, and
    that every live slide is in exactly one chapter)
  - **parity** (one transform, two runners — the guards that stop them drifting):
    `check-verify-parity.py` (`verifylib.py` vs `app/lib/verify.mjs`) and
    `check-assemble-parity.py` (`deckstudio.py` + `snapshot.py` vs
    `app/lib/assemble.mjs`; `--via-storage` runs the JS side the way it runs
    hosted, reading every input out of Storage). Both diff real artifacts, so a
    rule changed on one side and not the other is caught rather than shipped.
  - **propagation**: `check-drift.py` (which published decks are behind their
    library slides; `--sync` mirrors the library into `library_slides` so the
    hosted app can answer it without a repo on disk), `check-story.py` (the
    **advisory** narrative pass; needs `ANTHROPIC_API_KEY`, and **never blocks,
    always exits 0** — it is a judgement, not a gate)
  - **render + export**: `build-pdf.ps1`, `build-carousel.ps1`,
    `build-social-image.ps1`, `build-article-hero.py`, `pdf-thumbs.py`,
    `export-element.py` (one library element as self-contained HTML/PNG/PDF),
    `build-static-fonts.py` (static instances into `brand/fonts-static/`; Chrome
    cannot serialize a variable font into a PDF and falls back to Type 3, which is
    what made the PDFs heavy), `build-cover-hero.py` (bakes the cover scrim into
    the hero, so the PDF carries no per-pixel shading functions),
    `build-qr.py` (a URL as an inline-ready **vector** QR into `brand/qr/`; raster
    QRs blur through the PDF and a blurred QR does not scan),
    `build-library-kit.py` (`library/kit/`: the **design kit** — the icon set, every
    design-system specimen and the brand kit in one self-contained zip with an
    offline viewer, for anyone outside Oppr who has to design something),
    `check-kit.py` (both shareable kits: every reference must resolve inside the
    kit and nothing may reach the network, because a kit is opened from a
    filesystem with no server and a wrong relative path is a broken download in
    front of a customer),
    `build-brand-kit.py` (`brand/kit/`: outlines the wordmark from the Archivo
    woff2 so it needs no font installed, rasterizes the PNGs, and writes the
    page, README and zip; `--check` fails when any output is stale)
  - **indexes**: `build_app_index.py`, `build-asset-index.ps1`,
    `build-slide-catalog.ps1`, `build-design-system.ps1`
  - **access**: `check-access.py` — adversarial only, never a happy path. Since
    2026-08-07 it also checks the **insider** case via the `policy_audit()` RPC:
    no policy may grant unconditionally to a non-service role. That check exists
    because a `allow_authenticated` policy (`ALL`, `USING(true)`) sat on eight
    tables while the suite reported 17/17 — it tested only as `anon`, and an
    outsider test cannot see a grant made to `authenticated`.
  - **other**: `supa.py` (backend client), `deck_pdf_name.py`,
    `generate-image.py`, `research-brain.py` (`--check` for CI),
    `manage-users.py` (accounts + passwords), `check-access.py` (adversarial
    access checks)
- `dump/` — the intake inbox (drop material to seed a deck; ends empty)
- `.env.example` — names of secrets; copy to `.env` (gitignored) and fill in
- `.claude/commands/` — `deckbuilder.md` (front door), `new-deck.md`,
  `edit-canonical.md`, `ingest-dump.md`
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
- An **article** (`kind=article`) has no HTML document yet, so it is the one
  output type still outside the edit → verify → PDF loop. Give its builder an
  HTML body and `import-social.py` will bring it in.

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
