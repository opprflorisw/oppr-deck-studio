# Deck Studio 5 — Deck Manager 2.0 Implementation Guide

Status: **live** (adopted 2026-08-19; see `.scratch/README.md`).
Execution status is section 0 — phases 0 through 3 are delivered and verified,
4 and 5 are not.
Date: 2026-08-19. Supersedes `deck-studio-4/MAP.md` as the live map on adoption;
its decisions carry forward except where a locked decision below overrides one.
Basis: the full-system audit of 2026-08-19 (six subsystem audits + live backend
query), published as the "Deck Studio Atlas" artifact and digested in the
session scratchpad.

This is an **instruction document**: every phase is a numbered list of concrete
steps with the files they touch, the tests that prove them, and an acceptance
checklist. Work top to bottom. Each phase leaves the system shippable.

---

## 0. Status — what is delivered, and what is not

Updated 2026-08-19, after the first execution pass. Written here rather than in
a separate file, because a plan whose status lives somewhere else is a plan
nobody trusts.

### Delivered and verified

| Phase | What landed | How it was proved |
|---|---|---|
| **0** | `/repo` allowlist on both branches; clearance derived server-side; capability gating; htmlcheck refuses external URLs; verify-on-save; `page_format` written and never silently defaulted; six small bugs; JWT `exp`/`iss` required; MCP errors sanitised | 104 tests; a real signed-in **viewer** gets 404 on `.env`, `.git/config`, `package.json` and `tools/supa.py`, and 403 on every write |
| **1.1** | The whole schema into `supabase/migrations/`, applied and diffed against the live project | Applying it changed exactly 6 policies, all tightening `public` → `authenticated`; 23/23 access checks |
| **1.1b** | **A live hole closed**: `storage.objects` carried `ALL TO authenticated USING (bucket_id='deck-files')`, granting read/write/DELETE over every PDF and asset to any account including a viewer and a disabled one. `policy_audit()` could not see it — it was scoped to `public` | Both RPCs now cover `public`, `storage`, `auth`; a viewer's upload, overwrite, insert, master-update and version-delete all refused, measured |
| **1.2** | `publish_version()` and `create_deck_with_v1()` — allocation and the pointer in one transaction | 6 integration tests, including 5 concurrent publishes producing 2,3,4,5,6; a corpus-wide assertion that no deck points at a missing version |
| **1.4** | `lib/handlers/` shared by both doors; one `slugify`; `selectAll` promoted out of `collide.mjs` | The five drifts named in the audit are gone by construction; JS and Python agree on 15 slug cases |
| **2a** | `tools/studio.mjs`; `library.mjs` and `accounts.mjs` ported; print timeout | The ported sync finds **zero** differences from the mirror Python wrote, across 48 slides, 11 chapters and all 48 entitlement sets |
| **2b** | JS is the pipeline everywhere; `DECK_PY_BUILD=1` is the way back | Two real decks built and published through it (v1 at 4 pages, v2 at 5), assets deduped 11 not 22, then removed |
| **3** | 21 MCP tools, the build loop, `deck_drafts`, tools-as-data, the leaf guard finally wired | The whole loop walked live: start → adjust → vars → check → publish v1 → PDF → record sent → timeline. `deck_open` on a master, as an editor, refused by name |
| **3b** | CLAUDE.md rewritten; 22 old-pipeline files carry a FROZEN banner | The docs gate passes, and it now reads `.claude/commands/` too |
| — | Pushed to GitHub; Vercel deploy **READY** | Hosted: `/repo/.env` 404s for a signed-in editor, MCP `initialize` answers, `tools/list` 401s with `WWW-Authenticate` |

### Not delivered

Named honestly rather than quietly dropped:

- **The Python pipeline is frozen, not deleted.** The files still exist and
  carry a banner. Eight things still shell to Python: `build_app_index.py`,
  `build-article-hero.py`, `export-element.py`, `pdf-thumbs.py`,
  `publish-assets.py`, `check-drift.py`, plus `research-brain.py` and the
  owner utilities that are staying. Deleting the frozen set needs those ports
  first.
- **Phase 2.2 (one gate) is not done.** `verify-carousel.py` still holds the
  LinkedIn rules and `build-article.py` its own; neither is folded into
  `verify.mjs` yet. The carousel and article pipelines still run the old way.
- **Phase 4 (the app) is not done.** The builder still uses `decks.draft_recipe`
  and localStorage rather than `deck_drafts`; Personalize has not merged into
  start-from-master; the coherence sweep, the search work and Record-sent-on-the-
  deck-page have not been touched. The MCP loop has all of this; the browser
  does not yet.
- **Phase 5 (content) is partly done.** Recipes are de-staled and the docs gate
  enforces it. BRAND.md's vocabulary, the back-cover contact variables, the
  inline-SVG conversion and the `why`/`with` mirror are not.
- **The four failing artifacts are not fixed** — three square carousels and the
  Holliday image in a public one. Both need a decision, not a patch.

### The next three things

1. Fold the carousel and article rules into `verify.mjs`, then port the six
   shelled-to tools, then delete the frozen set. That closes D1 properly.
2. Point the app's builder at `deck_drafts` and merge Personalize into
   start-from-master, so the browser and the connector are the same product.
3. Decide on the four failing artifacts, and on O-1..O-4 below.

---

## 1. The locked decisions

These were decided by Floris on 2026-08-19 and are not open questions.

| # | Decision | Consequence |
|---|---|---|
| **D1** | **One runtime: JavaScript.** `app/lib/` (assemble, verify, render, publish, jobs) becomes the *only* pipeline. The Python/PowerShell pipeline retires. | `deckstudio.py`, `verifylib.py`, `build-from-recipe.py`, the three `.ps1` renderers and both parity checks are deleted at the end of Phase 2. A short list of owner utilities stays Python (§2.4) because they are not pipeline and have no good Node equivalent. |
| **D2** | **Editors author through the simplified builder.** A colleague builds a deck by **selecting existing library slides** and filling **deck variables** (customer, title, header/footer, cover meta, prepared-for). They never author a new slide, never touch the library, never need Claude Code. | The app's Deck Builder is already this — Phase 4 simplifies and hardens it. Personalize merges into "start from a master" so there is exactly one way to make a customer deck. |
| **D3** | **No share links in 2.0. The deliverable is the PDF.** | The share-link feature stays out of scope (revisit in 2.1). `deck_sends` stays manual ("record sent"). MCP gets a `deck_pdf` tool that returns a **short-lived signed URL to the authenticated caller** — that is a download for the signed-in user, not a share link (§6.3, decision O-1). |
| **D4** | **The deck-building skills are removed and baked into MCP.** `.claude/commands/deckbuilder.md` and `new-deck.md` are deleted. Their job — compose, check, publish a deck — becomes MCP tools any Claude (desktop, web, phone) can call, plus the app builder. | `/edit-canonical` and `/ingest-dump` are **kept**: they are mother work — tool-builder workflows — and stay Claude Code + repo (§6.6). They are rewritten for the JS runtime. |
| **D5** | **Two ways to connect, one permission model.** Floris (owner, tool builder) works in this repo with Claude Code: library, masters, brand, the tool itself. Colleagues (editors) connect Claude via the **MCP connector** and/or use the app: customers, decks, sends. Same `/mcp` endpoint for everyone; the **role on the profile decides**, and mother verbs simply have no MCP tool — the absence stays the boundary. | No owner-only MCP tools are added. Mother work never gets a remote surface. |
| **D6** | **Everything is tested.** The repo goes from zero tests to a `node:test` suite with a fixture corpus, ported doc/access gates, and CI on every push. No phase is "done" until its tests are green. | §9 is the complete test plan. |

