# Where the secret key goes

Type: grilling · Status: open · Blocked by: Identity and roles

## Question

Once the app is hosted, what talks to Supabase, with which credential?

## Why it matters

`app/server.mjs` holds `SUPABASE_SECRET_KEY` and every browser request is proxied
through it. That design exists precisely so the key never reaches a browser.
Hosting forces the question open again, and the wrong answer puts an
RLS-bypassing key on the internet.

## The candidates

1. **Browser → Supabase directly**, with the user's own JWT, RLS doing the work.
   Fewest moving parts, and it makes RLS load-bearing — which it should be anyway.
2. **Browser → Vercel functions → Supabase**, functions holding the secret key as
   an environment variable. Mirrors today's shape, but a bug in any function is a
   full bypass, and it re-centralises the thing RLS exists to decentralise.
3. **Both**: reads direct with the user token; privileged operations (publish,
   master toggle, clearance changes) through functions.

## What a good answer settles

- The chosen shape, and the rule for which side any future endpoint belongs on.
- What the **local agent** does afterwards — it keeps the secret key for CLI work,
  but does the hosted app also still run locally, and do the two diverge?
- Where the key lives in Vercel (environment variable, per environment), and
  confirmation that it is never sent to the browser, never in a build artifact,
  never in the repo.
- What the anon/publishable key may do, since it is in the browser by definition.
  Ideally: nothing at all without a logged-in user.
