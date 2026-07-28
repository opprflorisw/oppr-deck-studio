# Hybrid Deck Studio — report & implementation plan

**Version:** v3 2026-07-27. Supersedes `REPORT.md` (v2.1, now merged into Part I).
**Owner:** Floris Wyers (floris@oppr.ai). **Repo:** `deck_manager`.
**Audience of this document:** the AI/engineer building it. Part I is the decided
design (do not re-litigate). Part II is the implementation spec (follow it).

---
---

# PART I — THE DESIGN (decided, locked)

**The model in one line:** a deck is **born** composed (CLI: recipe + library +
verify), then **lives** as a self-contained HTML document in the backend —
edited in the app, versioned per save, printed to PDF on demand. Git versions
the tool; Supabase versions the presentations.

## 1. Decisions locked (all 2026-07-27, by Floris)

| # | Decision | Choice |
|---|---|---|
| D1 | Backend | Full Supabase (Postgres + Storage + Auth), local front end |
| D2 | Deck home | The published HTML snapshot in the backend **is** the deck. Recipes/library are birthing machinery, not the deck's ongoing home |
| D3 | Versioning | Backend versions decks: one immutable version row per save; a "current" pointer moves. Git covers only the tool (app, tools, templates, library, brand, knowledge, types) |
| D4 | Editability | Always editable. The old "variants are frozen" rule is retired — superseded by immutable versions |
| D5 | Edit scope v1 | Text edits + whitelisted layout nudges + entitlement-filtered image swaps, on the **final DOM**. Structural changes go to the CLI |
| D6 | Build approach | One continuous build, not phased |
| D7 | Access | All tool users see everything. No per-content ACLs now; storage is authenticated-read. Schema leaves room for roles later |
| D8 | Auth purpose | Attribution, not permissions. Later: per-user login; every version records its author; filter by author. Nothing auth-blocking is built now, but author columns exist from day one |
| D9 | Masters | `decks/canonical/` retires. A master is a regular backend deck with a `master` tag (a button in the app). The CLI resolves "the <type> presentation" via the tag. Version history replaces `canonical/<type>@vN` git tags |
| D10 | Master exclusivity | **One master per type.** Tagging another deck moves the tag; the previous master keeps its history |
| D11 | Quick personalize | **In-app.** "Personalize → customer" on a master clones the current version, fills the slots, files it under the customer. No CLI for the simple case |
| D12 | Personalization slots | Masters mark customer-variable spots with `data-slot` attributes (`client`, `prepared-for`, `cover-meta`, `footer-meta`, `client-logo`) — the successor of `{{variables}}`, surviving assembly as data attributes. Personalize is a guided form-fill |
| D13 | Audiences | Free-form allowed: a derived deck targets a customer record, a person, or an event label. One-offs live under Output → Company decks; no pseudo-customers |
| D14 | Lineage | Every derived deck records which deck + version it came from |

Build-time choices (recommended in review, adopted for this build):
- **Proxy-only**: the browser talks ONLY to the local agent; the agent holds the
  Supabase service key and proxies. No supabase-js in the front end (stays
  zero-dependency).
- **Social outputs stay file-based** for now (same model later, separate effort).
- **Auth deferred**: `author`/`created_by` columns default to `'floris'`;
  Supabase Auth wiring is a later effort.

## 2. The deck family model

```
                 tag: MASTER (one per type, movable)
                 ┌──────────────────────────────┐
   library/      │  Company presentation        │  versions v1…vN
   recipes  ───▶ │  (general, slots marked)     │  author per version
   (CLI birth)   └──────────┬───────────────────┘
                            │ derive (lineage: deck id + version n)
        ┌───────────────────┼──────────────────────┐
        ▼                   ▼                      ▼
  Mutares version     Holliday version      Career-fair keynote
  (app: quick         (app: quick           (CLI: tailored build —
   personalize,        personalize)          new story, new slides,
   then fine-tune)                           master as content source)
```

- Improving a master never touches derived decks. The master's page shows its
  family and which master version each derived deck came from;
  "re-personalize from current" creates a fresh derived deck.
- **Harvest** (edits flowing upstream): apply a keeper improvement from a
  derived deck to the master — in-app for text/nudges, CLI for structural.
- Recipes (`types/<type>/recipe.md`) remain the brief per type, used by the
  CLI at tailored builds; the master is the living embodiment.

## 3. Lifecycle

1. **Birth (CLI, ~95% of authoring).** `/new-deck` / `/deckbuilder` unchanged:
   intake, recipe, approval gate, library slides, entitlement clearance,
   assemble, verify, visual pass. New final step: **publish** to the backend
   as a self-contained snapshot (Part II §4).
