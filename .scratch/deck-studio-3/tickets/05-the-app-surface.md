# 05 — What the app shows, and whether the CLI/app boundary moves

- **type:** prototype (HITL)
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** 01, 04
- **blocks:** 10

## Question

Flag-and-accept only exists if you can see it and act on it. Design that surface,
and decide what it costs the current boundary.

- **Where does "behind" appear?** A chip on the artifact row next to the verify
  chip, a count in the sidebar, a dedicated area, or all three? The overview
  already carries page count, last change, author, note, star and a verify chip;
  one more signal has to earn its place.
- **What does accepting look like?** The side-by-side of old against new, per
  page, with accept and keep-mine. Does it print a PDF straight after, or leave
  that to the existing Download PDF flow?
- **Does picking a chapter slide move into the app?** This is the real cost.
  `CLAUDE.md` states the boundary plainly: *the CLI creates, the app changes and
  ships*, and structural changes (add, remove, reorder a page) are CLI-only,
  enforced server-side by `app/lib/htmlcheck.mjs` fingerprinting every save.
  Accepting a mother-slide update **replaces a section's content**, which today's
  fingerprint rejects. Either htmlcheck learns to allow a replacement it can
  verify came from the library, or accept is a CLI action the app merely
  *prompts*, the way it already hands you a copyable prompt when it refuses.
- **And swapping depth?** Choosing three slides from a chapter instead of one is
  add-and-remove-pages, squarely structural. If that stays CLI, chapters are a
  compose-time concept only and the app never shows them.

**Prototype:** a throwaway static mock of the overview row and the accept view.
Not wired to anything.

## Answer — closed 2026-08-04

Mock: https://claude.ai/code/artifact/27697e51-1385-486f-b453-ffdfa4757083
Source: `scratchpad/app-surface.src.html`, built in the app's own tokens from
`app/web/app.css` so it reads as the product rather than a sketch.

### The flag

Next to the **verify chip**, same position and shape. The two are the same kind of
signal asking different questions: verify says *is this deck sound*, behind says
*is this deck current*.

- A **count, not a dot**: "3 pages behind" states the size of the job without
  requiring a click. A dot makes you open a deck to discover it was one typo.
- The **row** is outlined, not the title or thumbnail: nothing about the artifact
  itself changed.
- The **sidebar count is decks behind, not pages behind.** It answers "is there
  anything to do", which is the only question a sidebar should answer.

### Accepting

**Ordinary case** (mother fingerprints equal): a confirmation screen, not a manual
merge. Pages the change touched are listed with old and new side by side; a page
where a local edit survives is marked *1 edit kept*. Per-page **Accept** and
**Keep mine**, plus **Accept all**. The footer states the safety property from
ticket 01 in the interface itself: *accepting creates version 3; version 2 and its
PDF stay exactly as they are*.

**Structural case** (fingerprints differ): a warning band above the page, both
texts shown **in full** so the local edit can be copied out rather than summarised
as "1 change", and the buttons are **Replace** and **Not now**. *Not now* leaves
the flag standing; there is deliberately no permanent detach, per ticket 04.

### The boundary moves by exactly one hole

Floris agreed with the recommendation. Accepting a master update is **allowed in
the app**: the replacement content comes from the library and the server can verify
it against the mother's content hash, so it is a swap to a known, checkable value
rather than a free-form structural edit. `app/lib/htmlcheck.mjs` gains that one
case and nothing else.

Everything else stays as it is. In particular **choosing which slides a chapter
contributes to a deck stays CLI**: that is composing a new deck, not maintaining
one, and holding that line is what keeps this to a single hole rather than a
rewrite of the boundary rule in `CLAUDE.md`.

The rejected alternative was the app flagging and the CLI accepting. Defensible,
and it moves nothing, but it sends the most common maintenance job in the system
out to a terminal.

## Reopened and revised, 2026-08-04 — the deck builder

Floris, after seeing the shipped surface:

> *"i dont see the deck builder in which i can create a new deck by choosing
> slides from my master repo"* … *"make sure that we have the deck builder tool
> there and that we can adjust current decks and add more slides if we want, and
> from the slides that we have also remove/archive slides within a chapter if we
> have 3 versions and i want to demote 2 others so that they cant be used by
> accident."*

**The decision above is overridden on one point**: composing no longer stays CLI.
Everything else in this ticket stands.

Three findings made this cheaper than the original decision assumed:

- A compose UI already existed (`app/web/js/compose.js`) and was unwired in
  Deck Studio 2.0; `main.js` deletes its button at boot.
- `/api/drafts` and `decks/drafts/` are still wired, so the app already had a
  place to put a proposed deck.
- `app/lib/jobs.mjs` already spawns Python, so the CLI toolchain was reachable
  from the app all along. The barrier assumed here was smaller than stated.

### What was built

- **`tools/build-from-recipe.py`** — the engine. compose → assemble → build-pdf →
  verify → publish, in the CLI's own order, calling the CLI's own tools. **One
  gate, not two:** verify still blocks, and a deck that fails is not published.
  Proved with a negative test (a `holliday` image on a public deck: exit 1,
  three FAILs returned, nothing published).
- **`/api/build`**, **`/api/library/chapters`**,
  **`/api/library/slides/:id/archive`**, **`/api/decks/:id/recipe`**.
- **`library_chapters`** mirror beside `library_slides`, so the picker renders
  hosted and the server never parses YAML.
- **Archiving.** Two independent reasons a slide is not pickable, deliberately
  kept apart: `retired` (the repo's flag, git-versioned) and `archived` (demoted
  from the picker). **The app still never writes `library/`** — archiving is a
  backend flag, `--sync` never un-archives, and
  `check-drift.py --apply-archives` promotes an archive into `meta.yaml` when it
  should become permanent and land in git.
- **`app/web/js/views/builder.js`** — the picker: chapters in library order,
  each slide with its `goal`, load a type's picks as a starting point, add or
  remove slides, archive or restore in place, live page count, Check-only and
  Build-and-publish.

### Verified live, not assumed

Loading the Management Outlook master's picks gave exactly 11 pages over 8 of 11
chapters with 3 skipped. Adding `eng2-outcomes` from a skipped chapter took it to
12 pages over 9 chapters. Archiving a slide blocked it and disabled its checkbox.
**Archiving a slide that was already picked removed it from the picks** rather
than silently shipping it. Check-only ran the full pipeline and passed all five
steps.

Bug found and fixed while testing: `el()` takes an HTML string, not
`(tag, className)`, so the view mounted null.

## Amended by ticket 07 (competitive scan, 2026-08-04)

The review surface is solved prior art. Figma's shape: a **badge with a count**, an
**Updates list**, **side-by-side as the default view** with an overlay toggle, and
**Update per item** plus **Update all**. Copy it rather than inventing one.

Two additions:

- **A dismissed flag must come back on every open.** Both Templafy and SlideLizard
  re-raise it. A flag you can permanently dismiss is a flag that stops meaning
  anything.
- **Highspot's precedent for the boundary is a per-role permission, not a moved
  wall.** That supports the recommendation below: widen `htmlcheck` by exactly one
  verified hole rather than relaxing the rule.

## Recommended answer to react to

Keep the boundary, widen it by exactly one hole. Accepting a mother-slide update
is allowed in the app because the replacement content comes from the library and
htmlcheck can verify it against the mother's hash, so it is not a free-form
structural edit. Everything else stays CLI, including changing the chapter picks,
which is genuinely composing a new deck. "Behind" shows as a chip on the row and a
count on the Decks area.
