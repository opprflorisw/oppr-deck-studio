# app/ — Oppr Deck Studio App (local workbench)

A local, single-user web app to **browse** everything the studio has, **compose**
decks and social outputs, and **hand off** to the Claude CLI, which does the
actual building. The app is **eyes and hands, not the brain**: it never assembles
a deck or edits the library/canonicals. It writes only staging areas
(`decks/drafts/`, `social/drafts/`, `dump/_app/`); the CLI (`/deckbuilder`) builds,
with its plan-approval and verify gates.

## Run

```
cd app
npm run dev        # -> http://127.0.0.1:4173
```

No install step and no dependencies: the server (`server.mjs`) uses only Node
built-ins (Node 18+). It needs **Python on PATH** (to build the library index)
and **git** (for slide version history).

## What's in it (v2)

A persistent **left sidebar** with hash routing (deep-linkable, back-button works):

- **Library**
  - **Slides** — Cards / Sections (the narrative spine) / Table (audit) views;
    a slide **detail page** with a live preview, meta, used-in + image
    cross-links, and **git-backed version history** (flip through and compare
    past versions).
  - **Graphics** — the described image library with **usage cross-references**
    (which slides / decks use each), an unused filter, and an **Import** flow
    that stages files into `dump/_app/` for `/ingest-dump`.
  - **Design system** — the specimen index rendered from the real stylesheets.
- **Create**
  - **Deck drafts** — the composer: turn on **Compose** mode, cherry-pick from
    the library (a bottom tray tracks the draft, with a multi-draft switcher),
    comment per slide, insert new-slide instructions, then save + hand off.
  - **Social studio** — carousel and post composers (4:5 preview; live 140-char
    hook counter), brief-only for article/image/thumbnail. Saves to
    `social/drafts/`, hands off with `/deckbuilder build social <slug>`.
- **Output** — **Decks** and **Social** browsers (preview, PDF, post text).
- **Knowledge** — Design philosophy, living **Best practices** docs, Recipes,
  and a **⚙ Config** browser over a read-only whitelist of the studio's docs
  (rendered with a built-in markdown renderer).

## How it works

- **`server.mjs`** — a localhost HTTP server. Serves the front-end and repo files
  read-only under `/repo/…`; exposes `/api/index`, drafts (`/api/drafts`,
  `/api/social-drafts`), `/api/history/slide/…` (git), `/api/knowledge/…`
  (whitelist), and `/api/import-graphics` (staging). Guardrails: writes only under
  the three staging areas, path traversal blocked, git args validated, localhost
  only.
- **`tools/build_app_index.py`** (in the repo) — Python owns all YAML, so the Node
  server needs no YAML parser. It emits `app/index.json` (slides + sections +
  version counts, decks, images, social outputs, recipes). Generated + gitignored;
  regenerated on start and on **Refresh**.
- **`web/`** — the front-end: plain ES modules (`web/js/**`), no build step, styled
  in the deck's own palette. See `.scratch/deck-app/V2-SPEC.md` for the full design.
