# knowledge/ — the design brain, in the open

Human-readable documents the studio reasons from and the app surfaces
(Knowledge + Config pages). These are **living**: every build run ends
by asking "anything to feed back into the brain?", and format-level lessons land
here (type-level lessons go to `types/<type>/recipe.md`).

- `design-philosophy.md` — how an Oppr slide/deck is meant to look and read.
  Rendered alongside `brand/BRAND.md` on the app's Design philosophy page.
- `best-practices/<type>.md` — one per output type (deck, linkedin-carousel,
  linkedin-post, linkedin-article, social-image, youtube-thumbnail). Fixed
  structure:
  1. **Platform practices** — researched, cited, dated facts about the channel.
  2. **How Oppr applies it** — our own rules, then a dated append-only
     **Learnings** list (newest first).

When a fact changes (a platform changes a limit, we learn something shipping),
update the relevant section and add a Learnings line with the date. Keep the
citation and the date so the next reader knows how fresh it is.
