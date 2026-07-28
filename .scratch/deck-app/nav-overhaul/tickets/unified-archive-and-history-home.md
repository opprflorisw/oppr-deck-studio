# Unified Archive & History home

**Type:** grilling (+ prototype) · **Blocked by:** app-role · **Status:** open

## Question

Design one coherent place for "archived things" and "older versions", covering all
four mechanisms that exist today in isolation:

- **Social outputs** — the `archived` flag + Archived filter (already built).
- **Decks & drafts** — archive/retire old decks and drafts; see prior *built*
  versions of a deck (PDFs are committed; canonical vs frozen variants exist).
- **Slides** — the git-backed version history already in the slide detail.
- **One home** — a single cross-cutting Archive/History surface vs. per-area.

To settle:
- The vocabulary: what "archive" means (hide, reversible) vs "version history"
  (git/time) — are they one feature or two?
- Whether it is a top-level area, a filter within each area, or both.
- What object types are archivable, and where the control lives per row.
- How git history generalises from slides to decks (and whether drafts get it).
