# Identity and roles

Type: grilling · Status: open · Frontier · Blocks: nearly everything

## Question

Who is a user, how do they come to exist, and what may each of them do?

## Why it is first

Every other ticket needs the answer. RLS policies are written per role; the
secret-key decision depends on whether the browser holds a user token; clearance
as access control needs to know what a user *is* before it can say what they may
open.

## What a good answer settles

- **How an account is created.** Supabase Auth with email magic links (no
  passwords to handle), Google sign-in restricted to the Oppr domain, or explicit
  invite by Floris. Note the standing rule: this system never handles passwords in
  plain text, so magic-link or OAuth is strongly preferred over a password form.
- **The role list, and it should be short.** Candidates:
  - `owner` — Floris. Everything, including clearance and master tags.
  - `editor` — edits any artifact they can see, saves versions, prints.
  - `viewer` — opens and downloads, cannot save.
  Is `viewer` needed at all, given public share links are out of scope?
- **Whether roles are global or per-artifact.** Global is far simpler and
  probably right at this size; per-artifact is what you need if some colleagues
  must not see some customers.
- **The unauthenticated answer: nothing.** Deny by default, everywhere.
- What happens to `deck_versions.author` and `decks.created_by`, both hardcoded
  `'floris'` today — they become the acting user's id.

## Evidence

- Supabase project `ltnohjrrtyljrveftwii`; `auth.users` is unused today.
- `app/server.mjs` has no concept of a caller at all.
