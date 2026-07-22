# Syncing the design system to claude.ai/design

The specimens in this folder are the **source of truth** — they render from the
real `templates/deck.css` + `showcase.css`, so they can never drift from what
ships. Regenerate them any time with:

```powershell
.\tools\build-design-system.ps1
```

To publish them as the **"Oppr Deck System"** project on claude.ai/design (a
browsable, always-current reference for the team, and the system that
claude.ai/design design work builds against), run the **`/design-sync`** skill in
Claude Code. It is incremental (component by component) and needs **Floris's
claude.ai login**; each write is approved in Claude's own plan step. This is an
outward-facing publish, so it is a deliberate, human-approved action — not run
automatically by the build.

Each specimen's first line carries an `@dsCard group="…"` marker so the Design
System pane groups it (Foundations / Blocks / Patterns).

## The composition rule

A new slide may use **only documented design-system blocks**. If a slide needs a
pattern that isn't here, add its specimen (and put its CSS in `showcase.css` or
`deck.css`) **first**, then use it. `/edit-canonical` enforces this.