2. **Life (app).** Lists from the backend; viewer renders the snapshot; edit
   mode on the final DOM; every save = a new version with author + note.
3. **Regenerate PDF.** The agent prints with headless Chrome and runs the same
   verify gate as the CLI. PASS → PDF + thumbnails attach to the version.
   FAIL → PDF withheld, per-slide report, deck flagged **needs CLI** with a
   generated `/deckbuilder` prompt.
4. **Reproduction (CLI).** "Based on <deck>, build X for Y": the CLI fetches
   the current version's HTML (contains every app-side fine-tune), composes
   fresh from library + recipe, publishes with lineage.

## 4. Architecture

```
┌─────────────────────────────┐          ┌────────────────────────────────┐
│ Front end (local browser)   │localhost │ Supabase                       │
│ app/web — viewer + editor   │────┐     │  Postgres: decks, versions,    │
└─────────────────────────────┘    │     │   assets, customers,           │
                                   ▼     │   build_jobs, publish_log      │
                     ┌──────────────────┐│  Storage (authenticated-read): │
                     │ Local Agent      ││   deck asset bundles, PDFs,    │
                     │ (app/server.mjs+)│┼▶  thumbnails                   │
                     │ · Supabase proxy ││  Auth: later (attribution)     │
                     │ · print + verify │└────────────────────────────────┘
                     │ · CLI bridge     │
                     └──────────────────┘
   repo (git) = the TOOL: app, tools, templates, library, brand, knowledge, types
```

**Guardrails that survive:**
1. Birth quality is CLI quality (recipes, design-system rule, approval gate).
2. Verify gates every PDF, app or CLI, same code.
3. Editor verbs are bounded; the server re-validates every save
   (structure-preserving diff only).
4. Snapshots are pinned: inlined CSS + bundled assets; nothing outside a
   version can change how it renders.
5. Brand/library remain git-versioned and CLI-owned; the app never writes them.
6. **Entitlement is an output rule, not a viewing rule**: verify still blocks
   customer-A material in customer-B decks and in public output. Tool users
   seeing everything is orthogonal.

---
---

# PART II — IMPLEMENTATION SPEC

## §0. Ground rules for the builder

- **Zero new npm dependencies.** The agent stays Node built-ins only (Node 18+:
  `fetch` is available). The front end stays vanilla ES modules, no build step.
- **Python**: you may add `requests` to `requirements.txt`. Everything else
  stays (PyYAML, pypdf, PyMuPDF, Pillow).
- **Never touch**: `library/` fragments' content, `brand/` content,
  `templates/*.css` content (you READ all of these), `.env` (create from
  `.env.example` guidance only). Do not commit secrets — keys go in `.env`
  (gitignored) only.
- **Do not delete** `decks/` from the repo in this build. After migration it is
  legacy/read-only; deletion is a later, human decision.
- **Windows** is the target platform (PowerShell available, paths may contain
  backslashes — normalize to `/` in all URLs and stored paths).
- **Brand rules apply to anything you generate** (UI copy, prompts, docs): no
  em dashes; short declarative tone; European number formatting.
- Work through the sections in order §1 → §9; each leaves the system working.
  Verify with the acceptance checklist (§10) at the end.
- When something in this spec conflicts with reality (a file moved, an API
  changed), prefer the spec's *intent*, note the deviation in the final report.

## §1. Environment & Supabase setup

### 1.1 `.env` / `.env.example`
Append to `.env.example` (names only) and expect in `.env`:
```
SUPABASE_URL=            # https://<project>.supabase.co
SUPABASE_SERVICE_KEY=    # service_role key — agent + python tools only
SUPABASE_ANON_KEY=       # not used yet; reserved for future direct auth
```
The agent and Python tools load `.env` themselves (tiny parser: split on first
`=`, ignore blank/`#` lines). Fail with a clear message if URL or service key
is missing when a backend feature is used.

### 1.2 Database schema
Create as one SQL migration (run via Supabase MCP `apply_migration` or the SQL
editor). Use exactly these names:

