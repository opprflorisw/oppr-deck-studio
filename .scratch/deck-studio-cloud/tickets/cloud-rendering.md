# Cloud rendering

Type: prototype · Status: open · Frontier

## Question

Can a deck be printed to PDF in a Vercel function, at the right page size, within
the platform's time and memory limits — and what does it cost per print?

## Why it matters

Today `app/lib/jobs.mjs` spawns Chrome or Edge from `C:\Program Files`. That is
the single hardest dependency on Floris's machine. "Rendering moves to the cloud"
was settled at charting, so this is the load-bearing engineering question of the
whole map: if a 12-slide deck cannot be printed serverlessly, the destination
changes.

## What a good answer settles

- Which Chromium: a serverless-packaged build (`@sparticuz/chromium` style) in a
  Node function, Vercel's longer-running compute, or an external render service.
- Whether `--print-to-pdf` at **13.333 × 7.5 in** and **1080 × 1350 px** comes out
  matching what local Chrome produces. The verify gate checks page size to 0.02 in,
  so "close enough" is measurable, not a matter of opinion.
- Cold-start and total time for the biggest real artifact (engagement, 12 slides,
  ~1 MB PDF, bundled fonts).
- Where the fonts come from — the snapshot bundles them as `assets/`, so this
  should be self-contained, but prove it rather than assume it.
- The fallback if it does not fit: a local worker that picks up print jobs, which
  reopens "only builds when Floris's machine is on".

## How to resolve

`/prototype`. Print one real deck and one real carousel in a deployed function and
diff the output against the local PDFs (page count, page size, byte size).
