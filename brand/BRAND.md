# Oppr brand — deck reference

Mirrors the oppr.ai website ("Engineered Calm"). Source of truth for the site:
`oppr-website/src/app/globals.css` and `oppr-website/public/brand-kit/`.

## Colors

| Token | Hex | Use |
|---|---|---|
| GROUND | `#f2f2ed` | warm paper background |
| SURFACE | `#fcfbf7` | raised cards |
| INK | `#15201e` | near-black text; cover/closer background |
| MUTED | `#5f6965` | secondary text |
| LINE | `#c8ceca` | hairlines, borders |
| HUMAN | `#a65032` | terracotta — the operator's voice, THE accent |
| MACHINE | `#3e6874` | teal — the machine's voice |
| VERIFIED | `#55745e` | green — a verified result |

One accent per element. No gradients, no shadows on marks, no second accent.

## Type

- **Archivo** (variable, `brand/fonts/Archivo-var.woff2`) — headings and body.
  Headings: weight 650, line-height 1.05, letter-spacing -0.038em.
- **JetBrains Mono** (variable) — eyebrows, labels, numbers, footers. Tabular numerals.
- Wordmark: `oppr.` lowercase, Archivo 700, -0.04em, terracotta period. Never
  recolor or drop the dot.

## Voice & canonical language

- Product frame: **Operator Intelligence for manufacturing**. Tagline direction:
  "Find the improvements your machines can't see."
- The three moves (never product module names in decks): **Capture → Connect → Execute**.
  LOGS / IDA / DOCS are internal feature names — tools behind the moves, not the story.
- Engagement path: **Analyze → Prove → Scale** (historical data analysis → the
  **10-Week Proof** → annual agreement).
- Two principles: *augment, don't replace* (operators are the asset) and
  *adapt as we learn*.
- Verified reference outcomes (European plastics plant, reference call available):
  30% less scrap · 40% fewer stoppages · 5 hrs/week less reporting · 90 days
  kickoff-to-implemented-value.
- Tone: short declarative sentences, warm-technical, no hype words. European
  number format (€ 25.000 · 0,5%).

## Commercial facts (as of July 2026 — verify before each deck)

- Historical data analysis: **€ 10.000** fixed, 2–3 weeks, 100% credited against the Proof.
- 10-Week Proof: **€ 25.000** fixed, all-in; success criteria signed upfront
  (≥85% adoption, 4 wks consistent capture, ≥3 hypotheses tested, 1 action plan).
- Annual: per scope via Order Form; 50% of the Proof fee credited on conversion
  within 30 days. Three PoV outcomes only: convert / extend / wind down cleanly
  (data exported CSV/JSON, deleted in 30 days, certified).
- Compliance line: AI analysis is informational only, never touches
  safety-critical control loops (EU AI Act).

## Assets in this folder

Browse everything visually: open `img/index.html` (regenerate with
`tools\build-asset-index.ps1` after adding images).

- `assets/` — wordmark + icon SVGs (light/dark)
- `fonts/` — Archivo & JetBrains Mono variable woff2
- `img/` (root) — hero-plate.jpg (website hero), film stills
  (capture / connect-timeline / execute-loop — the capture still is the
  operator-with-phone shot)
- `img/customers/` — customer & partner logos (mutares, holliday, attero, keeeper, …)
- `img/product/` — app/product screenshots on transparent PNG, named by
  module + device: `logs-app-*` (mobile flow: schedule / round / capture /
  review), `logs-desktop-*` (floorplan, builder), `ida-laptop-*` /
  `ida-desktop-assistant` (the Industrial Operator Assistant), `docs-showcase`,
  and `platform-loop.png` (the Capture → Connect → Execute circle).

Reference decks live outside `brand/` in `references/` (e.g. the Attero PoV
proposal — the "idea in one sentence" management-level layout we mirror).
