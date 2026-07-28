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
3. **Deck types (recipes / the "living brain")** — `types/<type>/recipe.md` : the
   reusable brief per presentation type (goal, audience, skeleton, learnings).
   See `types/CLAUDE.md`.
4. **Canonical decks + frozen variants** — `decks/canonical/<type>/` are the
   masters (a `deck.yaml` composition); `decks/variants/<slug>/` are frozen,
   shipped snapshots. See `decks/CLAUDE.md`.
5. **Workflows** — `.claude/commands/deckbuilder.md` is the **orchestrator front
   door** (`/deckbuilder`) that routes a plain-language request to the right
   workflow. Underneath: `new-deck.md` (Personalize), `edit-canonical.md` (Edit),
   `ingest-dump.md`. The Personalize/Edit wall is real: Personalize writes only
   in `decks/variants/`; Edit changes the system itself.
6. **Intake inbox** — `dump/` : drop past decks / event material / images here;
   `/ingest-dump` files each piece into its home (library, images, brief,
   references) and leaves `dump/` empty. See `dump/CLAUDE.md`.
7. **Deck Studio App** — `app/` : a local **customer-first cockpit** (`npm run
   dev`) over the **v3 backend** (Supabase). Sidebar: **Customers** (home) ·
   **Output** (Masters + Company decks) · **Library** · **Knowledge**. Decks live
   in the backend as versioned HTML; the app opens a deck, **fine-tunes** it
   (text, layout nudges, entitlement-filtered image swaps), saves a new version,
   and **regenerates the PDF** through the same verify gate as the CLI. Masters
   are a tag (Personalize a master → a customer/event deck with lineage). The app
   talks only to the **local agent** (`app/server.mjs` + `app/lib/*`), which holds
   the Supabase secret key and runs assemble/print/verify; the browser never sees
   the key. Authoring (new decks/slides, structural change) stays CLI. See
   `app/README.md` and `.scratch/deck-app/hybrid-editor/report_and_implementation.md`.
8. **Social output** — `social/<channel>/<date>_<slug>/` : brand-styled
   carousels (4:5, `tools/build-carousel.ps1`), posts, articles, images,
   thumbnails. Made via `/deckbuilder`. Public by definition — no named-customer
   material. See `social/CLAUDE.md`.
9. **Knowledge** — `knowledge/` : the design brain in the open —
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
```
Rendering also needs **Google Chrome or Microsoft Edge** installed (HTML → PDF/PNG).
The workflows are driven from the **Claude Code CLI**: `/deckbuilder` (the front
door), `/new-deck`, `/edit-canonical`, `/ingest-dump`. `/new-deck` and every
building route of `/deckbuilder` have a hard approval gate — an unattended run
stops at the proposed plan and waits for a human to approve before building.

The **Deck Studio App** (optional, for browsing/composing visually) needs
**Node 18+**: `cd app && npm run dev` → http://127.0.0.1:4173. It has no npm
dependencies and calls Python for its library index.

## How a deck is composed

A deck is not hand-written HTML. `deck.yaml` lists an ordered set of library slide
ids + deck-level variable values; `tools/assemble-deck.py` fills each fragment's
`{{variables}}` and writes a self-contained `index.html`.

Variables filled at assembly: `deck_title`, `deck_footer`, `cover_meta` (from
deck.yaml), `total` (computed slide count), `asset` (relative path to repo root,
computed from the output location). **Any unfilled `{{placeholder}}` is a hard
error** — none ever reaches a PDF. Variants may hold local slide overrides under
`decks/variants/<slug>/slides/<id>/slide.html` that win over the library.

## Build & verify (MANDATORY before calling a deck done)

```powershell
python tools\assemble-deck.py decks\<canonical-or-variant-path>
.\tools\build-pdf.ps1 -Deck decks\<...>
python tools\verify-deck.py decks\<...>
# v3: publish the verified deck to the backend (it becomes the living deck)
python tools\publish-deck.py decks\<...> [--master --type <t>] [--customer <slug>] `
    [--derived-from <deck-slug>]        # or --version-of <slug> to add a version
```
To build a new deck **from an existing one** (reproduction), first
`python tools\fetch-deck.py <slug>` and read the fetched HTML as content source,
then compose + publish with `--derived-from <slug>`.

`verify-deck.py` is the automated gate (SPEC.md §9): page count == slide count ==
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
  deck.yaml enforce this mechanically (Holliday/Venator → `mutares-family` only).
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
- **Decks live in the backend as versioned HTML (v3).** After a CLI build, the
  deck is **published** to Supabase as a self-contained HTML snapshot (inlined
  CSS + bundled assets). From there it is the deck: the app edits it and every
  save is a new immutable version; the "current" pointer moves; git no longer
  versions decks (it versions the tool). Old "variants are frozen" is superseded
  by immutable versions. Masters are a **tag** (one per type), not the
  `decks/canonical/` folder. See `.scratch/deck-app/hybrid-editor/report_and_implementation.md`.
