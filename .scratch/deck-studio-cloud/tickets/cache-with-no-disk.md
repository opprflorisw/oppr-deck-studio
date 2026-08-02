# The cache with no disk

Type: grilling · Status: open · Blocked by: Cloud rendering

## Question

`app/.deck-cache/` is a real directory on a real disk. Serverless has neither.
What takes its place?

## Why it matters

More of the app depends on it than is obvious:

- The **editor** loads a version through `/api/decks/:id/versions/:n/view`, which
  materializes `index.html` + `assets/` to disk and serves it **same-origin** —
  the editor reaches into that iframe's DOM directly, which only works
  same-origin.
- The **printer** needs a `file://` path to hand to Chromium.
- **Thumbnails** are cached there, with Storage as the durable copy.
- `serveFile` streams from it.

## What a good answer settles

- Whether a version is materialized into a function's ephemeral `/tmp` per
  invocation (simple, cold every time), proxied from Storage through the app's own
  origin (keeps same-origin, costs a hop), or inlined so no asset fetch is needed.
- The same-origin requirement is **not negotiable**: lose it and the editor cannot
  touch the document, which is the whole product.
- What local development keeps. The disk cache is a perfectly good local
  implementation and should probably stay, behind the same interface.