```sql
create table customers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_object text,               -- storage path or null
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table decks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,      -- e.g. 2026-07-22_teaser-demo, company-presentation
  title text not null,
  type text not null,             -- presentation type (matches types/<type>/)
  is_master boolean not null default false,
  audience_kind text not null default 'general'
    check (audience_kind in ('general','customer','person','event')),
  customer_id uuid references customers(id),
  audience_label text not null default '',   -- e.g. "Career fair keynote"
  client_slug text not null default '',      -- kept for PDF naming + verify
  allowed_entitlements text[] not null default '{public}',
  status text not null default 'ok' check (status in ('ok','needs_cli')),
  needs_cli_reason text not null default '',
  current_version_n int not null default 0,
  derived_from_deck_id uuid references decks(id),
  derived_from_version_n int,
  created_by text not null default 'floris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_master_per_type on decks(type) where is_master;

create table deck_versions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  n int not null,
  html text not null,             -- the full snapshot document
  change_note text not null default '',
  author text not null default 'floris',
  verify_report jsonb,            -- {fails:[...], warns:[...]} or null
  pdf_object text,                -- storage path of the PASS pdf, or null
  created_at timestamptz not null default now(),
  unique (deck_id, n)
);

create table deck_assets (
  deck_id uuid not null references decks(id) on delete cascade,
  filename text not null,         -- as referenced in html: assets/<filename>
  storage_object text not null,   -- decks/<deck_id>/assets/<filename>
  entitlement text not null default 'public',
  sha256 text,
  primary key (deck_id, filename)
);

create table build_jobs (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  version_n int not null,
  state text not null check (state in ('running','pass','fail','error')),
  verify_report jsonb,
  pdf_object text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table publish_log (       -- migrates social/_status.json 1:1
  slug text primary key,
  status text not null default 'draft' check (status in ('draft','posted')),
  posted_date text not null default '',
  url text not null default '',
  archived boolean not null default false,
  updated_at timestamptz not null default now()
);
```

RLS: enable on every table; one policy each:
`create policy allow_authenticated on <table> for all to authenticated using (true) with check (true);`
(The agent uses the service key and bypasses RLS; the policies exist so a
future direct-auth client works unchanged. D7/D8.)

### 1.3 Storage
One bucket: **`deck-files`**, private (NOT public). Layout:
```
decks/<deck_id>/assets/<filename>       images + fonts the snapshot uses
decks/<deck_id>/pdf/v<N>_<pdfname>.pdf  the PASS pdf per version
decks/<deck_id>/thumbs/v<N>/p<page>.png thumbnails per version
customers/<slug>/logo.<ext>
```
The browser never reads the bucket directly; the agent proxies/caches (§5.4).
Authenticated read is therefore sufficient and nothing is anonymous-public.

## §2. The snapshot format (THE contract — everything depends on this)

A published deck version is ONE self-contained HTML document plus an asset
folder. Requirements:

1. **Document shell** — the assembled deck as today (`<div class="deck">` with
   one `<section>` per slide) with these changes:
   - The two `<link rel="stylesheet">` tags (deck.css, showcase.css) are
     REPLACED by two `<style data-inlined="deck.css">` / `"showcase.css"`
     blocks containing the css text.
   - All relative asset references (`(../)*brand/img/...`, font `url(...)` in
     the inlined CSS) are rewritten to `assets/<filename>` and the files are
     bundled. Filename collisions from different sources: suffix `_2`, `_3`.
