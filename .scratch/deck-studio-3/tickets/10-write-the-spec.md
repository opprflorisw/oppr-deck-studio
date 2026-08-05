# 10 — Write the spec (the destination)

- **type:** task
- **status:** closed 2026-08-04
- **assignee:** Claude (2026-08-04)
- **blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09
- **blocks:** —

## Question

Nothing left to decide. Write `.scratch/deck-studio-3/SPEC.md` from the closed
tickets, and hand it to one build effort.

It has to state, in the repo's own voice:

1. **The chapter model.** What a chapter is, the chapter set, and how a deck
   recipe expresses an ordered list of chapters with a pick per chapter.
2. **The refreshed slide repository.** The decided slide set from ticket 02, and
   what was retired.
3. **Propagation.** Where the recipe lives, how drift is computed, what happens to
   an app edit, what accepting does, and what it produces.
4. **The app surface**, and exactly where the CLI/app boundary now sits, since
   `CLAUDE.md` states that boundary as a rule and the rule may change.
5. **Customer decks** as master plus delta, including the entitlement interaction.
6. **The PDF fix**, with the before and after numbers.
7. **Migration**, including what is deliberately not backfilled.

Then update `.scratch/README.md` to say this map is live and what it supersedes
(exactly one map is live at a time), and note in `CLAUDE.md` what changed. Run
`python tools/check-docs.py --check`.

**This ticket writes a spec. It does not implement it.**

## Answer — closed 2026-08-04

`.scratch/deck-studio-3/SPEC.md` written, in eight sections matching the list
above plus a closing "what this does not change".

`.scratch/README.md` updated: **Deck Studio 3 is the live map**. `deck-studio-cloud`
moves to a new **Delivered** row rather than being marked superseded, because it
reached its destination (deployed on Vercel, sign-in, cloud rendering, access proved
by 17 adversarial checks) and Deck Studio 3 sits above it rather than replacing it.
Its parked fog is recorded there: custom domain, concurrent editing, whether the CLI
keeps direct backend access, and cost at rest.

`python tools/check-docs.py --check` → docs OK, 10 files.

Floris then set the goal *"execute and create in full all the setup we discussed"*,
so the build follows in this same effort rather than being handed off.
