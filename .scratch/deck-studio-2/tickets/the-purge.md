# The purge

Type: task · Status: open · Blocked by: One store of truth, Artifact model

## Question

What is actually unreferenced, and does it go?

This is the one ticket that *does* rather than decides — but it is deliberately
blocked, because "unreferenced" is only knowable once the store-of-truth and
artifact-model decisions are recorded. Purging first would delete things the
answer needs.

## The inventory to build

Nothing below is a verdict. Each line is a candidate that must be **proved**
unreferenced before it is deleted.

**Front-end modules** (`app/web/js/`) — the previous nav overhaul left the
pre-v3 builder on disk, expecting it to be dead. It is not, yet:

- `views/draft.js` (252) — **imported by nobody. Confirmed dead 2026-08-01**
  (`grep -rn "draft\.js" app/web/` finds only its own body). Deletable as soon as
  this ticket opens; no decision needed.
- `compose.js` (75) — imported by `views/slides.js` (`renderTray`), which
  `main.js` routes to. **Live**, and the last thread holding the old composer.
  The nav-overhaul map already flagged this as "a small follow-up cleanup".
- `views/carousel-build.js` (64) — imported by `views/social.js` (`PATTERNS`,
  `blankPage`) and `views/viewer.js` (`pageHtmlFor`). **Live.**
- `postedit.js` (222) — imported by `views/social.js` (`openPostEditor`). **Live.**

So `social.js` is the keystone: it keeps carousel-build and postedit alive, and
its fate follows from *Artifact model*. Note that `postedit.js` is a **second,
separate editor** for posts, parallel to `editor.js` for decks — *Editor
coverage* decides whether they merge or one dies. Verify each import is actually
reachable at runtime, not merely present.

**On-disk content, untracked** (git cannot restore these — confirm in the backend
first, per the map's Notes):

- `decks/canonical/engagement`, `engagement-v2`, `engagement-v3`, `engagement-v4`
- `decks/canonical/proposal`, `decks/variants/2026-08-01_wavin-rnd`
- `decks/drafts/2026-07-23_duinrell`
- `social/drafts/*` (3), `social/linkedin/*` (2)
- `app/.deck-cache/*` — 4 deck ids, multiple versions each
- `references/`, `screenshots/`

**Tools** (`tools/`, 24 files) — verify each still has a caller:
`migrate-decks.py` and `migrate-content.py` are one-shot v3 migrations;
`snapshot.py`, `build_asset_index.py` vs `build-asset-index.ps1`, and the
`build-*.ps1` / `build_*.py` pairs may be duplicates.

**`.scratch/`** (59 tracked files) — four prior maps:
`deck-tool/`, `deck-app/` (+ `nav-overhaul/`, `hybrid-editor/`),
`cloud-backend/` (10 tickets), `carousel-series/`, `welcome-colleague/`.
Decide per map: superseded (delete), still-live decisions (fold into this map's
Decisions so far), or historical record worth keeping. `cloud-backend/` in
particular describes a GCP direction that Supabase replaced.

**Root** — `skills-lock.json` is gitignored but present; `tools/__pycache__`.

## Execution

One commit per category, each with the evidence that proved the deletion safe.
Do not batch untracked deletions with tracked ones.