2. **Per-section metadata**: every `<section>` gets
   `data-slide-id="<library id or local id>"` and `data-role="<role>"`
   (role from the slide's `meta.yaml`; empty string if unknown). The assembler
   already emits `<!-- 01 · slide-id -->` comments — the publisher uses those
   plus deck.yaml order to set the attributes.
3. **Slots** (D12): occurrences of the deck-level variables `deck_footer`,
   `cover_meta`, `client`, `prepared_for` in the BODY are wrapped at publish
   time: `{{deck_footer}}` → `<span data-slot="footer-meta">VALUE</span>`,
   `{{cover_meta}}` → `data-slot="cover-meta"`, `{{client}}` → `"client"`,
   `{{prepared_for}}` → `"prepared-for"`. Never wrap inside `<title>` or inside
   attribute values (only wrap matches that sit in text content; a regex on
   `>[^<]*{{var}}[^<]*<` boundaries is acceptable). A client-logo `<img>` in a
   fragment is slot-marked by adding `data-slot="client-logo"` in the fragment
   itself (one-time manual pass during migration where relevant).
4. **Embedded manifest**: immediately before `</head>`:
```html
<script type="application/json" id="deck-meta">
{"schema":1,"title":"…","type":"…","client":"","allowed_entitlements":["public"],
 "slides":[{"id":"cover","role":"cover"},…],
 "assets":{"capture.jpg":{"source":"brand/img/capture.jpg","entitlement":"public"}},
 "published":"YYYY-MM-DD","tool":"publish-deck.py"}
</script>
```
   `assets` records provenance + entitlement per bundled file (looked up in
   `brand/img/library.json`; files not in the manifest → `"public"`, fonts →
   `"public"`).
5. **No external references**: after publishing, the document must render from
   `index.html` + `assets/` alone (file://-openable). No `<script>` other than
   the deck-meta JSON block. This is validated on every save (§5.3).

## §3. Shared validation: the structural fingerprint

Implement once in the agent (`app/lib/htmlcheck.mjs`) — used by save,
personalize, and harvest endpoints. Zero-dep (no DOM in Node): a small HTML
tokenizer that walks tags with a regex over `<[^>]+>` while skipping the
contents of `<style>`, `<script id="deck-meta">`, and comments.

`fingerprint(html)` returns a string built from the tag stream:
- For each open/close tag: tag name; for open tags also the **sorted attribute
  names** EXCLUDING `style`, and the VALUES of `class`, `data-slide-id`,
  `data-role`, `data-slot` (these may not change), INCLUDING presence (not
  value) of `src`/`href`.
- Text content and `style` values are excluded (those are the editable parts).

`validateSave(prevHtml, nextHtml)` returns `{ok}` or `{ok:false, error}`:
- `fingerprint(next) !== fingerprint(prev)` → `"structural change — use the CLI"`.
- `next` contains `—` or `&mdash;` → `"em dash"` (the editor should have
  auto-replaced; the server still refuses).
- Any `<script` outside the deck-meta block → refuse.
- Unfilled `{{…}}` present → refuse.
- Size > 3 MB → refuse.
- Every `src="assets/…"` must exist in `deck_assets` for this deck → else
  refuse (the image-swap endpoint registers assets BEFORE the save lands).

## §4. Python tools

### 4.1 `tools/supa.py` (new, shared helper)
Loads `.env`; thin REST client over `requests`:
`insert(table, rows)`, `update(table, match, values)`, `select(table, params)`
(PostgREST: `POST/PATCH/GET {SUPABASE_URL}/rest/v1/{table}` with
`apikey`/`Authorization: Bearer {SERVICE_KEY}`, `Prefer: return=representation`),
and `upload(bucket, path, bytes, content_type)`
(`POST {SUPABASE_URL}/storage/v1/object/{bucket}/{path}`, `x-upsert: true`).

### 4.2 `tools/publish-deck.py` (new)
```
python tools/publish-deck.py <deckdir> [--master] [--type T] [--client SLUG]
    [--customer SLUG] [--audience-kind K --audience-label L]
    [--derived-from DECK_SLUG --derived-from-version N]
    [--version-of DECK_SLUG]        # publish as a NEW VERSION of an existing deck
    [--note "change note"]
```
Behavior:
1. Run `deckstudio.assemble(deckdir, write=False)` to get fresh HTML (fail
   loudly on assembly errors).
2. Transform to snapshot format per §2 (inline css, bundle assets — collect
   from `<img src>`, css `url()`; compute sha256; look up entitlements;
   data-slide-id/data-role from deck.yaml + meta.yaml; slot-wrap; embed
   deck-meta).
3. Upload assets to `deck-files/decks/<deck_id>/assets/`; insert `deck_assets`.
4. `--version-of`: insert `deck_versions` row `n = current+1`, bump
   `decks.current_version_n`. Otherwise: insert `decks` row (+ resolve
   `customer_id` from `--customer`; create the customer row if missing, using
   `customers/<slug>/customer.yaml` when present) and `deck_versions` n=1.
5. If a PDF exists in `<deckdir>`, upload it and set `pdf_object` (used by
   migration; fresh publishes leave it null until the first agent build).
6. Print the deck id + slug + version n.
Idempotency: `--version-of` may always add a version; a plain publish with an
existing slug fails with a clear message (use `--version-of`).

### 4.3 `tools/fetch-deck.py` (new)
```
python tools/fetch-deck.py <deck-slug> [--version N] [--out DIR]
```
Downloads the version HTML + assets into `DIR` (default
`.scratch/fetched/<slug>-v<N>/`) so CLI workflows can read an edited deck as
content source (D2, reproduction).

### 4.4 Verify refactor
Split `tools/verify-deck.py`:
- `tools/verifylib.py`: `verify_dir(deckdir) -> Report` (today's behavior,
  moved) and **`verify_snapshot(dir) -> Report`** for a materialized snapshot
  (index.html + assets/ + optional pdf). `verify_snapshot` reads `deck-meta`
  (allowed_entitlements, client, assets entitlements) and `data-role` per
  section, then applies the same checks: em dashes; unfilled `{{…}}`;
  `data-total` == section count; footer discipline by role (`cover`, `closer`,
  `cta` have no `.slide-foot`, all others must); every `img src` resolves
  inside the dir; asset entitlement ⊆ allowed; NAME_SCOPE text scan; if a PDF
  is present: name carries `oppr` (+ client slug when client set), page count
  == section count, page size 13.333×7.5 in, blank-page warns. Report entries
  carry `{level, code, slide_id|null, msg}`.
- `tools/verify-deck.py` stays the CLI wrapper (`verify_dir`), plus flags
  `--snapshot` and `--json` (print the Report as JSON, exit 1 on fails).

### 4.5 `tools/pdf-thumbs.py` (new)
`python tools/pdf-thumbs.py <pdf> <outdir> [--width 480]` → `p1.png…pN.png`
via PyMuPDF. Used by the agent after each PASS build.

### 4.6 `tools/migrate-decks.py` (new, one-shot but re-runnable)
1. For each `decks/canonical/<type>/`: publish as master
   (`--master --type <type>`, slug = `<type>` e.g. `product-showcase`).
2. For each `decks/variants/<slug>/`: publish; read `manifest.yaml` for the
   source canonical → set lineage to that master (version 1); `client:` in
   deck.yaml → `--client` + `--customer` (creates/links customer rows from
   `customers/<slug>/` incl. logo upload); no client → `audience_kind`
   inferred: leave `general`.
3. Migrate `customers/<slug>/` folders that have no decks yet → customer rows.
4. Migrate `social/_status.json` → `publish_log` rows.
5. Re-run safe: skip anything whose slug already exists (print SKIP lines).

### 4.7 `tools/build_app_index.py` (edit)
Remove the `decks` and `customers` sections from the index (the app now gets
both from the agent/backend). Keep slides, graphics, icons, design-system,
social outputs, knowledge exactly as they are.

## §5. The local agent (evolve `app/server.mjs`)

Keep everything that exists EXCEPT the deck-draft endpoints (§7 deletions).
Add modules: `app/lib/env.mjs` (.env parser), `app/lib/supabase.mjs` (fetch
wrapper: PostgREST + Storage, service key), `app/lib/htmlcheck.mjs` (§3),
`app/lib/jobs.mjs` (in-memory job map + runner).

### 5.1 Deck cache (materialization)
`app/.deck-cache/<deck_id>/v<N>/{index.html, assets/…}` — a disposable local
mirror. `materialize(deck_id, n)` writes the version HTML from Postgres and
downloads any missing assets from Storage (skip files already present with
matching sha). Served read-only at `GET /deck-cache/<deck_id>/v<N>/…` (same
`safeResolve` guard pattern as `/repo/`). `.deck-cache/` goes into
`.gitignore` and `app/.gitignore`.

### 5.2 Read endpoints (all JSON)
- `GET /api/decks` → `{decks:[{id, slug, title, type, is_master,
  audience_kind, audience_label, customer_id, client_slug, status,
  needs_cli_reason, current_version_n, derived_from_deck_id,
  derived_from_version_n, updated_at, thumb}]}`; `thumb` = cache path of
  p1.png of the current version if present, else null.
- `GET /api/decks/:id` → deck + `versions:[{n, change_note, author,
  created_at, has_pdf, verify_summary:{fails,warns}}]` + `family:[{deck rows
  derived from this deck}]`.
- `GET /api/decks/:id/versions/:n/html` → the HTML (text/html).
- `GET /api/decks/:id/versions/:n/view` → materializes and 302-redirects to
  `/deck-cache/<id>/v<n>/index.html` (what the viewer/editor iframes load).
- `GET /api/decks/:id/versions/:n/pdf` → streams the PDF from cache
  (materialize on demand from Storage).
- `GET /api/customers2` → customer rows from the backend (name kept distinct
  from any legacy route; the front end switches to this).

### 5.3 Write endpoints
- `POST /api/decks/:id/versions` body `{html, change_note}` →
  `validateSave(currentHtml, html)` (§3); on ok: insert version `n+1`, bump
  `current_version_n`, write cache, respond `{ok, n}`. On validation error:
  `400 {error, code}` — `code:"structural"` tells the UI to show the
  needs-CLI guidance (but a rejected save does NOT flag the deck).
- `POST /api/decks/:id/restore` `{n}` → copies version n's html as a NEW
  version (note `restored from v<n>`).
- `POST /api/decks/:id/master` `{is_master:true|false}` → when true: clear
  `is_master` on all decks of the same `type`, set here (two PATCHes; the
  partial unique index backstops races). D9/D10.
- `POST /api/decks/:id/personalize` body `{title, customer_id | audience:
  {kind,label}, slots:{client, "prepared-for", "cover-meta", "footer-meta"},
  logo_asset?, html}` → the CLIENT builds the personalized HTML (DOMParser:
  set textContent of each `[data-slot]`, swap `[data-slot="client-logo"]` src)
  and sends it; the server validates `fingerprint(masterCurrent) ===
  fingerprint(html)` + the §3 checks, copies the master's `deck_assets`
  (Storage server-side copy), inserts the new deck (slug =
  `YYYY-MM-DD_<slugified title>`, lineage = master id + current n,
  `client_slug` from the customer, inherits `allowed_entitlements`) + version
  1, responds `{ok, deck}`. Date for the slug: server clock.
- `POST /api/decks/:id/assets` body `{source:"brand/img/<file>"}` → for image
  swap: copies the repo file into cache assets + uploads + inserts
  `deck_assets` (entitlement from `brand/img/library.json`; REFUSE with 403 if
  entitlement ∉ deck.allowed_entitlements), responds `{ok, filename:
  "assets/<name>"}`. Also `{customer_logo: <customer_id>}` variant for
  personalize.
- `PUT /api/publish-log/:slug` + `GET /api/publish-log` → replace the
  `social/_status.json` read/write pair 1:1 (table-backed now). Keep the old
  endpoints as aliases that hit the table, so `social.js` needs only its URL
  unchanged or minimally edited.
- `POST /api/customers2` `{name, slug?, notes?}` → insert customer (used by
  `/ingest-dump`; the dump/_app staging flow stays as-is).

### 5.4 Build endpoint + job runner
- `POST /api/decks/:id/build` → refuses if a job is already running for the
  deck; creates job `{id, deck_id, n:current}`, responds `{job_id}` immediately.
- Job steps: materialize v<n> → print PDF → `python tools/verify-deck.py
  --snapshot --json <cacheDir>` → on PASS: upload PDF, generate + upload
  thumbs (`pdf-thumbs.py`), set `deck_versions.pdf_object` +
  `verify_report`, set deck `status='ok'`, `needs_cli_reason=''`. On FAIL:
  store `verify_report` on the version, set `status='needs_cli'`,
  `needs_cli_reason` = first 3 fail messages joined. Always insert a
  `build_jobs` history row.
- **PDF printing in Node** (port of `build-pdf.ps1`): find the browser in the
  same four candidate paths; spawn
  `--headless=new --disable-gpu --no-pdf-header-footer
  --virtual-time-budget=10000 --print-to-pdf=<out> file:///<cache>/index.html`.
  PDF name: master → `oppr_<type>.pdf`; otherwise
  `<version created date YYYY-MM-DD>_oppr_<slug-without-leading-date>` +
  `_<client_slug>` when set + `.pdf` (mirror `deckstudio.pdf_name` semantics).
- `GET /api/jobs/:id` → `{state, verify_report?, pdf?}`; the UI polls at 1 s.

### 5.5 Boot behavior
Backend unreachable or `.env` incomplete → the app still boots: library /
social / knowledge work from index.json; deck+customer routes show a clear
"backend not configured / offline" panel naming what to fix. No crash.

## §6. Front end

### 6.1 Plumbing
- `state.js`: add `state.backend = {decks: [], customers: [], ok: true}`.
- `main.js` boot: `Promise.all([api.getIndex(), api.getDecks(),
  api.getCustomers2()])`; failures of the last two set `backend.ok=false`.
- `api.js`: helpers for every §5 endpoint.

### 6.2 Views (rewire, keep the area/tab IA exactly as is)
- **Customers** (`views/customers.js`): list/detail read `state.backend`.
  A customer's decks = backend decks with `customer_id`. Keep the pending-
  intake display (dump/_app scan can stay index-side or move to a tiny agent
  endpoint — builder's choice, keep the feature). Deck rows: title, updated,
  vN, status pill (`ok` | `needs CLI`), thumb, actions: **Open**, PDF (when
  current version has one), **Edit**.
- **Output → Masters** (`views/decks.js`): section 1 "Masters" =
  `is_master` decks (badge `MASTER`, its type, family count). Section 2
  "Company decks" = non-master decks with `audience_kind != 'customer'`.
  Customer decks stay under Customers only.
- **Deck detail page** (new `views/deck.js`, route `/deck/:id`): header
  (title, badges: master/type/audience/status), actions: **Open** (viewer),
  **Edit**, **Regenerate PDF**, **Personalize** (masters only), **Make
  master** / **Master ✓** toggle, PDF download. Below: **version timeline**
  (n, date, author, note, verify chip, per-version View + Restore) and, for
  masters, the **family list** (derived decks + "from v<n>", with a hint when
  behind current). Needs-CLI banner when flagged: the reason + a copyable
  prompt `/deckbuilder edit <slug> — <needs_cli_reason>`.
- **Viewer**: `assembledPages()` already fetches a URL — point it at
  `/api/decks/:id/versions/:n/view` (it returns the cache HTML; the existing
  section-splitting works because the snapshot is the same deck markup).
  `<base>` must point at the cache dir so `assets/…` resolve.

### 6.3 The editor (new `app/web/js/views/editor.js`, route `/deck/:id/edit`)
Layout: left = stage (one slide, same self-scaling iframe technique as the
viewer, but the iframe loads the materialized cache URL directly — same
origin, so the parent scripts the document; no srcdoc); right = inspector
panel; top = slide strip (numbers), Save / Discard / Regenerate.

Interaction model (D5 — three verbs, nothing else):
1. **Select**: click any element inside the current `<section>` → outline
   (2 px) + breadcrumb `section > div > p`. Inline `<svg>` counts as one
   atomic element (no text editing inside).
2. **Text**: if the selected element has no element children (or only
   `<b>/<i>/<em>/<strong>/<span>` inline children), a click again (or Enter)
   enables `contenteditable` on it. On input: `—` typed or pasted →
   auto-replace with `–` + toast "em dash replaced (brand rule)".
   Esc/blur ends editing.
3. **Nudge** (inspector steppers writing the element's inline style; 4 px per
   step, shift = 12): `margin-top/right/bottom/left`, `padding-*`, `gap`,
   `font-size` (clamped 9–120 px), `line-height` (0.9–2.0), `max-width`.
   Nothing else is writable — the panel simply has no other controls, and the
   serializer never touches other props.
4. **Image swap**: selecting an `<img>` shows Swap → picker modal over
   `state.index.graphics` HIDING anything whose entitlement ∉ the deck's
   `allowed_entitlements` → `POST /api/decks/:id/assets` → set `src` to the
   returned `assets/<file>`.
5. **Slots**: elements with `data-slot` are normal text edits, plus the
   inspector labels them ("slot: prepared-for").
6. **Overflow meter**: after every change, compare each descendant's
   bounding box against the section box (+2 px tolerance) and
   `scrollHeight > clientHeight`. Amber "overflows the slide" chip on the
   slide strip + inspector.
7. **Save**: serialize `"<!DOCTYPE html>" + doc.documentElement.outerHTML`
   → `POST /api/decks/:id/versions` with a change-note prompt (prefilled from
   the edit log, e.g. "text ×3, nudge ×1, image ×1"). If any slide still
   overflows → confirm dialog, and on confirm the save proceeds but the UI
   immediately shows the amber state; a following Regenerate that produces a
   blank/overflow WARN keeps it visible. A `400 structural` response → modal:
   "This change goes beyond fine-tuning. Rebuild the slide via the CLI:" +
   copyable prompt.
8. **Discard**: re-materialize current version, reload iframe.
9. Dirty-state guard on navigation (beforeunload + router guard).

### 6.4 Personalize flow (masters, D11/D12/D13)
Button on master detail → modal:
1. Audience: pick an existing customer (dropdown, from backend) OR "person /
   event" with a free label. Title prefilled `<master title> — <name>`.
2. Slot form: the app fetches the current HTML, DOM-parses it, lists each
   distinct `data-slot` with its current text prefilled; customer pick
   prefills `client` = name and, when a logo exists, offers the logo swap.
3. Create → build personalized HTML client-side (set slot textContent / logo
   src), `POST /api/decks/:id/personalize` → navigate to the new deck, toast
   "Created from <master> v<n>".

### 6.5 Social status
`views/social.js` + `postedit.js`: point the status read/write at the
publish_log endpoints (alias keeps the shape identical). No other social
changes; social outputs remain file-based (`state.index.social`).

## §7. Deletions & retirements (do these, carefully)

- Delete `app/web/js/draft.js` and `app/web/js/compose.js` and remove the
  deck-draft endpoints (`/api/drafts`, `/api/drafts/:slug`) + `listDrafts`
  from the agent. **Before deleting anything, grep for importers** — e.g.
  `viewer.js` imports `pageHtmlFor` from `carousel-build.js`: carousel-build
  and ALL social-draft code STAY (social is out of scope).
- `decks/drafts/` staging: no longer written by anything; leave the folder,
  note it legacy in docs.
- `build_app_index.py`: drop decks + customers sections (§4.7).
- Front-end: remove now-dead imports/routes (`draftViewer` in viewer.js if
  unreferenced after the above; check).

## §8. CLI workflow docs (`.claude/commands/`) + repo docs

Update these instruction files so future CLI sessions behave per the new model
(they are prose instructions for Claude — edit precisely, keep their voice):
- `new-deck.md` / `deckbuilder.md`: after verify + visual pass, END with
  `python tools/publish-deck.py <deckdir> …` (flags per §4.2, including
  lineage when built from a master/deck) and report the deck slug. Building a
  deck "based on <existing deck>": first `python tools/fetch-deck.py <slug>`
  and read the fetched HTML as content source. Masters are resolved by tag:
  `GET /api/decks` (agent running) or a `tools/supa.py` select — grab
  `is_master` for the type.
- `edit-canonical.md` → repurpose as **edit-master**: fetch the master
  (fetch-deck), make the structural change (edit the snapshot HTML directly,
  or rebuild the affected slides from library fragments), verify
  (`--snapshot`), publish with `--version-of <master-slug>`. Library/design
  system rules unchanged for NEW slide patterns.
- `ingest-dump.md`: customer intake now ALSO creates the backend customer row
  (`POST /api/customers2` or supa.py) and uploads the logo to Storage;
  `customers/<slug>/` folder becomes optional legacy.
- **Repo docs**: rewrite `CLAUDE.md` layer list + rules (deck home = backend;
  app writes = versions via agent + staging areas; "authoring is CLI-only,
  the app edits and re-prints"; variants-frozen rule replaced by versions;
  masters = tag). Rewrite `decks/CLAUDE.md` as a legacy note. Update
  `app/README.md`, `.env.example`, and add a note to
  `.scratch/deck-app/nav-overhaul/MAP.md` that this effort supersedes
  "Unified Archive & History" (decks) and settles "Fate of the in-app
  builder" (composer deleted; editor + personalize replace it).

## §9. Migration runbook (execute in this order)

1. Supabase project ready; `.env` filled; schema applied (§1); bucket created.
2. `pip install -r requirements.txt` (now incl. `requests`).
3. One-time manual pass: add `data-slot="client-logo"` to fragments that show
   a client logo (search library for obvious candidates; likely few or none).
4. `python tools/migrate-decks.py` → masters + variants + customers +
   publish_log in the backend. Spot-check in the app.
5. Agent + front end switched over (§5, §6). `npm run dev`, walk the
   acceptance list.
6. Repo `decks/` and `customers/` remain untouched as legacy (do NOT delete).

## §10. Acceptance checklist (the build is done when ALL pass)

Backend & publish
1. `migrate-decks.py` publishes every existing canonical (as master) and both
   variants (with lineage + client where set); re-running prints SKIPs only.
2. A published snapshot opens from the cache folder via `file://` and renders
   identically to the repo original (fonts included, zero network requests).
3. `verify-deck.py --snapshot --json` on a materialized version returns the
   same PASS/FAIL judgments as the legacy path did for that deck.

App
4. Customers → a customer shows its backend decks; Output → Masters shows
   master-tagged decks + company decks; customer decks appear ONLY under
   their customer.
5. Deck detail: version timeline lists versions; View renders any old
   version; Restore creates a new version equal to the old one.
6. Editor: text edit saves as v(n+1); typing an em dash is auto-replaced;
   nudging margin-top changes only that inline style; image swap offers ONLY
   entitlement-cleared images and the swapped file lands in `deck_assets` +
   Storage; adding/removing an element via devtools then saving → 400
   structural + the CLI prompt modal; overflow shows the amber chip.
7. Regenerate: PASS attaches a PDF named per the rule (`oppr` + client slug)
   with page count == section count, thumbnails refresh, status stays `ok`.
   Then hand-edit a version's html in the DB to contain `—` (test only),
   regenerate → FAIL, no PDF, deck flagged `needs_cli` with reason + prompt;
   fixing and regenerating clears the flag.
8. Personalize on a master: slot form prefilled; creating for a customer
   files the deck under that customer with lineage recorded ("from v<n>" on
   the master's family list); free-form event audience lands under Company
   decks.
9. Master toggle: tagging deck B of the same type untags deck A; the unique
   index never trips in normal use.
10. Backend down (`.env` emptied): app boots, library/social/knowledge work,
    deck routes show the offline panel, no console errors.

Hygiene
11. No new npm deps; `git status` shows no secrets, no `.deck-cache/`, no
    generated PDFs outside legacy paths; all doc updates from §8 are in place.
12. Social output views work exactly as before, now backed by `publish_log`.

## §11. Out of scope (do NOT build)

- Social outputs migration to the backend; roles/ACLs; Supabase Auth login
  UI; realtime; remote/cloud PDF rendering; free-drag editing; deleting
  `decks/` or `customers/` from the repo; harvest tooling beyond what the
  editor + edit-master flow already enable; translation tooling.
