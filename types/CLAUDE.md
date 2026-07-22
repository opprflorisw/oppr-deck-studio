# types/ — deck-type recipes (the living brain)

One folder per presentation type; `recipe.md` is its reusable brief. This is the
intent layer the `/new-deck` intake reads to know what to ask and what skeleton to
propose.

## recipe.md shape

- **Frontmatter**: `type`, `goal`, `audiences`, `default_language`,
  `default_length`, `presenter`, `entitlement_default`, `canonical` (path to the
  master), optional `derived_from` (if it is a trim of another type).
- **Skeleton table**: `# · role · default slide id · required · note` — the
  ordered shape, referencing slides by role/id.
- **Intake questions**: what to ask fresh vs. what the recipe fixes.
- **Learnings**: append-only, newest first — what worked, per this type.

## Recipe vs. instance

The **recipe** (here, reusable) is the template. The **brief** for one specific
deck (`decks/variants/<slug>/brief.md`) is the filled instance: this audience,
this client, this language. Recipe = template; brief = one deck's contract.

## The living brain (memory tie-in)

- **Per-type** lessons append to that recipe's `## Learnings`.
- **Cross-cutting** style lessons (register, type sizes, "no em dashes") go to
  Claude's `memory/` (e.g. `deck-management-level-style.md`), not here.
- After every finished deck, `/new-deck` asks "anything to feed back into the
  brain?" — that closing question is what keeps this living rather than a folder.

## Adding a new type

Create `types/<slug>/recipe.md` by interviewing, seeded from the closest existing
recipe. Keep the register consistent with `brand/BRAND.md` and the management-level
style memory.
