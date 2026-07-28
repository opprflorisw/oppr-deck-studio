# rendering in the cloud

`wayfinder:research` · child of `../MAP.md` · unassigned

## Question

Can the build container render the exact outputs we need, and at what cost?

`build-pdf.ps1` and `build-carousel.ps1` drive headless Chrome or Edge with
`--print-to-pdf`. Deployed, this has to run in a container.

Research and report:

- Headless Chrome on Cloud Run: memory and CPU floor, cold start, whether
  `--print-to-pdf` works under the default sandbox or needs `--no-sandbox`, and
  what that implies.
- Exact page-size fidelity. Decks are 13.333x7.5 in; carousels are 1080x1080 and
  1080x1350 px via `@page`. `verify-deck.py` FAILs on wrong page size, so any
  rendering difference between local Chrome and the container is a blocker.
- Font loading: the brand woff2 files are referenced by relative path from CSS.
- Cloud Run **jobs** versus **services** for a long build, and timeout ceilings.
- Rough cost per build and per month at, say, 50 builds a month.
- Whether PowerShell is needed at all, or the two build scripts should become
  Python or Node inside the container.

AFK. No decision required, just grounded facts.
