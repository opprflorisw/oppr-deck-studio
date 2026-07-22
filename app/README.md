# app/ — Oppr Deck Studio App (local viewer + composer)

A local, single-user web app to **browse** everything the studio has (library
slides with thumbnails, canonical decks, frozen variants, the image library) and
**compose** a new deck by cherry-picking slides, commenting on them, and
inserting new-slide instructions. It then **hands off** to the Claude CLI, which
does the actual building.

The app is **eyes and hands, not the brain**: it never assembles a deck, never
edits the library or canonicals, and only ever writes under `decks/drafts/`. The
CLI (`/deckbuilder`) stays the engine, with its plan-approval and verify gates.

## Run

```
cd app
npm run dev        # -> http://127.0.0.1:4173
```

No install step and no dependencies: the server (`server.mjs`) uses only Node
built-ins (Node 18+). It needs **Python on PATH** (the same interpreter the rest
of the studio uses) to build the library index — it runs
`tools/build_app_index.py` on start and when you click **Refresh library**.

## How it works

- **`server.mjs`** — a tiny HTTP server on localhost. Serves the front-end,
  serves repo files read-only under `/repo/…` (thumbnails, images, assembled
  deck previews), exposes `/api/index` (the library), and reads/writes drafts
  under `/api/drafts/…`. Guardrails: writes only under `decks/drafts/<slug>/`,
  path traversal blocked, localhost only.
- **`tools/build_app_index.py`** (in the repo, not here) — Python owns all YAML
  reading, so the Node server needs no YAML parser. It emits `app/index.json`
  describing slides, decks, images, roles and recipes. `index.json` is generated
  and gitignored.
- **`web/`** — the front-end: plain ES modules, no build step, styled in the
  deck&rsquo;s own palette (`app.css` mirrors `templates/deck.css` tokens).

## The flow

1. **Browse** — filter slides by role / clearance / text; see decks as
   filmstrips; browse the described image library. Add slides to a draft.
2. **Draft** — reorder by drag, comment on any slide (&ldquo;what to change
   here&rdquo;), press **+ Insert new slide** to add an instruction, and fill the
   deck intent (audience, client, language, entitlement, goal). Slides above the
   draft&rsquo;s clearance are flagged.
3. **Handoff** — save the draft to `decks/drafts/<slug>/draft.json` and copy the
   one line to run in the CLI: `/deckbuilder build draft <slug>`. The CLI shows a
   plan, waits for approval, then assembles + builds + verifies.

The working draft is also kept in the browser (localStorage), so a refresh
doesn&rsquo;t lose it; **Save** is what commits it to the repo for the CLI.
