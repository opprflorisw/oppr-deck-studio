# CLAUDE.md — Oppr deck manager

System for creating and maintaining Oppr sales/marketing decks as HTML,
fine-tuned in Claude Code, printed to PDF for sharing. Owner: Floris Wyers
(floris@oppr.ai). This folder is independent of the oppr-website repo but
mirrors its brand system.

## How it works

- One deck = one folder under `decks/`, named `YYYY-MM-DD_<audience-slug>/`,
  containing `index.html` (all slides) and the rendered PDF.
- Slides are 16:9 sections (1280×720 px) styled by the shared system stylesheet
  `templates/deck.css` (fonts, tokens, footer + automatic page counter, cover/
  closer variants, building blocks: `.cols`, `.card`, `.tag`, `.stat`, `.steps`,
  `.tbl`, `.fact-strip`, `.kicker`).
- Deck-specific CSS goes in a `<style>` block inside the deck's own HTML —
  never in `deck.css` unless it is genuinely reusable.
- New deck: copy `templates/deck-starter.html` into a new deck folder as
  `index.html`; the richest worked example is
  `decks/2026-07-21_mutares-portfolio/index.html`.

## Build & verify (MANDATORY before calling a deck done)

```powershell
.\tools\build-pdf.ps1 -Deck decks\<deck-folder>
```

Renders with headless Chrome/Edge (`@page` = 13.333in × 7.5in, no margins).
Then verify — don't claim:

1. Page count & size: `python -c "from pypdf import PdfReader; ..."` (13.33×7.5 in).
2. Visual check: headless `--screenshot` with a tall `--window-size` (height ≈
   slides × 748 px), crop per-slide with PIL, and actually look at the images —
   check text overflow, footer presence, image loading, page numbers.

## Rules

- **Footer discipline.** Every content slide carries `.slide-foot` with the
  wordmark, the deck meta line, and `.pageno` whose `data-total` matches the
  real slide count. Cover and closer have no footer.
- **Dynamic blocks.** Audience-specific content (who initiated, named
  references, "prepared for") is marked with an HTML comment
  `[DYNAMIC BLOCK — ...]` and listed in a VARIABLES comment at the top of the
  deck. When cloning a deck for a new audience, sweep those first. Named
  customer engagements may only appear in decks for audiences entitled to see
  them (e.g. Holliday/Venator only inside the Mutares family).
- **Brand + canonical language** live in `brand/BRAND.md` — colors, type, the
  Capture → Connect → Execute framing (never LOGS/IDA/DOCS as the story),
  Analyze → Prove → Scale path, verified reference stats, and current pricing.
  Verify commercial facts against Floris before reusing them in a new deck.
- **Tone.** Website copy is the register: short, declarative, concrete, no
  hype. European number formatting (€ 25.000 · 0,5%). Payback claims are
  labelled illustrative and deliberately conservative.

## Structure

- `brand/` — BRAND.md, wordmark/icon SVGs, variable fonts, and the image
  library under `brand/img/` (hero, film stills, customer logos). Visual
  contact sheet: open `brand/img/index.html`.
- `templates/` — `deck.css` (the system), `showcase.css` (shared deck-local
  styles for the Product Showcase / Management Outlook family — edit here to
  change both decks at once), `deck-starter.html` (skeleton)
- `decks/` — one folder per deck (HTML + PDF)
- `tools/build-pdf.ps1` — HTML → PDF via headless Chrome/Edge
- `tools/build-asset-index.ps1` — regenerate the image contact sheet

## Roadmap (agreed with Floris, not yet built — keep MVP until asked)

- Per-recipient deck versions with timestamps; version history
- Page-view tracking / analytics on shared decks
- Possibly a generator (deck definition → HTML) once patterns stabilize
