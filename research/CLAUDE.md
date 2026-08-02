# research/ — the Last-30-days brain

Market listening for the studio. Every `/last30days` run is recorded here as
structured knowledge, and those runs are folded into one accumulated **brain**
that gets more confident as evidence repeats.

This folder is the home of `LAST30DAYS_MEMORY_DIR`. Research does not live in
`~/Documents` anymore: it lives in the repo, next to the decks and posts it
feeds, so a fresh clone carries the studio's understanding with it.

## Layout

```
research/last30days/
  brain.json            generated — what the app reads
  brain.md              generated — the readable brain document
  performance.json      engagement per promoted post; the feedback signal
  runs/<slug>/
    run.json            THE SOURCE OF TRUTH for a run (hand-authored knowledge)
    raw.md              the engine's raw evidence dump + WebSearch appendix
    brief.html          the shareable brief (self-contained, brand-styled)
  posts/*.md            IDEAS written off the brain (frontmatter + body)
  posts/_status.json    which ideas have been spent (app-owned)
  _archive/             runs that were polluted or superseded; kept, not counted
  library.db            the engine's local search index (rebuildable, gitignored)
```

## Ideas are cheap, promotion is the commitment

`posts/*.md` are **ideas**, not deliverables. They are meant to be read, mostly
discarded, and cost nothing to throw away. An idea that is worth shipping gets
**promoted** (the button on the app's Ideas tab), which:

1. writes `social/drafts/<date>-<slug>/draft.json` with the body,
2. keeps the lineage: `source_idea` and the `themes` ids it argues,
3. for an article, writes the 1200×627 hero via `tools/build-article-hero.py`,
4. marks the idea spent in `posts/_status.json`,
5. seeds a `performance.json` record so an unposted draft stays visible.

It does **not** build the output. `/deckbuilder` still does, with its verify gate.
From there the piece is fine-tuned and published in **Social output** as normal.

## The second confidence axis

After posting, record the link and dated engagement readings on the app's
**Performance** tab. `research-brain.py` reads `performance.json` and rolls
engagement up to the theme each post argued, giving every theme two independent
signals:

- `confidence` — `emerging` / `corroborated` / `established`: did the *evidence*
  repeat across runs?
- `audience` — `untested` / `flat` / `resonant`: did anyone actually respond?

These disagree usefully. An established theme that posts flat is the most
informative result the brain can produce, and it is invisible if you only count
evidence. Engagement per post weights a comment as three likes (a comment costs
more to give) and averages per post, so one strong post is not beaten by three
weak ones. Only posts with a recorded reading count, so an unposted draft never
drags a theme down.

**Never invent a reading.** An empty `samples` array is an honest state; a
fabricated one teaches the brain a false belief and there is no way to tell later.

## The loop

1. **Research.** `/last30days <topic>` in the CLI. It writes `raw.md` and (when
   asked) `brief.html` into `research/last30days/`.
2. **Record.** Move the artifacts into `runs/<YYYY-MM-DD>-<slug>/` and author
   `run.json`: the findings, themes, vocabulary, stats, entities, quotes, open
   questions and caveats. This is the step that turns a search result into
   knowledge. Nothing else in this folder is hand-written.
3. **Rebuild.** `python tools/research-brain.py`. Deterministic and idempotent.
   `--check` exits 1 when the outputs are stale.
4. **Read.** The app's **Last 30 days** area: Brain, Runs, LinkedIn posts.

## How the brain gets smarter, not just longer

Themes are keyed by `id` across runs. A theme seen in one run is `emerging`,
in two `corroborated`, in three or more `established`. Reuse a theme `id` in a
later run and the brain promotes it automatically. That is the whole mechanism:
repeat evidence raises confidence, and the app shows the confidence.

The same applies to vocabulary, entities and stats, which are deduped across
runs and carry the list of runs that saw them.

## run.json contract

Required: `slug`, `date`, `topic`, `question`, `verdict`, `headline`.
Optional but where the value is: `themes[]` (`id`, `label`, `summary`,
`stance` one of actionable/risk/caution/observed), `vocabulary[]` (`term`,
`kind`, `note`), `stats[]` (`value`, `label`, `source`, `url`, `date`),
`entities[]` (`name`, `kind`, `note`), `quotes[]` (`text`, `author`, `weight`,
`url`), `findings[]` (`claim`, `evidence`, `source`, `url`), `open_questions[]`,
`caveats[]`, `sources` (`active`, `missing`, `degraded`, `counts`).

Be honest in `caveats` and `sources.missing`. A run that never searched X should
say so, because the brain's Coverage health panel is built from those fields and
a silent gap reads as a finding.

## Rules

- **Runs are the source of truth.** `brain.json` and `brain.md` are generated.
  Never hand-edit them: fix the run and rebuild.
- **A polluted run is archived, not deleted and not counted.** `_archive/` keeps
  the record of what went wrong so the same query mistake is not repeated.
- **Stats carry their source.** Every number in `run.json` has a `source` and,
  where possible, a `url`. Verify commercial facts against Floris before reuse.
- **Same brand voice as everything else** in the posts: concrete, no hype,
  European numbers, no em dashes. See `knowledge/best-practices/linkedin-post.md`
  and `linkedin-article.md` for the format rules the drafts follow.
- **Public by definition.** Nothing in `posts/` names a customer. Research runs
  may discuss competitors; they never carry named-customer material.
- **The app never writes here.** It reads, and it can trigger two server actions:
  rebuild (shells out to `tools/research-brain.py`) and sync (mirrors the folder
  to Supabase Storage under the same repo-relative path convention as
  `social/`, `references/` and `decks/`).
