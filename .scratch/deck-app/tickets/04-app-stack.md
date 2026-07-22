---
id: 04
title: App tech stack & repo integration
type: grilling
status: open
assignee:
blocked-by: [03]
---

## Question

Settled: local dev server (`npm run dev`) reading the repo live, saving drafts
to disk. Decide the concrete shape once the wireframe (03) shows the needed
interactivity:

1. **Stack**: Vite + React (drag-drop reorder, panels) vs. lighter. Node
   version, minimal dependency policy for a repo whose core is Python + HTML.
2. **Server API**: a tiny file API (read `library/**/meta.yaml`,
   `brand/img/library.json`, deck.yamls; write only `decks/drafts/**`) — or
   does the app read a generated JSON index (`tools/build-app-index.py`) and
   only the *writes* go through the server?
3. **Previews**: reuse existing `thumb.png`s + the assembled `index.html`s in
   iframes, or re-render? (Reuse is the default — no second render pipeline.)
4. **Guardrails**: server refuses writes outside `decks/drafts/`; read-only
   everywhere else; no network beyond localhost.
5. **Where it lives**: `app/` folder in this repo, its own package.json,
   documented in root CLAUDE.md as layer 7.