---

## 2. Target architecture (the "after" picture)

### 2.1 One runtime

```
                    ┌──────────────────────────────────────────────┐
                    │  app/lib  — THE pipeline (only one)          │
  recipe ───────────▶  assemble.mjs → render.mjs → verify.mjs ─────▶ publish.mjs
  (app builder,     │  jobs.mjs orchestrates; guard.mjs gates      │   │
   MCP tools,       │  handlers/ shared by browser + MCP           │   ▼
   studio CLI)      └──────────────────────────────────────────────┘  Supabase
                                                                       decks +
  tools/studio.mjs  — the owner's CLI, a thin shell over app/lib       versions +
  tools/*.py        — owner utilities only (images, fonts, kits)       storage
```

- The **same five gates** run everywhere: compose → assemble → print → verify →
  publish. There is one implementation of each, in `app/lib/`.
- The **owner CLI** (`tools/studio.mjs`, run as `npm run studio -- <cmd>`)
  imports the same modules — zero duplication by construction. The parity
  apparatus retires because there is nothing left to compare.
- Remaining **Python is owner-utility only** (§2.4): image generation, font
  instancing, kits, research brain. None of it sits in the artifact pipeline;
  none of it is needed by an editor; none of it runs hosted.

### 2.2 Who connects how

| Person | Surface | Can do | Cannot do |
|---|---|---|---|
| **Floris (owner)** | Claude Code in this repo; the app; MCP | Everything: library slides, masters, brand, CSS, the tool itself, plus all leaf work | — |
| **Colleague (editor)** | The app; **Claude + MCP connector** (desktop/web/phone) | Register customers, build a deck from existing slides, fill variables/slots, check, publish versions, download PDF, record sends, notes/stars/post text | Edit a master, edit/archive a library slide, reassign `is_master`, rebuild indexes, change the tool |
| **Viewer** | The app (read-only); MCP reads | See everything, change own password | Any write |

The distinction is **not** two endpoints or two apps — it is the existing
role model doing its job. What changes in 2.0: the MCP tool set grows from
"read + record" to "**build**", and the app sheds every dead-end that used to
say "go run a CLI command" at an editor.

### 2.3 What an editor's deck-build looks like over MCP (the new core loop)

```
whoami → customers_list → deck_start(customer, from_master)
  → library_search / slide_read (browse)        ── the draft lives server-side,
  → deck_slides(add/remove/reorder)                shared with the app builder
  → deck_vars(title, footer, cover_meta, …)
  → deck_fill_slots(prepared_for, …)             ── the old Personalize, absorbed
  → deck_check          ── dry-run: the full gate, findings in plain words
  → deck_publish        ── the real five gates; returns "v1, 14 pages, PASS"
  → deck_pdf            ── signed URL, 10 minutes, for this caller
  → deck_record_sent    ── after they email it
```

The human approval that the old `/new-deck` skill enforced does not disappear:
it moves to where the human actually is. `deck_check` exists so the model
presents the plan and the verify result **in the conversation**, and
`deck_publish` requires `confirm: true` so a model cannot publish as a side
effect of browsing (§6.3).

### 2.4 Python that stays (owner utilities, final list)

| Tool | Why it stays | Cadence |
|---|---|---|
| `generate-image.py` | google-genai SDK; writes `brand/img/library.json` provenance | on demand, owner |
| `build-static-fonts.py` | fontTools + brotli instancing has no Node equivalent | rare |
| `build-brand-kit.py`, `build-library-kit.py` | fontTools glyph outlining (the no-font-dependency wordmark) | rare |
| `build-cover-hero.py` | Pillow scrim bake | rare |
| `build-qr.py` | segno vector QR | rare |
| `research-brain.py` | local knowledge folding; not pipeline | owner, after runs |

Everything else in `tools/` is **retired or ported** — the full fate table is
§5.6. Rule of thumb enforced by `docs.test.mjs`: nothing in the artifact
pipeline may be Python, and nothing an editor needs may require Python.

---

## 3. Phase 0 — Stop the bleeding (days; before any new account)

Every item: the change, the files, the test that proves it. Do these in order;
they are independent of the runtime migration and must not wait for it.

