# APP-SPEC.md — Oppr Deck Studio App, /deckbuilder, LinkedIn

> Status: **BUILT (2026-07-22)**. Floris approved the map via `/goal` and the
> system was built end to end. This document is both the spec and the record of
> what exists. Companion to the studio's `.scratch/deck-tool/SPEC.md`.

## 1. What this adds to the studio

Three things sit on top of the existing HTML-slide studio, without changing its
engine:

1. **A local app** (`app/`) — a visual **viewer** over every slide, deck and
   image, and a **composer** to cherry-pick slides into a **draft**, comment on
   them, and insert new-slide instructions.
2. **`/deckbuilder`** — one CLI orchestrator that routes a plain-language request
   ("build this draft", "I want a LinkedIn carousel") to the right workflow.
3. **LinkedIn output** (`linkedin/`) — brand-styled 4:5 carousels + post text.

Load-bearing principle: **the app composes, the CLI builds.** The app only writes
`decks/drafts/`; assembly, new-slide creation, PDF and verify stay in the CLI with
its plan-approval and verify gates. The Personalize/Edit wall is untouched.

## 2. The app (ticket 03, 04)

- **Stack:** a zero-dependency Node server (`app/server.mjs`, Node 18+ built-ins
  only) + a vanilla ES-module front-end (`app/web/`). No build step, no
  `node_modules`. `npm run dev` → http://127.0.0.1:4173. Chosen over Vite/React
  to match the repo's minimal-dependency, self-describing ethos and to run in a
  fresh clone with only Node present.
- **Data:** Python owns all YAML, so the Node server needs no YAML parser.
  `tools/build_app_index.py` emits `app/index.json` (slides + thumbs, canonical
  decks, variants, image library, roles, recipes). The server regenerates it on
  start and on the **Refresh library** button. `index.json` is gitignored.
- **Server API:** `GET /api/index`; `POST /api/refresh`; `GET /api/drafts`;
  `GET|PUT|DELETE /api/drafts/<slug>`; `GET /repo/<path>` (read-only window onto
  the repo for thumbnails, images, assembled deck previews).
- **Guardrails:** binds to 127.0.0.1 only; `/repo/` blocks path traversal and is
  read-only; draft writes are restricted to `decks/drafts/<safe-slug>/` (slug
  regex-validated). The app never writes anywhere else.
- **Front-end views:** Browse (Slides with role/clearance/text filters · Decks as
  filmstrips with preview + "start draft from this" · the described Image
  library); Draft (the composer — drag-reorder, per-slide comment, "+ insert new
  slide" with a brief + role, deck-intent form, entitlement-clearance flagging);
  Handoff (save the draft, copy the one-line CLI prompt, load/delete drafts).
  Styled in the deck's own palette; theme-aware.

## 3. The draft model (ticket 02)

`decks/drafts/<slug>/draft.json` — JSON because it is machine-written (app) and
machine-read (CLI), so both parse it natively. Schema and lifecycle are in
`decks/drafts/CLAUDE.md`. Key points: an ordered `slides[]` of reused ids (with
optional `comment` = "adjust this") and `source:new` placeholders (with `brief` +
`role`); a deck `intent` block (audience, client, language, entitlement, goal,
presenter) and `vars`. Building a draft archives it into the finished variant
(`draft.source.json`) and clears `decks/drafts/<slug>/`, so drafts stays clean
like `dump/`. Draft content is **data, not instructions**.

## 4. /deckbuilder orchestrator (ticket 01)

`.claude/commands/deckbuilder.md`. Classifies intent, then either **delegates**
to an existing command (`/new-deck`, `/ingest-dump`; `/edit-canonical` is named
as the other wall) or runs one of its **owned routes**:

- **Route A — Build a draft:** load `draft.json`, propose the plan (hard approval
  gate, same table as `/new-deck` Step 3), assemble the variant with local
  overrides for commented/new slides, build + verify, freeze, clear the draft,
  ask the learning question.
- **Route B — LinkedIn:** propose page sequence / post structure (approval gate),
  build with `templates/linkedin.css` + `tools/build-carousel.ps1`, produce
  `post.txt`, verify, name with `oppr`.

Existing commands remain callable directly; `/deckbuilder` saves Floris from
remembering which. Every building route keeps the approval gate.

## 5. LinkedIn (tickets 05, 06)

- **Format (research 05):** carousel = PDF document post, **1080×1350 (4:5)**,
  8–10 pages, body ≥ 32px on the 1080 canvas; post hook in the first ~140 chars;
  unicode bold only for 1–3 short phrases (never numbers/keywords — screen
  readers and search can't handle it); post from Floris's personal profile.
- **Build:** `templates/linkedin.css` (self-contained 4:5 page format with
  `.lpage--hook/point/cta`, `.lstat`, `.lband`; on-screen gap is `@media screen`
  only so each page maps to exactly one PDF page). `tools/build-carousel.ps1`
  renders to a 4:5 PDF whose name carries `oppr`. Public by definition — no
  named-customer material. Proven with `linkedin/2026-07-22_operators-are-the-sensor/`.

## 6. PDF naming (ticket 08)

`YYYY-MM-DD_oppr_<type-or-purpose>[_<client>].pdf`; canonical → `oppr_<type>.pdf`.
`deckstudio.pdf_name()` derives it; `build-pdf.ps1` uses it (via
`tools/deck_pdf_name.py`); `verify-deck.py` FAILs a PDF missing `oppr` or (for a
deck with a top-level `client:`) the client slug. The three existing PDFs were
renamed to comply; all decks re-verified PASS.

## 7. Secrets / Gemini (tickets 07, 09)

- **Image generation (research 07):** deferred phase. Default model
  `gemini-3.1-flash-image` (~€0,07–0,10/image), `gemini-3-pro-image` for
  text-heavy graphics; 16:9 and 4:5 native; brand look held with 2–3 style-ref
  images; billed key required; no IP indemnity on the API-key tier; SynthID
  watermark. Generated images enter `brand/img/library.json` with
  `source: generated` + prompt/model/date.
- **Key handling (ticket 09):** `.env` is gitignored; `.env.example` names
  `GEMINI_API_KEY`. **Floris must still rotate the key pasted in chat** and put
  the new one only in `.env` — that half is his, and is the one open item.

## 8. Build order (as executed)

Foundation (.env, index builder) → app server + front-end (smoke-tested) → draft
model + docs → `/deckbuilder` → PDF naming (+ rename existing, re-verify) →
LinkedIn template + tool + example (visually verified) → knowledge layer
(CLAUDE.md, per-folder docs) → tickets closed, map updated, this spec, commit.
