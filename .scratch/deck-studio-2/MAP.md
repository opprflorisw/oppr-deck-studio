<!-- wayfinder:map -->
# Deck Studio 2.0 — consolidate, standardize, prune

## Destination

One coherent Deck Studio: **a single store of truth**, a **visible CLI ↔ app
boundary** (CLI creates · app changes and ships), an **edit → verify → PDF loop
that covers every artifact type**, and **a repo with nothing unused left in it**.

Reached when: the 2.0 spec is written and approved, AND the repo is actually in
that state — dead code deleted, docs matching reality, navigation reflecting the
boundary, and every remaining tool/command earning its place.

## Notes

- **This map executes, not just plans** (Floris, 2026-08-01). Each ticket still
  resolves a *decision* first; once locked, the same session carries it out and
  records both the decision and the fact it shipped. Never build before the
  decision is written down.
- **Deletion is aggressive: anything unreferenced goes.** One safeguard, because
  git is not a universal safety net here: since v3, `/decks/*`, `/social/*`,
  `/dump/*`, `/references/`, `/screenshots/` and `app/.deck-cache/` are
  **gitignored**. Untracked material is published + verified into the backend, or
  shown to Floris, *before* it is removed. Tracked files can go straight away.
- **The failure that opened this map:** the in-app editor already does text
  edits, nudges, image swaps, save-as-new-version and regenerate-PDF-with-verify
  (`app/web/js/views/editor.js`, `app/lib/jobs.mjs`) — and Floris did not know it
  existed. **2.0 is mostly consolidation, discoverability and pruning, not new
  machinery.** Prefer surfacing what is built over building more.
- **The boundary (settled at charting):** *CLI creates* (new deck, new carousel,
  structural change) · *app changes and ships* (edit, rename, PDF, publish,
  track). The wall stays, but becomes **visible and consistent in both
  directions** — each side tells you when to switch.
- **Local now, hosted-ready later** (settled at charting). Stays localhost-only,
  but 2.0 adds no new local-only dependency and keeps render/verify portable, so
  hosting later is not a rewrite. Hosting itself is out of scope.
- **"Feedback" means the system reporting its own state** (settled at charting):
  verify results in plain language, what changed between versions, whether the
  PDF is current. Not annotation/comments.
- Owner: Floris. Single user, local app, Supabase backend.
- Standing constraints that do not get renegotiated here: brand rules
  (`brand/BRAND.md`), entitlement clearance (one slug per customer, 2026-08-01),
  European number formatting, no em dashes in output, footer discipline.
- When resolving a ticket use `/grill-me`; use `/prototype` where "how should it
  look or behave" is the crux.

## Decisions so far

<!-- one line per closed ticket; the detail lives in the ticket -->

