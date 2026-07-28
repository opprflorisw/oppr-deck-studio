# app/ — Oppr Deck Studio App (local workbench, v3)

A local, single-user web app over the **v3 backend** (Supabase). Decks live in
the backend as versioned, self-contained HTML. The app **browses** the library
and outputs, **fine-tunes** a published deck in place (text, layout nudges,
entitlement-filtered image swaps — every save a new immutable version),
**regenerates its PDF** through the same verify gate as the CLI, and
**personalizes** a master into a customer/event deck. Authoring — new decks, new
slides, structural change — stays in the CLI (`/deckbuilder`), with its
plan-approval and verify gates.

**Architecture.** The browser talks only to the **local agent** (`server.mjs` +
`app/lib/*`), which holds the Supabase secret key (never sent to the browser),
proxies the backend, and runs assemble/print/verify locally (headless Chrome for
PDF, Python for verify). Decks are materialized on demand into `app/.deck-cache/`
(gitignored). The agent writes staging areas (`dump/_app/`, legacy
`decks/drafts/`, `social/drafts/`) and the backend (deck versions, publish_log);
it never writes `library/`, `brand/`, or `templates/`. Needs
`SUPABASE_URL` + `SUPABASE_SECRET_KEY` in `.env`. See
`.scratch/deck-app/hybrid-editor/report_and_implementation.md`.

Below describes the pre-v3 draft/compose surface; parts are legacy (the composer
is superseded by the editor + personalize).

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
- **Decks** — the deck browser (preview, download). Lists the **canonical
  masters**, then **Company decks**: frozen variants with no `client:` (teasers,
  investor updates, internal cuts). A variant built *for* a customer is not here,
  it lives under that **Customer**.
- **Social output** — the social browser, split by **category** across the tab bar
  (All · Carousels · Job descriptions · Posts). Category is what a piece *is*
  editorially; it is declared in the output's `meta.yaml` (`category:`) and falls
  back to the artifact shape (`kind`) when absent, so a carousel with no meta still
  lands under Carousels. Within a category, the sticky **status** sub-filter
  (All / Draft / Posted / Archived) still applies; when it hides everything the
  empty state says so and offers **Show all**. An output offers whichever artifact
  it ships: **PDF** for a carousel, **PNG** for a single image (kind `image`), from
  the row and from inside the paged viewer.
  Post text opens the **Unicode post editor**: bold / italic / bold-italic
  toggling, list and separator characters, a live feed preview showing where the
  "see more" fold lands, and **Copy all** for pasting straight into LinkedIn.
  Rows can also be **archived** (reversible) or **deleted** (not). See below.
- **Knowledge** — Design philosophy, living **Best practices** docs, Recipes,
  and a **⚙ Config** browser over a read-only whitelist of the studio's docs
  (rendered with a built-in markdown renderer).

## Archive and delete (Output → Social)

Two ways to clear the list, deliberately unequal.

- **Archive** is a flag in `social/_status.json`, never a file move. The built
  artifact stays exactly where the CLI put it; the row leaves All / Draft /
  Posted and lives under its own **Archived** tab, one click from being restored.
  This is the one you want.
- **Delete** removes `social/<channel>/<slug>/` outright: the built PDF or PNG, `index.html`,
  the post text and the brief. `DELETE /api/social-output/<channel>/<slug>` is
  the only place the app removes a built artifact, so it is fenced: channel and
  slug are pattern-checked, the path is rebuilt server-side rather than taken
  from the client, and the resolved directory must sit inside
  `social/<channel>/` before anything happens. The dialog names the exact path,
  offers Archive instead, and keeps the button disabled until the slug is typed
  in full. An output that was never committed to git is not recoverable.

Delete **rebuilds `app/index.json`** before returning, and it is **idempotent**:
`app/index.json` is a cache, so a row can outlive the folder it points at (deleted
by hand, moved by the CLI). Returning 404 on that made the stale row permanently
undeletable, since the index rebuild is the only thing that clears it. A missing
folder is now a success that removed nothing (`{ok: true, removed: false}`), the
index is regenerated either way, and the client re-fetches it so the row does not
reappear on the next reload.

## The Unicode post editor

`web/js/postedit.js`. LinkedIn has no rich text: "bold" there is Unicode
Mathematical Alphanumeric Symbols, different characters that look bold. The
styling **is** the text, which is why a plain `<textarea>` can display it and why
copying is the whole delivery mechanism.

- **Never writes to disk.** `post.txt` stays the plain source the CLI built, and
  styling is applied fresh each time you open it. The stored copy stays
  greppable, searchable and readable by a screen reader. This keeps the app on
  its side of the "the app composes, the CLI builds" wall.
- **Toggles, not one-way.** Selecting already-styled text and clicking the same
  button returns it to plain, so posts that arrive with hand-authored Unicode
  bold behave like anything else. Bold → italic converts in one click.
- **Digits are never mapped**, which enforces the brand rule (never bold a
  number: search cannot index it, a screen reader spells it out) silently rather
  than warning after the fact.
- **Counts characters, not UTF-16 units.** A Mathematical Alphanumeric character
  is one character but two code units, so `.length` over-counts a styled hook by
  roughly 2× and would report a legal post as over the 3000 limit. Every count
  goes through `Array.from`.
- The brand fonts are subset woff2 and do not cover these codepoints, so styled
  runs fall back to a system font. That is expected, and useful: styled text is
  visibly distinct while you edit.

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
