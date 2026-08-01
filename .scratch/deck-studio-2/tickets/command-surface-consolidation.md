# Command surface consolidation

Type: grilling · Status: open · Blocked by: The CLI and app handover contract

## Question

Which CLI commands survive 2.0, what is the routing rule between them, and do
they stay `.claude/commands/` files or become skills?

## Why it matters

Floris named this: "too many commands, unclear routing". Four exist:

- `/deckbuilder` — the orchestrator front door, routes to the others
- `/new-deck` — intake → proposed plan → approval gate → assemble a variant
- `/edit-canonical` — change a library slide, recipe, canonical composition or
  shared CSS, then re-verify and tag
- `/ingest-dump` — process the `dump/` inbox

Several are suspect after v3:

- `/new-deck` writes into `decks/variants/` — a location whose existence is
  itself in question (*One store of truth*).
- `/edit-canonical` ends by **git-tagging** `canonical/<type>@vN`, but masters
  are now a tag on a backend row, not a folder.
- `/deckbuilder`'s routing table predates the app having an editor, so it may
  still route one-word changes to a full rebuild.

Note that `.gitignore` excludes `/.claude/skills/`, so today skills installed in
this repo are deliberately not committed — that constrains the skills option.

## What a good answer settles

- The surviving command list, each with a one-line "run this when…".
- Whether `/deckbuilder` stays a router or becomes the only command.
- What replaces the `canonical/<type>@vN` tagging step.
- Whether the **approval gate** (an unattended run stops at the proposed plan)
  stays on every building route — it is a real safety property, do not drop it
  by accident.
- Commands vs skills: skills are model-invocable and discoverable; commands are
  explicit and currently the committed convention. Changing this changes what a
  fresh clone gets.
- Where each command's tail hands over to the app (from the handover contract).

## Evidence to gather while resolving

- `.claude/commands/deckbuilder.md`, `new-deck.md`, `edit-canonical.md`,
  `ingest-dump.md`
- `.gitignore` `/.claude/skills/`
- The resolved handover contract
