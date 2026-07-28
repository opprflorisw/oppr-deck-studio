# does git stay the store

`wayfinder:grilling` · child of `../MAP.md` · unassigned

## Question

Does git remain the store of record once this is deployed, or does a database take
over?

Everything downstream hangs off this. Today outputs are committed, `manifest.yaml`
records provenance as `canonical/<type>@vN` plus per-slide commit SHAs, and
"look back" is `git log` / `git show`. Cloud Run has ephemeral disk, so a naive
lift breaks that immediately.

Three shapes to weigh; the answer should say which and why:

- **Git stays.** The service keeps a working checkout (or clones per job) and
  commits on write. Provenance, diffing and rollback keep working for free.
  Costs: concurrent writes become merge problems, and every write is a commit.
- **Database of record, git as export.** Postgres or Firestore owns the truth and
  the repo is generated for the CLI and for humans. Clean concurrency, but the
  provenance model in `manifest.yaml` has to be redesigned and the
  self-describing-repo property weakens.
- **Split.** Content (slides, decks, brand) stays in git because the CLI reads it;
  operational state (names, status, comments, publish log) moves to a database
  because that is what actually needs to be mutable and concurrent.

The answer must state what inherits git's role as the auditable history if git
loses it.
