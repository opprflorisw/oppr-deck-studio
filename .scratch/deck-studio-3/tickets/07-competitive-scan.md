# 07 — What other tools do about this (competitive scan)

- **type:** research (AFK)
- **status:** closed 2026-08-04
- **assignee:** research agent (claimed 2026-08-04)
- **blocked by:** —
- **blocks:** 10

## Question

Floris, 2026-08-04: *"also have a look on the Internet for different other tools
trying to do the same and what their functionality is and they provide more than
what we can do."*

Every one of the decisions on this map has been made before by someone shipping a
deck tool. Find out how, and specifically find the things we have not thought of.

Cover at least: **Pitch**, **Tome**, **Beautiful.ai**, **Storydoc**, **Qwilr**,
**Highspot** and **Seismic** (sales enablement, which is closest to the actual job),
**Google Slides / PowerPoint master layouts and Designer**, **Figma slide
components**, and whatever else the search turns up.

For each, answer:

1. **Component model.** Is there a reusable slide/block library, and what is the
   unit: a layout, a whole slide, a block within a slide?
2. **Propagation.** When the source changes, what happens to decks already built
   from it? Automatic, flagged, or never? Do they show a diff?
3. **Overrides.** Can you edit an instance, and what happens to that edit when the
   source changes? This is ticket 04's question, already answered by Figma's
   detach/override model and by PowerPoint's layout inheritance. Report how each
   resolves the conflict.
4. **Depth selection.** Does anything support "the long version and the short
   version of this section", which is ticket 03's chapter idea?
5. **Sharing.** Link versus file, and what analytics come with a link. Recorded
   as out of scope for this map, but note what we would be giving up.
6. **What they do that we cannot**, and what we do that they cannot.

## Output

A findings document at `research/07-competitive-scan.md`, with the
resolution comment on this ticket carrying the six-line summary. Cite sources.
Flag anything that would change a recommendation already written on tickets 01 to
06, by ticket number.

## Answer

Findings: [`research/07-competitive-scan.md`](../research/07-competitive-scan.md)

1. **Flag-and-accept is the mainstream answer.** Figma, Templafy, SlideLizard,
   empower, Highspot Smart Update, Google Slides linked slides and the retired
   SharePoint slide library all notify and let a human accept, per item.
2. **Automatic propagation exists only where nothing was ever sent.**
   Beautiful.ai, Shufflrr and DIGIDECK overwrite silently, and DIGIDECK sells it
   as reaching "presentations sent months ago". That is the trade charting rejected.
3. **There are four override models, not three.** Detach (empower drops a kept
   slide from its update group forever), override (Figma, per property), block
   (Templafy locked slides), and **keep both** (Templafy unlocked and SlideLizard
   "Insert Copy" insert the new page beside the old and mark the old outdated).
4. **Overrides survive only on stable identity.** Figma retains them by matching
   layer names and loses them when a name changes, so our per-element accept needs
   an element id in the slide fragment, not a position.
5. **Nobody ships chapters.** The nearest primitives are PowerPoint Custom Shows
   (a named subset of one deck) and Seismic LiveDocs (rules on slides driven by a
   questionnaire). Both are worth recording as considered and rejected.
6. **Nobody stores a recipe either.** Parentage lives per page inside the file, so
   every tool answers "is this deck behind" only by opening it. A versioned recipe
   row buys the server-side drift query none of them has.
