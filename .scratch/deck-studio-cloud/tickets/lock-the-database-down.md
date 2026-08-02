# Lock the database down

Type: task · Status: open · Blocked by: Identity and roles

## Question

Write and prove the row-level security policies, on every table, deny by default.

## The state today

All eight tables have `rls_enabled: true` and **zero policies**, which in Postgres
means deny everything. Measured 2026-08-02: the publishable key reads 0 rows from
every table, and Storage refuses both that key and an unauthenticated URL. The
only reader is the local agent using `SUPABASE_SECRET_KEY`, which bypasses RLS by
design.

**So this ticket is about granting, not locking.** The name is kept because the
outcome is the same — a database whose rules are deliberate — but the direction
matters: today's state is closed and safe, and every policy added from here opens
a door. The risk lives in the grants, so each one is written to the narrowest
thing that works and then tested by trying to get past it.

Tables: `decks`, `deck_versions`, `deck_assets`, `customers`, `publish_log`,
`build_jobs`, `social_outputs` (legacy), `reference_files`. Plus **Storage**: the
`deck-files` bucket holds every PDF, every bundled asset and every customer logo,
and has its own access rules that matter exactly as much as the table policies.

## What done looks like

- Deny by default on every table and on the bucket. No `USING (true)`.
- One policy per role from *Identity and roles*, written once and readable.
- **Storage is not an afterthought.** A PDF is the whole deck; a signed URL that
  outlives its permission check is the same leak by another route.
- Adversarial tests, committed and runnable: authenticate as a user who should not
  see a given artifact and assert the read **fails**. A test that only proves the
  happy path proves nothing about a leak.
- The local CLI keeps working throughout — it holds the secret key and is meant to
  bypass RLS. That is the one legitimate bypass, and it should be the only one.

## Execution

Apply as a migration. Do not hand-edit policies in the dashboard: they must live
in the repo so that a fresh clone and a reviewer can both see them.
