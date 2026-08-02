# Deployment shape on Vercel

Type: grilling · Status: open · Blocked by: Cloud rendering, Where the secret key goes

## Question

What does this repo look like as a Vercel deployment?

## The starting shape

- `app/web/` is plain ES modules with **no build step** — that is a feature and it
  should survive. It can be served as static files.
- `app/server.mjs` is a single ~1250-line Node HTTP server with hand-rolled
  routing. Vercel wants functions, not a long-lived server.
- The server also serves `/repo/*` (read-only windows onto library images, fonts,
  design-system specimens) and `/deck-cache/*`. Neither exists on Vercel.

## What a good answer settles

- How `server.mjs` is split: one function per route group, or a single catch-all
  function that keeps the existing router intact — much less churn, and it stays
  runnable locally with `npm run dev`.
- **The app must still run locally, unchanged, for CLI work.** Whatever shape is
  chosen must not become a second implementation that drifts from the first.
- What replaces `/repo/*` — brand images and fonts move to Storage, or ship as
  static assets in the deployment.
- Preview vs production environments, and which Supabase project each points at.
  There is one project today and no staging, so "preview" would otherwise write to
  live data.
- What Vercel needs access to: this is a private repo containing the whole deck
  library and every customer's material.
