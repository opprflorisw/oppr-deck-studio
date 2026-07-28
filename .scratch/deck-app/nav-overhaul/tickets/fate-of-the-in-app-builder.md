# Fate of the in-app builder

**Type:** grilling · **Blocked by:** app-role · **Status:** open

## Question

The **Create** area and its machinery are candidates for removal. For each, decide
remove / repurpose / keep-read-only:

- **Deck drafts** composer (slide strip, intent rail, hand off).
- **Social studio** composers (carousel / post / brief).
- **Compose mode** toggle (top bar) + the **draft tray** + per-slide "+ Add to
  draft" buttons.
- The server endpoints and staging they use (`decks/drafts/`, `social/drafts/`).

Consider migration: does any of this fold into *Company intake via the dump
folder*, or is picking/cherry-picking slides still valuable as a "brief" the CLI
consumes? What happens to existing saved drafts on disk.