- [One store of truth](tickets/one-store-of-truth.md) — **Supabase owns content,
  git owns the tool, the cache owns nothing.** `decks/` and `social/<channel>/`
  are disposable build scratch. Verified every untracked artifact was already
  published (engagement's four folders *were* versions 1-4, each with its PDF),
  then deleted them. `canonical/<type>@vN` git tags retired; a version is a
  `deck_versions` row, never a `<slug>-v2/` folder.
- [Artifact model](tickets/artifact-model.md) — **One model.** `decks` gained
  `kind` + `channel` + `category` + `page_format`; `import-social.py` moved 10 of
  11 social outputs into `decks`/`deck_versions` with bundled assets and their
  PDFs. A carousel is structurally a deck (`.carousel` wrapping `<section>`), so
  one editor, one gate, one build job, one history now serve everything. The
  markdown article has no HTML document and is the one type still outside.
- [Output identity, naming and PDF freshness](tickets/output-identity-and-pdf-freshness.md)
  — **The PDF is always the version on screen.** A version with no PDF prints on
  demand and waits, never falling back to an older file. Verify FAIL still
  withholds it (409 + the report), with an explicit `UNVERIFIED_`-prefixed
  download that is never attached to the version. **Rename** owns the title and
  the filename's middle segment; date, `oppr` and client slug stay system-owned
  so a rename cannot defeat `verify-deck.py`.
- [Verify gate unification](tickets/verify-gate-unification.md) — **One source,
  several rule sets.** `verifylib.PAGE_FORMATS` keyed on `page_format`: brand
  rules are universal, geometry and the deck-only structural rules (footer
  discipline, `data-total`) vary. `snapshot_html.inject_meta` gives every
  artifact the `deck-meta` manifest the gate reads. `htmlcheck.mjs` stays a
  separate gate with a separate job (is this save structure-preserving).
- [Editor coverage](tickets/editor-coverage-and-the-edit-wall.md) — the editor
  now takes any artifact: container `.deck, .carousel`, canvas size from
  `page_format`, and scale fits **both** dimensions (width-only scaling broke on
  4:5). The three verbs (text, nudge, image swap) were kept as-is.
- [Library element download](tickets/library-element-download.md) — **the
  self-contained page, not the fragment.** `export-element.py` fills the
  placeholders, wraps a slide in a one-page document, inlines the CSS and bundles
  images; a design-system block is already a document and is snapshotted as-is.
  HTML inlines assets as data URIs (one portable file); PNG/PDF print via the
  same browser a deck build uses. Entitlement is enforced on the way out.
- [Status and feedback surface](tickets/status-and-feedback-surface.md) —
  `web/js/verify.js` translates each verify `code` into a sentence plus who fixes
  it (fix here / needs the CLI / your call). The deck list carries verify state
  and "PDF not printed". A clean report and no report read differently.
- [The CLI and app handover contract](tickets/cli-app-handover-contract.md) +
  [Navigation](tickets/navigation-and-discoverability.md) — one action grammar,
  **Open · Edit · Download**, on every row of every area, from one
  `views/artifacts.js`. Every prompt box is click-to-copy; every CLI command ends
  by naming the app URL. The old nav-overhaul map is closed as superseded.
- [The purge](tickets/the-purge.md) — deleted `draft.js`, `social.js`,
  `decks.js`, `postedit.js`, `migrate-decks.py`, all published build scratch;
  renamed `migrate-content.py` → `publish-social.py`. Kept `.scratch` as design
  history behind a `README.md` index, because losing the "why" is what caused
  this drift. `snapshot.py` was nearly deleted as dead and is in fact the v3
  snapshot builder — verified before, not after.
- [Docs match reality](tickets/docs-match-reality.md) — rewrote the root
  `CLAUDE.md` layers/rules, `decks/CLAUDE.md`, `app/README.md`; added
  `tools/check-docs.py [--check]`, which fails when any documented path does not
  exist.

## Not yet specified (fog)

- **What portability actually costs.** "Hosted-ready later" is a direction, not a
  design. Which of Chrome-print, Python-verify and the secret-key-holding local
  agent are the real anchors, and what a portable render path would look like.
  Revisit once *One store of truth* and *Output identity* have landed.
- **The social publishing / tracking loop.** `publish_log`, posted dates, the
  Last-30-days brain feeding drafts. In scope for pruning, but its own shape is
  not yet a sharp question. Sharpens after *Artifact model*.
- **Whether `research/last30days` belongs in Deck Studio at all** or is a
  neighbouring system that shares a repo. Sharpens after the artifact model.
- **Per-artifact-type pipeline standardization.** Floris did not name this as a
  live problem, so it is not ticketed; *Artifact model* and *Verify gate
  unification* may make it moot, or may expose it.

## Out of scope

- **Hosting / deploying the app** (reachable from anywhere, or by anyone else).
  Explicitly deferred: 2.0 stays local, only avoiding decisions that would block
  it later.
- **Annotation / comment feedback from Floris onto a slide**, and any
  notes → CLI brief loop. Feedback in 2.0 is the system reporting status only.
- **Team access & sharing** — already deferred in CLAUDE.md's roadmap; nothing
  here revisits it.
- **New authoring capability** (new slide types, new deck types, generation
  features). 2.0 consolidates what exists.

## Tickets

Frontier = open + unblocked + unclaimed. Work one per session; record the answer
here on close.

All twelve are closed — decided, built and verified on 2026-08-01.

| Ticket | Type | Status |
|---|---|---|
| [One store of truth](tickets/one-store-of-truth.md) | grilling | ✅ closed |
| [The CLI and app handover contract](tickets/cli-app-handover-contract.md) | grilling | ✅ closed |
| [Library element download](tickets/library-element-download.md) | prototype | ✅ closed |
| [Artifact model](tickets/artifact-model.md) | grilling | ✅ closed |
| [Output identity, naming and PDF freshness](tickets/output-identity-and-pdf-freshness.md) | grilling | ✅ closed |
| [Editor coverage and the edit wall](tickets/editor-coverage-and-the-edit-wall.md) | prototype | ✅ closed |
| [Verify gate unification](tickets/verify-gate-unification.md) | grilling | ✅ closed |
| [Status and feedback surface](tickets/status-and-feedback-surface.md) | prototype | ✅ closed |
| [Command surface consolidation](tickets/command-surface-consolidation.md) | grilling | ✅ closed — all four commands kept, re-routed; `canonical/<type>@vN` tagging replaced by `--master`; each command now ends by naming the app URL. Commands stay `.claude/commands/` files (skills are gitignored here, so making them skills would cost a fresh clone its workflows). |
| [Navigation and discoverability](tickets/navigation-and-discoverability.md) | prototype | ✅ closed |
| [The purge](tickets/the-purge.md) | task | ✅ closed |
| [Docs match reality](tickets/docs-match-reality.md) | task | ✅ closed |

## Left open on purpose

- **A `holliday`-cleared image sits in a published public carousel**
  (`2026-07-23_no-hardware-no-rip-and-replace` → `docs-desktop-library.png`).
  The old path could not catch it: `verify-carousel.py` never checked
  entitlement. It now FAILs, deliberately left failing — swapping the image or
  re-clearing it is Floris's call, not a thing to paper over.
- **`kind=article`** has no HTML document, so it is the one output type still
  outside the edit → verify → PDF loop. `import-social.py` reports it rather than
  dropping it silently.