- **PDF naming.** Every built PDF carries `oppr`, and a named-client deck carries
  the client slug: `YYYY-MM-DD_oppr_<type-or-purpose>[_<client>].pdf` (canonical:
  `oppr_<type>.pdf`). `build-pdf.ps1` derives it from `deck.yaml` (add a top-level
  `client:` for a named deck); `verify-deck.py` FAILs a PDF missing `oppr` or the
  client slug. LinkedIn PDFs follow the same rule.
- **Secrets never in the repo.** Real keys live only in `.env` (gitignored);
  `.env.example` lists the variable names. Nothing checked in ever contains a key.
- **Authoring is CLI-only; the app fine-tunes and re-prints (v3).** New decks,
  new slides and structural changes stay in the CLI (recipes, design-system rule,
  approval gate, entitlement clearance). The app **edits the published HTML**
  (text, layout nudges, entitlement-filtered image swaps) and can **regenerate
  the PDF**, running the exact same `verify` gate as the CLI (`tools/verifylib.py`)
  — a failed verify withholds the PDF and flags the deck **needs CLI**. The
  server re-validates every save is structure-preserving (`app/lib/htmlcheck.mjs`),
  so the boundary never depends on the browser. The app writes staging areas
  (`dump/_app/`, legacy `decks/drafts/`, `social/drafts/`) and the backend (deck
  versions, publish_log) via the local agent; it never writes `library/`,
  `brand/` or `templates/`.

## Structure

- `brand/` — BRAND.md, wordmark/icon SVGs, fonts, `img/` (with `library.json`
  manifest and generated `index.html` contact sheet)
- `templates/` — `deck.css` (system), `showcase.css` (shared deck-local styles),
  `linkedin.css` (4:5 carousel format), `deck-starter.html` (legacy skeleton)
- `library/` — `slides/<id>/` (fragments + meta + thumb) and generated `catalog.html`;
  `design-system/` (block specimens); `icons/` (reusable icon set + `icons.json`)
- `types/` — `<type>/recipe.md` per presentation type
- `decks/` — `canonical/<type>/` (masters), `variants/<slug>/` (frozen), and
  `drafts/<slug>/` (pending drafts from the app; normally empty)
- `customers/<slug>/` — one folder per customer (`customer.yaml` + logo);
  CLI-owned (filed by `/ingest-dump` from a `dump/_app/` intake), read by the app.
  A customer's decks are matched by the `client:` slug on its variants.
- `social/` — `<channel>/<date>_<slug>/` outputs (carousels, posts, articles,
  images, thumbnails) + `drafts/` staging
- `knowledge/` — `design-philosophy.md`, `best-practices/<type>.md` (living docs)
- `app/` — the Deck Studio App (`server.mjs`, `web/`; `npm run dev`)
- `tools/` — `deckstudio.py` (engine), `assemble-deck.py`, `verify-deck.py`,
  `verify-carousel.py` (the carousel gate, enforces the LinkedIn playbook),
  `build_app_index.py`, `deck_pdf_name.py`, `generate-image.py`,
  `build-pdf.ps1`, `build-carousel.ps1`, `build-social-image.ps1`,
  `build-asset-index.ps1`, `build-slide-catalog.ps1`
- `dump/` — the intake inbox (drop material to seed a deck; ends empty)
- `.env.example` — names of secrets; copy to `.env` (gitignored) and fill in
- `.claude/commands/` — `deckbuilder.md` (front door), `new-deck.md`,
  `edit-canonical.md`, `ingest-dump.md`
- `.scratch/deck-tool/` + `.scratch/deck-app/` — the wayfinder maps, SPECs, research

## Versioning

The repo is under git. Canonical "best versions" are git tags
`canonical/<type>@vN`; "look back" is `git log`/`git show` on a fragment or tag.
Variants record provenance in their `manifest.yaml` (source canonical + per-slide
commit). PDFs (canonical and variant) are committed — the shipped artifact and record.

## Roadmap (agreed, not yet built — keep to the spec until asked)

- Other social formats (X, one-pagers) follow the LinkedIn pattern.
- Team access & sharing (deliberately deferred — the app is single-user/local).
- Translation-alignment tooling for language variants.

**Built since the original spec:** the Phase-2 visual browser / composer app
(`app/`), the `/deckbuilder` orchestrator, LinkedIn carousel output (see
`.scratch/deck-app/APP-SPEC.md`), and **image generation**
(`tools/generate-image.py`, 2026-07-23).

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