### 0.1 Adopt this map
1. Edit `.scratch/README.md`: move `deck-studio-4/` to **Delivered** (note:
   "superseded as the live map by `deck-studio-5/` — its mother/leaf model,
   `deck_sends`, name-scope guard and MCP server all carry forward; its Phase 2
   items (library migration, Python assembler retirement) are re-scoped by
   deck-studio-5"). Add `deck-studio-5/GUIDE.md` as **Live**.
2. Commit: `deck-studio-5 is the live map`.

### 0.2 Close the /repo disk traversal — CRITICAL
- **Change**: in `app/server.mjs` (~line 2319), apply one allowlist to **both**
  branches of `/repo/*` (disk and Storage). Allow `^(library|brand|templates|knowledge|types|social|research)/`;
  deny everything else, and deny any path segment starting with `.` outright.
  Same guard on `/deck-cache/*` for defense in depth.
- **Test** (`app/test/routes-repo.test.mjs`): `GET /repo/.env` → 404 even with a
  valid session; `GET /repo/.git/config` → 404; `GET /repo/brand/BRAND.md` → 200;
  traversal attempts (`/repo/../.env`, encoded variants) → 404.
- **Also**: rotate `SUPABASE_SECRET_KEY` in the Supabase dashboard after this
  ships (assume the old one leaked; it was readable by any member).

### 0.3 Derive clearance server-side — CRITICAL
- **Change**: `POST /api/build` (`server.mjs` ~1607) ignores any
  `allowed_entitlements` in the request body. Server derives it:
  - `version_of` set → inherit from the deck row (already immutable by design).
  - new deck with `customer` → `["public", clearanceForCustomer(customer)]`.
  - new deck without customer → `["public"]`.
  - an **owner** may pass `allowed_entitlements` explicitly (audited, with the
    values in the audit detail) — the one legitimate use is a multi-customer
    internal deck, and it is mother-adjacent.
- Same rule inside `buildFromRecipeJs` so the studio CLI can't bypass it either.
- **Test** (`app/test/build-clearance.test.mjs`): editor request carrying
  `allowed_entitlements:["holliday"]` → built deck has `["public"]` and verify
  FAILs the Holliday image; owner request with explicit clearance → honored +
  audit row contains it; version build → clearance identical to the deck row.

### 0.4 Capability-gate the writing GETs; wire the leaf guard into the PDF path
- **Change**: introduce a route table (this is also Phase 1 prep): every route
  declares `access: "read" | "leaf-write" | "mother"`. The three GETs that write
  (`/versions/:n/pdf` print-on-demand, `/versions/:n/thumb`, `/api/library/export`)
  become `leaf-write` for the *write half*: a viewer may download an existing
  PDF but a missing PDF is not printed for a viewer (message: "ask an editor to
  open this deck once"); `requireLeaf` runs before the on-demand build so an
  editor's download cannot regenerate a **master's** PDF of record.
- **Test** (`app/test/capabilities.test.mjs`): viewer GET on unprinted version →
  409 with the message, no job started; editor GET on a master's unprinted
  version → 403 `owner_only`; editor GET on own customer deck → job runs.

### 0.5 Harden htmlcheck values; verify on save
- **Change** in `app/lib/htmlcheck.mjs`: `src`/`href` values must match
  `^(assets/|data:|#|mailto:)` (plus `https://fonts.googleapis` never appears in
  snapshots — no external allowlist needed); reject `url(` inside `style`
  attribute values unless it references `assets/`. New codes `external-src`,
  `external-href`, `style-url`.
- **Change** in `POST /api/decks/:id/versions` (`server.mjs` ~1959): after
  `validateSave`, run `verifySnapshot` on the saved HTML (no PDF part) and store
  the report on the new version; a FAIL **blocks the save** with the same
  plain-language findings the build shows. (This also finally writes
  `verify_report` for editor-made versions.)
- **Test** (`app/test/htmlcheck.test.mjs`): matrix of allowed edits (text,
  style values, alt) and rejected ones (structure, class, data-*, external URL
  in src/href/style); (`app/test/save-verify.test.mjs`): a save introducing an
  em dash or a name-leak is refused with the finding.

### 0.6 page_format into the JS deck-meta — the gate isn't gating
- **Change**: `assemble.mjs` `buildSnapshot` writes `page_format` into the
  deck-meta block (from the recipe / artifact kind; default `deck-16x9` only
  for `kind=deck`). `verify.mjs` treats a **missing** `page_format` as a FAIL
  (`no-page-format`), never a silent default. Align the article constant:
  an article is `page_format: "none"` everywhere (fix the value in any legacy
  importer that still says `hero-1200x627`).
- **Backfill**: one-off script (studio CLI `fix-meta`) that rewrites the
  deck-meta of current versions whose page_format is absent/wrong — as **new
  versions** (immutable rule holds), change note `page_format backfill`.
- **Test** (`app/test/verify.test.mjs`): each `PAGE_FORMATS` entry gets a
  fixture; a 4:5 carousel is NOT footer-checked; an article is not page-count
  checked (`paged:false` — the 2026-08-19 flowing-document rule); missing
  page_format FAILs.

### 0.7 The six small confirmed bugs
1. `deckstudio.py:201` client-substring → token test. (Python retires in Phase 2
   but this ships now because it corrupts filenames today. Port the token test
   into `assemble.mjs pdfNameForSlug` at the same time + test with
   core=`wavin-rnd`, client=`wavin`.)
2. `POST /api/decks/:id/master` with empty `type` → refuse (400 "the deck needs
   a type before it can be a master").
3. Remove the unconditional `blank-page-skipped` WARN (emit only when a PDF was
   actually skipped).
4. Delete the `test` customer row (backend) — its `\btest\b` scope already
   failed nine articles once.
5. `check-drift.py --slide` filter — skip (the tool retires in Phase 2; note in
   the fate table).
6. Publish-article pointer-before-insert — fixed structurally by 1.2 (atomic
   publish); until then, swap the two calls so the insert happens first.
- **Tests**: pdfname token case; master-with-empty-type route test; verify
  fixture asserting no blank-page WARN on a clean deck.

### 0.8 MCP contract honesty (small, do now)
- Make `decks_for_customer` return the page count it promises (add
  `page_count` join) — or drop the promise from the description AND the
  Settings table (they must derive from one source by Phase 1.5 anyway).
- `verifyJwt`: require `exp` and `iss` (absent → reject).
- Wrap tool errors: raw PostgREST text is logged server-side; the model gets
  "the backend refused that — try again or check the value" plus the safe part.
- **Tests** (`app/test/mcpauth.test.mjs`): token without `exp` → 401; without
  `iss` → 401; alg `none` → 401. (`app/test/mcp-tools.test.mjs`): error text
  never contains `rest/v1` or a constraint name.

**Phase 0 acceptance**: all new tests green · `GET /repo/.env` 404 · an editor
cannot self-clear a build · a carousel fixture passes verify as a carousel ·
secret key rotated.

---

## 4. Phase 1 — Foundation (week 1–2)

### 1.1 The schema moves into the repo
1. Create `supabase/migrations/0001_baseline.sql`: the **complete current
   state** — all 15 tables, the five auth triggers (profile-on-signup,
   @oppr.ai domain check, invitation consumption, self-role-change block),
   `policy_audit()`, `rls_disabled_tables()`, every RLS policy, every index
   (including the `one_master_per_type` partial unique). Pull it with
   `supabase db dump` (or the Supabase MCP `list_tables`/`execute_sql`) and
   hand-verify against the audit's reconstructed schema.
2. From now on **every schema change is a migration file**, applied with
   `supabase migration up` / the Supabase MCP `apply_migration`. Hand edits in
   the dashboard are prohibited (write this into CLAUDE.md).
3. Add migration `0002_constraints.sql`:
   - `deck_sends (deck_id, version_n)` → real FK to `deck_versions (deck_id, n)`.
   - `decks.created_by_id`, `deck_versions.author_id` NOT NULL after backfill
     (map the text values: emails → profile ids; `cli`/`app`/`import-social`/
     `publish-article` → Floris's id with `detail` noting the origin). Keep the
     text columns until Phase 6 cleanup, stop writing them now.
   - `decks.type` CHECK against the six known types + `''` for social kinds
     (or a `deck_types` lookup table — implementer's choice, but the master
     index must not float on free text).
- **Test** (`app/test/schema.test.mjs`, integration-tagged): apply migrations
  onto a scratch Supabase branch (`create_branch`), run the ported access suite
  against it (§9.5), assert `policy_audit()` returns empty.

### 1.2 Atomic publish
1. Migration `0003_publish_rpc.sql`: a `publish_version(deck_id, html,
   change_note, author_id, pdf_object, recipe, verify_report, page_count)`
   Postgres function that inserts the version at `max(n)+1` **and** bumps
   `current_version_n` in one transaction, returning the new `n`. A companion
   `create_deck_with_v1(...)` does the row + v1 atomically and allocates the
   slug (`-2`, `-3` suffixing) inside the transaction.
2. `publish.mjs` calls the RPCs. Editor saves (`/versions`), restore, and
   personalize-successor all go through `publish_version`.
3. Delete the read-then-write slug loop in `server.mjs` ~2117.
- **Test** (`app/test/publish.test.mjs`): mocked-db unit for the JS wrapper;
  integration: two concurrent `publish_version` calls produce n and n+1, never
  a gap or duplicate; `create_deck_with_v1` slug race yields `-2` not a 409.

### 1.3 The test harness (this unblocks everything else)
1. `app/test/` with `node:test` (`node --test app/test/`). npm scripts:
   `test` (unit + gates), `test:integration` (needs Chrome + backend env),
   `check` (existing syntax checks + `test`).
2. **Fixture corpus** `app/test/fixtures/`: one small recipe + expected
   snapshot ("golden") per page_format — `deck-16x9` (3 slides incl. cover +
   footer slide), `linkedin-4x5`, `square-1x1`, `hero-1200x627`, plus one
   article document for `none`. Two poisoned fixtures: one with an em dash +
   name leak (verify must FAIL it), one with an uncleared image.
3. CI: `.github/workflows/ci.yml` — Node 20, `npm ci`, `npm test` on every
   push/PR. Integration job manual/nightly (needs secrets + Chrome).
4. Pre-push hook: `.githooks/pre-push` running `npm test`; enable with
   `git config core.hooksPath .githooks` (documented in CLAUDE.md setup).
- **Acceptance**: CI green on main; a deliberately broken fixture turns it red.

### 1.4 The shared handler layer
1. Create `app/lib/handlers/` — pure functions returning data, no `req`/`res`:
   `customers.mjs` (list, create-with-collision-guard, timeline, noteAppend),
   `decks.mjs` (list, get, search, status, recipe, patch),
   `versions.mjs` (read, save, restore, pdf, thumb),
   `sends.mjs` (record, list),
   `drafts.mjs` (get, put, delete — the new per-user drafts, §7.3),
   `build.mjs` (start, check, publish wrappers over jobs),
   `library.mjs` (chapters, slideRead, search, archive).
2. `server.mjs` routes become thin: parse → handler → JSON. MCP tools become
   thin: args → handler → prose. Every duplication in the audit's drift table
   (slugify, send truncation, staleness, collision copy, timeline join)
   disappears because there is one body.
3. One `app/lib/slug.mjs` (with `SLUG_RE`), imported everywhere.
4. Promote `selectAll` (paging) from `collide.mjs` into `supabase.mjs`; every
   list handler uses it — no more silent 1000-row truncation anywhere.
- **Test** (`app/test/handlers.test.mjs`): each handler against a mocked db;
  (`app/test/slug.test.mjs`): "Café" → `cafe`, "Rhyze -" → `rhyze`, browser and
  MCP produce identical slugs by importing the same function.

### 1.5 Tools and routes as data
1. `app/lib/routetable.mjs`: `[{method, pattern, access, handler, audit}]` —
   replaces the two if-ladders incrementally (new/changed routes first; the
   ladder shrinks as Phase 2–4 touch routes).
2. `app/lib/mcptools.mjs`: `[{name, title, description, inputSchema, access:
   "read"|"leaf-write", handler, audit, annotations:{readOnlyHint,…}}]`.
   The dispatcher enforces `access` (default-deny stays: anything not
   declared `read` is a write) and — when a tool receives a `deck`/`slug`
   argument — calls `requireLeaf` automatically. The claimed second layer
   becomes real, structurally.
3. `settings.js`'s "What Claude can do" table renders **from** `mcptools.mjs`
   metadata served at `GET /api/mcp-tools` — the hand-typed copy (and its
   page-count lie) is deleted.
4. MCP audit parity: tools emit the same audit actions as the browser
   (`customer.create`, `deck.sent`, …) with `via:"mcp"`, skip on failure.
- **Test** (`app/test/mcp-dispatch.test.mjs`): an undeclared tool name is
  refused as a write for editors; a leaf-write tool on a master deck id → the
  owner_only refusal; audit rows carry `via:"mcp"`.

**Phase 1 acceptance**: migrations reproduce the backend on a branch DB · CI
green · handlers carry the browser routes for customers/sends/decks · Settings
table derives from the tool table.

---

## 5. Phase 2 — One runtime (week 2–4)

The order matters: render first (it unblocks Macs), then verify (one gate),
then assemble/publish (the default flips), then the retirement commit.

### 2.1 Render: one implementation
1. `render.mjs` already handles Win/mac/Linux local + serverless Chromium. Add
   to it: `renderScreenshot(html, {width,height})` (replaces
   `build-social-image.ps1` + `System.Drawing` size check via image header
   probe) and `renderPageThumbs(html, n)` (screenshot each `<section>` —
   replaces `pdf-thumbs.py` for all pages, local and hosted the same way).
2. `tools/studio.mjs render --pdf|--png <dir>` shells into it for owner use.
3. Delete: `build-pdf.ps1`, `build-carousel.ps1`, `build-social-image.ps1`,
   `deck_pdf_name.py`, the browser probes in `build_slide_catalog.py` and
   `build-brand-kit.py` (they call `studio.mjs render` instead — the two kit
   builders keep their Python bodies but stop probing for browsers).
- **Test**: integration `render.test.mjs` — the 16:9 fixture prints to the
  right page size/count; the 4:5 fixture too; thumbs produce n PNGs.

### 2.2 Verify: one gate, all rule sets
1. Fold `verify-carousel.py`'s rules into `verify.mjs` as the `linkedin-4x5`
   rule block in `PAGE_FORMATS`: `.loop` line per content page, 25-word body
   ceiling, cover-logistics ban, alt-required, `public`-only entitlement,
   post-to-carousel word ratio (post text passed in when available), ≤5 MB PDF,
   customer-ID regexes.
2. Fold the article gate: `[n]`-marker/source resolution and uncited-source
   checks move into a `none`+`kind=article` rule block (the builder may still
   pre-check for fast feedback, but the gate owns the rule).
3. Mirror the 2026-08-19 `paged`/flowing distinction exactly as CLAUDE.md now
   states it (an article legitimately prints across sheets).
4. New vocabulary rule (from the engagement recipe's locked table): FAIL on
   `10-Week Proof` and `PoV` in visible deck text, same shape as the em-dash
   rule. (BRAND.md is reconciled in Phase 5 first so the source of truth
   agrees before the gate enforces it.)
5. `verifylib.py` is **frozen** (comment at top: "frozen 2026-XX-XX; the gate
   is app/lib/verify.mjs; this file is deleted with Phase 2.4") — no rule may
   be added to it.
- **Test**: `verify.test.mjs` grows per-rule cases per format, including the
  poisoned fixtures; a carousel fixture with a 26-word body FAILs; an article
  with an uncited source FAILs.

### 2.3 Assemble + publish: JS is the default, then the only
1. Local builds flip: `DECK_JS_BUILD` defaults **on** (the env var inverts to
   `DECK_PY_BUILD=1` as a temporary escape hatch).
2. Run both parity checks one final time against every published recipe —
   **record the green run** in `.scratch/deck-studio-5/tickets/parity-final.md`
   (date, counts, output tail). This is the parity apparatus's retirement
   ceremony: it proved the port; the port is now the reference.
3. `tools/studio.mjs` gains: `fetch <slug>` (replaces `fetch-deck.py`),
   `publish <dir>` (replaces `publish-deck.py` for the owner's rare hand-built
   case), `verify <dir|slug>`, `sync-library` (replaces `check-drift.py
   --sync` + `--apply-archives`), `publish-library` (catalog → design-system →
   mirror → assets in one command, replaces `publish-assets.py` + the index
   ps1 shims), `index` (replaces `build_app_index.py` — ported to Node so the
   hosted **Refresh library** works too), `users <list|add|password|role|…>`
   (replaces `manage-users.py`), `export`, `thumbs`, `fix-meta`, `drift`.
4. The article pipeline ports: `article.yaml` → `app/lib/article.mjs`
   (build: html/md/post/hero) + publish through the same `publish.mjs` path
   behind the same gate. `studio.mjs article <dir>` and — Phase 3 — the same
   handler serves the app and MCP. The carousel finally gets the same shape:
   `carousel.yaml` → `app/lib/carousel.mjs` (page model on `linkedin.css`) —
   this removes the last hand-authored artifact type.
5. `import-social.py`, `publish-social.py`, the `social_outputs` +
   `reference_files` tables and `social/_status.json` retire together: one
   migration folds any still-needed rows into `publish_log` (rename it
   `channel_posts` while at it: slug, channel, status, posted_date, url), the
   dual-write disk/Storage status file is deleted, and `build_app_index`'s
   social source reads `decks` only.
- **Test**: pipeline integration builds every fixture through jobs.mjs and
  matches the goldens; `studio.mjs publish` + `fetch` round-trip a fixture;
  the article fixture publishes two artifacts (doc + hero) with correct
  page_formats; `channel_posts` migration test.

### 2.4 The retirement commit
One commit, after 2.1–2.3 are green, deleting:
`deckstudio.py, assemble-deck.py, snapshot.py, snapshot_html.py,
build-from-recipe.py, publish-deck.py, fetch-deck.py, publish-social.py,
import-social.py, build-article.py, publish-article.py, build-article-hero.py,
verify-deck.py, verifylib.py, verify-carousel.py, check-verify-parity.py,
check-assemble-parity.py, check-drift.py, build-pdf.ps1, build-carousel.ps1,
build-social-image.ps1, deck_pdf_name.py, supa.py, manage-users.py,
publish-assets.py, build_app_index.py, pdf-thumbs.py, export-element.py,
build-asset-index.ps1, build-slide-catalog.ps1, build-design-system.ps1`
(the last three py index builders port into `studio.mjs`/`app/lib` as part of
2.3.3 — `build_asset_index.py`, `build_slide_catalog.py`,
`build_design_system.py` go with them), plus `check-docs.py` and
`check-access.py` once their Node ports (§9.4–9.5) are green, and
`check-story.py` (ported to `app/lib/story.mjs`, still advisory, still exit 0,
now callable from the app as a "story check" button on a deck).

`requirements.txt` shrinks to the owner-utility set (google-genai, fontTools,
brotli, Pillow, segno, PyYAML for research-brain).

### 2.5 Docs follow the code
- CLAUDE.md: rewrite "Build & verify", the tools list, the setup section
  (Python becomes optional, "owner utilities only"), the CLI/app boundary
  table ("The CLI creates" column shrinks to: new library slide/design block,
  image generation, ingest, research — all owner work).
- `/edit-canonical` and `/ingest-dump` rewritten: every command they name is a
  `studio.mjs` or npm command; the dead paths (`decks/canonical/`,
  `decks/variants/`, root `SPEC.md`) are corrected.
- The ported docs gate (§9.4) now scans `.claude/commands/` too, so this can't
  drift again.

### 2.6 Fate table for every tool (the checklist to work through)

| tools/ file | Fate | Replaced by |
|---|---|---|
| deckstudio.py, snapshot.py, snapshot_html.py, assemble-deck.py | **delete** | assemble.mjs |
| verifylib.py, verify-deck.py, verify-carousel.py | **delete** | verify.mjs (+ rule sets) |
| build-from-recipe.py | **delete** | jobs.mjs |
| publish-deck.py, fetch-deck.py | **delete** | publish.mjs + studio fetch/publish |
| publish-social.py, import-social.py | **delete** | one artifact publisher; legacy tables retired |
| build-article.py, publish-article.py, build-article-hero.py | **port** | app/lib/article.mjs |
| *(new)* | **create** | app/lib/carousel.mjs (carousel.yaml) |
| build-pdf/carousel/social-image .ps1, deck_pdf_name.py | **delete** | render.mjs + studio render |
| pdf-thumbs.py | **delete** | render.mjs renderPageThumbs |
| check-verify-parity.py, check-assemble-parity.py | **delete** after final green run | the test suite |
| check-drift.py | **port** | studio sync-library + drift handler (fixes the --slide bug by rewrite) |
| build_app_index.py (+3 index builders + 3 ps1 shims) | **port** | studio index / app/lib/index.mjs (hosted Refresh works) |
| publish-assets.py | **port** | studio publish-library (one command, with --check) |
| export-element.py | **port** | app/lib/export.mjs (server route already exists) |
| supa.py | **delete** | supabase.mjs |
| manage-users.py | **port** | studio users |
| check-docs.py | **port** | app/test/docs.test.mjs (§9.4) |
| check-access.py | **port** | app/test/access.test.mjs (§9.5) |
| check-story.py | **port** | app/lib/story.mjs (advisory, unchanged contract) |
| check-kit.py | **port** | app/test/kits.test.mjs |
| research-brain.py, generate-image.py, build-static-fonts.py, build-qr.py, build-cover-hero.py, build-brand-kit.py, build-library-kit.py | **keep (Python, owner)** | — |

**Phase 2 acceptance**: a Mac with only Node + Chrome builds, verifies and
publishes every fixture · `rg -l "import fitz|powershell" tools app` finds only
kept owner utilities · parity final-run recorded · CLAUDE.md + commands updated
and the docs gate is green · the app's local build no longer spawns Python.

---

## 6. Phase 3 — MCP becomes the deck builder; the skills retire (week 4–6)

### 3.1 The draft model (shared by app and MCP — this is the unification)
Migration `0004_deck_drafts.sql`:
```
deck_drafts(id uuid pk, deck_id uuid null → decks, user_id uuid → profiles,
            title text, customer_id uuid null, type text,
            recipe jsonb, vars jsonb, slots jsonb,
            created_at, updated_at)
unique (deck_id, user_id)          -- one draft per person per deck
```
- Replaces `decks.draft_recipe` (migrate existing values to a row owned by
  `draft_updated_by`) **and** the browser's localStorage drafts (`oppr.builder.
  drafts.v3` importer on first app load, then the key is retired).
- A draft with `deck_id null` is a not-yet-published new deck — now visible on
  every device and to the MCP.
- "Unpublished changes" on a deck row = *someone* has a draft; the row names
  who.

### 3.2 The MCP tool set (final — 20 tools)
All declared in `mcptools.mjs` (§1.5), all calling the shared handlers.

**Reads** (viewer+): `whoami` · `customers_list` · `decks_for_customer` ·
`customer_timeline` · `company_decks_list` · `decks_search` (title/note/slug/
type/customer, the search the app also gains) · `deck_read` · `deck_status`
(verify result, drift count, pdf state, current vs sent versions — the
"is this safe to send" tool) · `library_search` · `slide_read` (one slide's
text + goal + why + companions) · `draft_read`.

**Writes** (editor+): `customer_create` (+ owner `force`) · `customer_note`
(append to notes) · `deck_start` · `deck_slides` · `deck_vars` ·
`deck_fill_slots` · `deck_check` · `deck_publish` · `deck_pdf` ·
`deck_record_sent`.

Tool specs for the new build loop:

| Tool | Params | Behavior |
|---|---|---|
| `deck_start` | `customer` (slug), `title?`, `from?` (deck slug; default: the type's master; `"empty"` allowed), `type?` (default `customer`) | Creates a `deck_drafts` row for the caller. Copying a recipe drops slides the derived clearance doesn't cover (reports how many, and which), rewrites footer/cover meta to the new title. Returns the draft id + a chapter-grouped slide listing. Clearance is **derived** (0.3), never a parameter. |
| `deck_slides` | `draft`, `add?[]`, `remove?[]`, `order?[]` | Mutates the pick list; refuses non-pickable slides (retired/archived/uncleared) **with the reason**; returns the new state grouped by chapter. |
| `deck_vars` | `draft`, `title?`, `deck_footer?`, `cover_meta?`, `prepared_for?`, plus recipe vars | Fills deck variables. Returns the still-unfilled required list. |
| `deck_fill_slots` | `draft`, `{slot: text}` | The absorbed Personalize: values for `data-slot` spans (client, prepared-for). Em dashes auto-corrected to en dashes with a note, matching the editor. |
| `deck_check` | `draft` | Runs the full pipeline as a dry run. Returns the plan (slides in order, vars) + verify findings in the plain language of `js/verify.js`. **The model is instructed (in the tool description and INSTRUCTIONS) to show this to the human and get an explicit yes before publishing.** |
| `deck_publish` | `draft`, `change_note`, `confirm: true` required | New deck → v1 (via `create_deck_with_v1`); draft on an existing deck → v(n+1). Master + non-owner → refused by the dispatcher's `requireLeaf`. Deletes the draft on success. Returns slug, version, page count. |
| `deck_pdf` | `slug`, `version?` | Ensures the PDF exists (prints on demand behind the same verify gate — a FAIL returns the findings, not a file), then returns a **signed URL, 10-minute expiry** from the private bucket, plus the filename. See O-1. |

### 3.3 Approval, exactly once
The old skills' hard approval gate is preserved as a **protocol**, not a hope:
`deck_publish` without `confirm:true` returns the `deck_check` summary and the
sentence "show this plan to the user; call again with confirm:true after they
approve." The audit row for `deck.publish` records `via:"mcp"` and the change
note. (A model *can* still lie to its user — the same was true of the skill;
the human-visible plan plus the audit trail is the same guarantee level as
today's, now enforced server-side instead of by markdown.)

### 3.4 Remove the deck-building skills
1. Delete `.claude/commands/deckbuilder.md` and `.claude/commands/new-deck.md`.
2. `/ingest-dump`: **kept** (owner intake), updated: its "create a customers/
   folder" step is replaced by "register via the app/MCP"; its image-filing and
   library-promotion steps now end with `studio.mjs publish-library`.
3. `/edit-canonical`: **kept** (mother work), rewritten for the JS runtime
   (assemble/verify/publish via `studio.mjs`), and it gains the approval gate
   it never had (one confirmation step before publish — it was the only
   command without one).
4. Social building: Route B's job moves to `article.yaml`/`carousel.yaml` +
   `studio.mjs` for the owner, and to the app's social drafts for promotion.
   The knowledge files (`social/CLAUDE.md`, best-practices) update their
   command references.
5. The app's `needsCli` prompts that referenced `/deckbuilder` / `/new-deck`
   are re-pointed: editors are pointed at the builder or MCP; owners at
   `studio.mjs` commands. No screen an editor can reach may name a CLI.

### 3.5 Connect page tells the two-mode story
Settings → Connect Claude gains a short "who does what" block: *editors
connect this MCP and can build and send decks; changing what decks are made
of (the library, the masters) is owner work and does not exist here.* The
tool table derives from `mcptools.mjs` (§1.5) and now shows the build loop.
The discovery probe also checks the Supabase OAuth AS metadata so the green
light means "connectable", not "metadata file exists".

- **Tests** (`app/test/mcp-build.test.mjs`): full loop against mocked handlers
  — start-from-master drops uncleared slides and says which; publish without
  confirm returns the plan and does not publish; publish on a master as editor
  → owner_only; `deck_pdf` on a FAILing deck returns findings, not a URL;
  signed URL expires (integration). Protocol tests extend for the new tools'
  annotations (`readOnlyHint` on all reads).

**Phase 3 acceptance**: a colleague with **only a phone** can: register a
customer, start from the customer master, adjust slides, fill variables,
check, publish v1, get the PDF, record the send — proven by the E2E script
E-7 (§9.6) · the two skill files are gone and the docs gate passes · Settings
derives from the tool table.

---

## 7. Phase 4 — The simplified builder & app coherence (week 5–7)

### 4.1 One way to make a customer deck
1. **Personalize merges into Start-from-master.** The New-deck dialog's
   "Start from" already copies recipes; it gains a **slot-fill step** (the
   fields Personalize used to extract) so the output is a normal recipe deck —
   openable in the builder forever after. The Personalize modal and
   `POST /api/decks/:id/personalize` are deleted; masters' "Personalize"
   button becomes "New deck from this" (same door as the customer page).
2. Decks with no recipe (old personalize output) keep working read-only; a
   banner offers "rebuild as a recipe deck" (start-from copies the master
   recipe and carries the deck's slot values over).
- **Test**: builder-new flow test — start from master with a customer →
  clearance derived, uncleared slides dropped and toasted, slot values land as
  `deck_fill_slots` does over MCP (same handler).

### 4.2 The editor's builder, simplified (D2 verbatim)
- The vars panel (Title, Footer, Cover meta, Prepared-for + recipe vars) moves
  **out of the collapsed `<details>`** into a visible right-rail card — these
  are the fields an editor exists to fill; hiding mandatory fields behind a
  disclosure caused the "publish refused, look under Deck details" loop.
- The rail gets a **search box** (filters slides across chapters by id, title,
  goal) and shows `why` under each slide (mirrored in Phase 5).
- Blocked slides keep the greyed-with-reason pattern (keep verbatim).
- Server drafts (§3.1) replace localStorage: autosave failures now **surface**
  (toast + a "not saved" pill), a `beforeunload` guard when dirty, and the
  editor overlay gets the same guard.
- Optimistic concurrency: `PUT` on drafts and `POST /versions` carry
  `base_version_n` / `base_updated_at`; a mismatch is a 409 with "N published
  v4 while you edited — reload to continue from it" (no silent clobber).
- **Tests**: draft round-trip incl. conflict 409; a simulated failed save
  shows the pill (component-level DOM test where practical, otherwise E2E).

### 4.3 PDF-first sending (D3)
- **Record sent moves onto the deck page** next to Download PDF (the prompt()
  becomes a small form: recipient, date, note). The customer page keeps its
  timeline.
- After a successful download, an inline nudge: "Sent it? Record who has v3."
- MCP `deck_record_sent` and the form share the sends handler.
- **Test**: sends handler cases (bounds, truncation — now in one place).

### 4.4 Coherence sweep (from the audit's 63, the ones that block colleagues)
1. One `artifactRow` used by Decks, the builder chooser (which gets the area
   chrome), and the customer page (with per-context action slots).
2. One modal shell, one button system (`.primary`/`.ghost` win; the builder's
   `.btn` aliases are replaced), Escape closes every modal, focus is trapped.
3. Global search becomes real: decks + customers + slides, grouped results
   (the handler behind `decks_search` serves it).
4. Customers grid: search + sort.
5. Delete dead weight: compose/tray subsystem, `#/draft` route, carousel
   composer exports, the slide Version-history panel (until slide history has
   a backend), unused api.js methods, `.badge.mutares-family` CSS.
6. The clearance filter in the Library derives from customers + builtins (the
   hardcoded 11-item list goes).
7. Vocabulary: one glossary module — hover/tap definitions for clearance,
   master, recipe, behind, version; empty states rewritten (no "decks are
   created in the CLI"); the offline panel splits by role (editor sees "tell
   an owner", owner sees the env hint).
8. "n pages behind" gets its verb: a **"Review update"** door on the deck page
   (the flag-and-accept flow deck-studio-3 specified; accepting = a new
   version through the normal pipeline).
9. Sticky-bar stack fixed with the measured `--topbar-h` applied to all three
   layers; the toast gains `aria-live="polite"` and a z-index above modals.
- **Tests**: route smoke tests for every hash route (render without throwing,
  incl. redirects); docs gate asserts no user-facing string contains
  `/deckbuilder` or `/new-deck`.

**Phase 4 acceptance**: E2E scripts E-1..E-6 pass as written · a new editor
completes "customer → deck → PDF → record sent" with **zero** CLI mentions on
screen · no localStorage draft key is written anymore.

---

## 8. Phase 5 — Content hygiene & the library loop (week 6–8)

1. **Recipes**: delete the stale skeleton tables from product-showcase,
   management-outlook, engagement; add `picks:` to teaser and customer;
   mark investor's missing slides as `aspirational:` or build them (owner
   call); the docs gate resolves every slide id named in any recipe.
2. **BRAND.md** reconciles with the engagement locked vocabulary (drop
   "10-Week Proof", "≥85% adoption"); the vocabulary FAIL rule (§2.2.4) turns
   on after this lands.
3. **back-cover** becomes variable-driven: `{{contact_name}}`,
   `{{contact_email}}`, `{{contact_phone}}`, `{{contact_linkedin}}` +
   `{{qr:linkedin-fwyers}}` (a QR token on the icon-token pattern, reading
   `brand/qr/*.svg`); master defaults = Floris; a customer deck's builder vars
   panel exposes them. "Confidential" leaves the legal line (the engagement
   recipe rule wins).
4. **Icon and style discipline become checks**: docs gate FAILs an inline
   `<svg>` or `style=` in `library/slides/*/slide.html` outside an allowlist;
   the 13 inline-SVG slides convert to `{{icon:}}`; the inline styles graduate
   into `showcase.css` classes.
5. **The mirror carries meaning**: `sync-library` mirrors `why` and `with`;
   the builder and `slide_read` show them; `never_with:` (the engagement
   overlap rule as data) added to meta.yaml and surfaced as a picker warning.
6. **One library command**: `studio.mjs publish-library` = thumbs + catalog +
   design-system + kits-check + sync + asset mirror, with `--check` for CI;
   `/edit-canonical` ends with exactly this one command.
7. Catalog + Library browse re-group by **chapter** (the superseded
   role/section spine goes); retired slides render in a labelled tail.
8. Classify the one `unclassified` image (`logs-desktop-floorplan-assets.png`)
   — Floris decides the entitlement; the manifest schema then rejects values
   outside the enum.

**Phase 5 acceptance**: docs gate green with the new rules on · a fresh-clone
reader following any recipe reaches only live slides · `publish-library
--check` green means hosted == repo.

---

## 9. The complete test plan

### 9.1 Layout & commands
```
app/test/
  unit/        htmlcheck, verify, assemble, publish, guard, slug, namescope,
               handlers, mcpauth, mcp-dispatch, mcp-tools, mcp-build,
               pdfname, routes-repo, capabilities, build-clearance,
               save-verify, schema-shape
  fixtures/    recipes/*.json · golden/*.html · poisoned/* · article/ · carousel/
  integration/ pipeline, render, publish-rpc, signed-url, access, schema
  gates/       docs.test.mjs · kits.test.mjs
npm test                 → unit + gates (offline, no secrets, no Chrome)
npm run test:integration → needs Chrome + SUPABASE_* (branch DB)
```

### 9.2 Unit coverage (the minimum bar, per module)
- **htmlcheck**: the allowed/rejected matrix (12 cases) + the new URL rules +
  the entity/fingerprint invariants ("same doc reformatted → same fingerprint").
- **verify**: ≥3 cases per rule per applicable format; missing page_format;
  the paged/flowing article rule; vocabulary rule on/off.
- **assemble**: chapter seeding vs explicit order; unfilled → throw; unknown
  icon → throw; missing meta.yaml → throw; sentinel slotting; deck-meta
  includes page_format; `pyJson` byte-shape (kept as a regression test even
  after Python retires — the published corpus is in that shape).
- **publish**: v1-refuses-existing-slug; per-deck sha dedup; master clear
  scoped to non-empty type.
- **guard/dispatch**: fail-closed on db error; MASTER_STRUCTURAL_FIELDS;
  default-deny for undeclared tools; auto-requireLeaf on deck args.
- **mcpauth**: alg whitelist; exp/iss required; audience substitute rule;
  challenge shape.
- **mcp protocol**: version negotiation incl. unknown; batch → refused;
  notification → 202; initialize/ping pre-auth; annotations present.
- **namescope/slug**: builtin collapse (HoSt), tuned patterns, escape parity
  cases, the "Café"/"Rhyze -" slugs.
- **handlers**: each pure handler against a mocked db, including paging past
  1000 rows (selectAll) and the collision guard refusal shape.

### 9.3 Integration (branch DB + Chrome)
- **pipeline**: every fixture recipe → build → golden snapshot match → verify
  report snapshot → publish → fetch back → byte-equal.
- **publish RPC**: concurrency (two parallel publishes), pointer-never-orphans
  (kill between steps is impossible by construction — assert single statement).
- **render**: page sizes per format; thumbs count.
- **signed-url**: `deck_pdf` URL downloads once, 404s after expiry.
- **schema**: migrations apply clean on a fresh branch; `policy_audit()` empty;
  planted bad policy turns the suite red (the regression the repo already
  learned).

### 9.4 The docs gate (`gates/docs.test.mjs`, port of check-docs + new rules)
Everything the Python checker did, plus: scans `.claude/commands/*.md`;
resolves `-Deck`-style path arguments; resolves every slide id named in
`types/*/recipe.md`; FAILs inline `<svg>`/`style=` in library slides (allowlist
file); FAILs "10-Week Proof" outside Learnings; FAILs any user-facing app
string naming a deleted command; chapter exclusivity as before.

### 9.5 The access gate (`integration/access.test.mjs`, port of check-access)
All 22 existing checks (anon reads nothing, invitation dance, storage privacy,
secret-not-in-browser, policy_audit, rls_disabled_tables) **plus**: the three
missing tables (`deck_sends`, `library_slides`, `library_chapters`) in the
anon-read list; audit_log append-only **measured** (attempt UPDATE/DELETE as
authenticated → refused); `/repo/.env` and dotfile denial; viewer-cannot-
trigger-print; editor-cannot-self-clear; MCP write-tool refusal for viewers.
The suite keeps the house rule: a check that cannot read its answer FAILs.

### 9.6 E2E acceptance scripts (manual, one page each in `tickets/e2e/`)
- **E-1 Sign-in & roles**: viewer sees no write affordances; disabled account
  message; password change.
- **E-2 Register customer**: normal, colliding name (refusal lists decks),
  owner force (audit shows evidence).
- **E-3 First customer deck via app**: customer page → New deck → master copy
  → drop-uncleared toast → vars → check → publish v1 → deck files under
  customer.
- **E-4 Edit both doors**: slides (v2 via pipeline) and text (save blocked on
  structure, verify-on-save blocks an em dash); conflict 409 with two windows.
- **E-5 PDF & send**: download = version on screen; FAIL blocks with findings
  + explicit UNVERIFIED path; record sent from the deck page; timeline shows
  staleness.
- **E-6 Social**: article.yaml → build → publish (two artifacts) → post text →
  posted ✓; carousel.yaml the same way.
- **E-7 The phone test (the 2.0 headline)**: on a phone, in Claude, an editor
  runs the full §2.3 loop through MCP — no laptop, no Claude Code, no CLI.
- **E-8 Owner mother work**: /edit-canonical on the JS runtime — change a
  slide, `publish-library`, drift flags appear on affected decks, "Review
  update" produces new versions; editor attempting the same is refused
  everywhere (app, MCP, API).

### 9.7 Wiring
- CI on every push: unit + gates. Nightly/manual: integration on a branch DB.
- Pre-push hook mirrors CI's fast lane.
- A phase is **done** when its named tests exist, pass, and a deliberate
  sabotage of each (break the fixture, plant the policy) turns them red.

---

## 10. Cutover, definition of done, deferred

### 10.1 Cutover order (compressed)
0. Phase 0 ships immediately (security). Key rotation after 0.2.
1. Phase 1 foundation → CI green is the new baseline.
2. Phase 2 flips the runtime; retirement commit lands only after the final
   parity green run is recorded.
3. Phase 3 ships the MCP build loop; the two skill files are deleted in the
   same commit that ships `deck_publish` (never a gap where neither exists).
4. Phase 4–5 land as sprints; each ends with its E2E scripts run and checked
   off.
5. Final: CLAUDE.md full pass (setup, layers, rules, structure sections),
   `.scratch/README.md` marks this map delivered, `check`/CI/docs gates green.

### 10.2 Definition of done for Deck Manager 2.0
- [ ] One runtime: no Python/PowerShell in any artifact pipeline path; a Mac
      builds everything.
- [ ] One gate: every artifact kind verified by `verify.mjs` rule sets;
      verify-on-save active; page_format always explicit.
- [ ] One publisher, atomic: all versions minted by the RPC; legacy social
      stores gone.
- [ ] One draft model: server-side, per-user, shared by app + MCP; no
      localStorage drafts; conflicts surface as 409s.
- [ ] One customer-deck path: start-from-master with slots; Personalize gone;
      every deck has a recipe.
- [ ] Editors need nothing but a browser or a Claude connector: E-3 and E-7
      pass; no editor-reachable screen names a CLI.
- [ ] Owner work stays owner work: E-8 passes; mother verbs have no MCP tool;
      guard enforced in the dispatcher.
- [ ] Schema in the repo; `policy_audit()` empty; access gate green incl. the
      new checks; secret key rotated.
- [ ] Test suite ≥ the coverage named in §9; CI green on main.
- [ ] Docs true: docs gate green with all new rules; recipes name only live
      slides; BRAND.md and the locked vocabulary agree; back-cover is
      variable-driven.

### 10.3 Explicitly deferred (out of 2.0, revisit in 2.1)
- Share links / tokenized read access (D3) — and with it open-tracking.
- `slide_versions` / library-in-Supabase (deck-studio-4 decision 1 Phase 2) —
  the improved mirror (`why`/`with`, one sync command with `--check`) carries
  2.0; the library stays git-owned, owner-edited.
- Read-scope entitlement (who may *open* an artifact).
- Comments on artifacts; presence indicators beyond the 409s.
- A mobile-optimized app UI (the phone story is MCP, by design).
- X/other channels (the kind+page_format pattern is ready when wanted).

### 10.4 Open decisions for Floris (small, blocking only their own step)
- **O-1** `deck_pdf` signed URL (10-min, authenticated caller): approve?
  The alternative is "open the app to download", which breaks the phone loop.
  Recommendation: **yes** — it is a download, not a share link; expiry and
  audit (`deck.pdf via:mcp`) keep it inside D3's spirit.
- **O-2** `investor` recipe: build the 7 missing slides or mark aspirational?
- **O-3** The `unclassified` image's entitlement (Phase 5.8).
- **O-4** `decks.type` as CHECK vs lookup table (1.1.3) — implementer may
  choose; both satisfy the invariant.

---

*Compiled 2026-08-19 from the Deck Studio Atlas audit. File:line references in
the audit resolve against commit `e87100a` plus the uncommitted article-verify
work; this guide references files by role, not line, because Phase 2 moves
most of them.*
