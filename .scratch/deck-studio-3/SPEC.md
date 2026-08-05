# Deck Studio 3 — chapters and mother slides

**Status: live.** Supersedes `.scratch/deck-studio-2/MAP.md`.
Written 2026-08-04 from the Wayfinder map at `MAP.md`, whose twelve
decision tickets hold the reasoning and the evidence for everything below.

## The problem this solves

Update a slide in one deck and the other decks keep the old wording. Three masters
had drifted into three near-copies of the same library, the same customer story was
told on three different slides, and one slide claimed Step 3 was "convert or wind
down" while another claimed it was "scale to the next site". There was no way to
ask which decks used a given slide, and no way to be told when one fell behind.

Two smaller problems travelled with it: the PDFs were heavy and scrolled badly, and
the cover was so dark the operator in the photograph had disappeared.

## 1. The library: chapters over slides

`library/chapters.yaml` declares the ordered chapter list and, in each chapter, the
ordered slides that belong to it:

```yaml
- id: ch-engagement
  title: The engagement
  purpose: The three steps, in order.
  slides: [engagement-ladder, eng2-step1, eng2-step2, step3, eng2-plan, eng-criteria]
```

Membership and order live in **one file**, so the library's shape is readable at a
glance and exclusivity is structural rather than a rule anyone has to enforce.
`tools/check-docs.py` gains one check: every slide appears in exactly one chapter,
and every id resolves.

**`role` on `meta.yaml` is not renamed and not merged into this.** Role is a
**render contract** — `verify-deck.py` enforces footer discipline by it, so `cover`,
`closer` and `cta` carry no footer. Chapter is an **authoring grouping**. They agree
today by coincidence; merging them would couple the verify gate to the chapter set.

**No slide has length variants.** Depth is chosen per chapter: a chapter holds
slides at different depths and a deck picks. A slide covering the ground of three
others is not marked as a summary, it is simply another slide in the chapter.

**Intent metadata** goes on each `meta.yaml`, because a suggestion is impossible
without it:

```yaml
goal: State what Oppr does in a sentence a person can repeat.
why:  Use immediately after the cover in every deck.
with: [cover, platform-cce]
```

### The chapter set

Eleven chapters over 26 slides, in reading order: `ch-open` · `ch-idea` ·
`ch-problem` · `ch-platform` · `ch-evidence` · `ch-engagement` · `ch-decision` ·
`ch-commercials` · `ch-company` · `ch-close` · `ch-annex`.

The set is expected to **grow**. A chapter used by exactly one deck type is normal,
not a smell, so chapter ids must never encode position.

## 2. The recipe

A deck recipe is **chapters and nothing else**: an ordered list of chapters, each
with the slides chosen from it. A deck may **skip a whole chapter**, which drops
every slide under it. There are no conditions and no rules engine.

**Rules are suggestions, never constraints.** `types/<type>/recipe.md` carries the
picks that *typically* belong in that deck type, as a YAML block inside the existing
prose. That produces a recommended pick. Any slide can go in any deck; nothing
narrative is ever refused.

### Where it lives

The recipe was never actually missing: `tools/snapshot.py` already embeds a
`deck-meta` JSON block with the ordered slide ids in every published version. What
was missing is that it is not queryable.

- **`deck_versions.recipe`** (JSONB), written at publish, holding per page
  `{chapter, slide_id, content_hash}` plus deck-level type, client and clearance.
- The embedded `deck-meta` block **stays** and becomes the independent cross-check:
  verify FAILs when the column and the rendered HTML disagree.
- **`deck.yaml` is input only.** Nothing reads it back; it gains a `chapters:` key
  and remains the CLI's input format.
- The recipe belongs to the **version**, which is immutable. Accepting an update
  naturally produces a new version with a new recipe.

## 3. Propagation: flag and accept

Editing a library slide flags every deck whose current version uses it. **Any
change flags** — there are no severity tiers and no separate "publish this slide"
step, because a change you forget to promote is exactly today's failure.

Drift is a **content-hash comparison**: the recipe records the library slide's hash
as published, and drift is `current hash ≠ stored hash`. No library version
numbering, no migration of `library/`.

### The safety property, which the build may not break

A flag means **the next version of this deck would differ**. It is a statement about
the future, never an edit to the past.

- A flag **never mutates** a published version, its HTML, or its PDF.
- A deck already sent stays **byte-identical** until accepted.
- Accepting creates a **new version**; the old version and its PDF stay valid,
  shareable and downloadable.

### What accepting does

`app/lib/htmlcheck.mjs` guarantees the tag stream is byte-identical across every
version of a deck, so **position in that stream is already a stable element
identity**. No element ids are needed anywhere.

Compare `fingerprint(mother_old)` against `fingerprint(mother_new)`:

- **Equal** (text-only upstream, the common case): **merge by position**. Positions
  never edited take the new wording; edited positions keep their text and are listed
  as kept.
- **Different** (structural upstream, CLI-only): no safe merge. **Replace the
  page**, listing every local edit that will be discarded, with old and new text in
  full so it can be copied out first.

There is deliberately **no permanent detach**: a page that stops being flagged keeps
its old wording for ever, which is the failure this spec exists to remove.

## 4. The app surface

- The flag sits **next to the verify chip**, same position and shape. Verify asks
  *is this deck sound*; behind asks *is this deck current*.
- It is a **count, not a dot**: "3 pages behind" states the size of the job without
  requiring a click.
- The **sidebar counts decks behind**, not pages.
- Accepting is a confirmation screen: per-page **Accept** / **Keep mine**, plus
  **Accept all**, and the footer states that the previous version and its PDF are
  untouched.
- A dismissed flag **returns on every open**.

### The boundary moves by exactly one hole

`CLAUDE.md`'s rule stands: the CLI creates, the app changes and ships. One case is
added to `htmlcheck.mjs` — accepting a master update — because the replacement
content comes from the library and the server can verify it against the mother's
content hash. It is a swap to a known, checkable value, not a free-form structural
edit.

### The deck builder (revised 2026-08-04)

Composing was going to stay CLI. It does not: the app has a **Deck builder** that
picks slides chapter by chapter, adds slides to an existing deck, and archives
slides so they cannot be chosen by accident.

**One gate, not two.** `tools/build-from-recipe.py` runs compose → assemble →
build-pdf → verify → publish, calling the CLI's own tools in the CLI's own order,
and the app shells out to it. A deck built in the app is indistinguishable from one
built by hand, and **verify still blocks**: entitlement, placeholders, em dashes,
footers and geometry are not suggestions.

**Two independent reasons a slide is not pickable**, kept apart on purpose:

- **`retired`** — the repo's flag in `meta.yaml`, git-versioned, set by the CLI.
- **`archived`** — demoted from the picker by a person, so it cannot be chosen by
  accident. The app never writes `library/`, so this is a backend flag on
  `library_slides`. `check-drift.py --sync` never un-archives, and
  `--apply-archives` promotes an archive into `meta.yaml` when it should become
  permanent. Git stays the durable record.

Archiving a slide that is **already picked removes it from the picks**: a demotion
that silently left the slide in the deck would be worse than no demotion.

`library_chapters` mirrors `library/chapters.yaml` beside `library_slides`, so the
picker renders hosted and the server never parses YAML. The repo stays the source
of truth; both tables are derived.

**Chapter order seeds the deck; it does not constrain it.** The recipe carries an
explicit `order` (the deck as it will actually read) alongside `chapters` (which
chapter each pick came from). Chapter order is used to place a newly ticked slide
sensibly, and after that the order is Floris's. A slide picked but missing from
`order` is appended rather than silently dropped. The recipe still reads as
chapters, so the drift query is unchanged.

**The picker shows the slides, not just their ids**: a thumbnail per slide from
`library/slides/<id>/thumb.png`, and a click opens a **live preview** — the real
fragment rendered through `templates/deck.css` in a scaled iframe, the same
`preview.js` the Library uses — beside the slide's goal, notes, entitlement and
where it is already used.

**A published deck is linked, not just announced.** The builder reports where it
landed: version, slug, page count, a link into the deck and a Download PDF that
prints on demand. The deck list is refreshed so it is there when you follow it.

### The builder rework, 2026-08-04

Floris, on the first shipped builder: *"it's now not completely clear what the
flow is"*, and *"the only way to create a new version is if you open an existing
deck and then you add a slide to it"*. Five changes, one idea.

**The builder is bound to a deck.** `#/build` chooses one; `#/build/<deck-id>` is
that deck; `#/build/draft/<local-id>` is one that does not exist yet. This is what
makes the version rule structural instead of advisory:

- a blank form is a **new deck**, always **v1**, and can never become a version
  of anything;
- opening a deck is always **its next version**, with the recipe pre-loaded;
- **slug, client and clearance are inherited and read-only**. A version that
  could re-pick the client or widen `allowed_entitlements` would be a way around
  the entitlement gate, not a version of the same deck;
- a variant is **Save as a new deck** (sets `derived_from`), not a version.

The `version_of` form field is **deleted**. It let you conjure v4 of a master
from a blank page with a slide set unrelated to v3.

**The recipe has to round-trip, so it is schema 2**: `order` and `vars` join
`chapters`. Without them, reopening a deck silently re-sorted it and blanked its
footer, and verify would not catch either — an empty footer is still a footer.
Recipes written at schema 1 are recovered from the published document itself
(`varsFromHtml` / `orderFromHtml`), so no already-published deck is stranded.

**The workspace is a slide sorter.** The grid *is* the deck, dragged into the
order it will present; chapters collapse into an add-rail. Everything that is not
"which slides, in what order" moves behind Deck details, and the change note
moves to the publish dialog where it belongs.

**Preview shows what will print** — the deck's own footer and the real page
number, by seeding `counter-reset: slide n` on the `.deck` wrapper — and it can
be reordered in place, because the moment you notice a page is wrong is the
moment you should be able to move it.

**Clearance is enforced while you pick, not at the gate.**
`library_slides.entitlements` mirrors the set of clearances a slide's images
require, derived with the *same* manifest key `verifylib._check_images` uses, so
the picker and the gate cannot disagree. Before this the builder could only make
public decks: there was no field for `client` or `allowed_entitlements` at all.

**A build is a job.** `build-from-recipe.py` emits one JSON line per step as it
runs them and the app renders exactly those five gates. A 40-second wait behind a
disabled button does not say which gate you are standing at.

**Composing is saved as you go**, in `decks.draft_recipe` — server-side, so it
survives a reload and is not trapped in one browser. A draft is **never a
version**; the published deck and its PDF are untouched until you publish, and
both the deck list and the deck page say *unpublished changes* so it cannot be
forgotten.

**A new slide stays a CLI job**, because it must compose only from documented
design-system blocks and the app never writes `library/`. What the app does is
write the prompt precisely: the chapter it must land in, that chapter's purpose,
the slides already in it, and the exact follow-up commands
(`build-slide-catalog.ps1`, `check-docs.py --check`, `check-drift.py --sync`).
Once the CLI has filed it and synced, it appears in the picker.

**Building needs the repo on disk**, so it is local-only for now. Hosted, the app
returns `ENOREPO` and hands back the CLI prompt, the way it already does for
structural edits.

## 5. Customer decks

**Master plus delta.** A customer deck records the master and version it derives
from (`derived_from_deck_id` + `derived_from_version_n`, already present), its
chapter picks as overrides on that master's picks, and its variable values.

It tracks slide **content**, not chapter **structure**: a wording fix reaches it, a
new chapter on the master does not silently appear in a deck already sent.

**Inline customer-only slides are allowed** and live in the recipe rather than the
library, so a one-meeting page never becomes something everyone can pick.

**Entitlement stays a hard gate.** Picks are suggested freely, but
`allowed_entitlements` and the image clearance check still FAIL a deck naming a
customer it is not cleared for. Confidentiality is not a storytelling preference.
The picker may *mark* an out-of-clearance slide so the failure shows early; the gate
is still the verify run.

## 6. The story check

`tools/check-story.py` reads the recipe **and** the assembled HTML and reports on
coherence: two slides making the same point or contradicting each other, a promise
never paid off, a chapter skipped that this type usually includes, a slide whose
`with:` companions are absent, ordering that breaks the argument.

It emits structured findings (`slide_id`, `kind`, one sentence), rendered as prose
in the CLI. **It never blocks and exits 0 always**, and says so in its own output.
With no API key it prints one line and exits 0.

It is a **separate tool from `verifylib.py` on purpose**. Verify is mechanical,
deterministic and blocking. This is a judgement. One tool would make a judgement
look like a rule and would put a model in the path of every build.

## 7. The PDF: light, and fast

Two independent causes, both measured on the 18-page Product Showcase.

**Type 3 fonts cost bytes.** Chrome cannot serialise a variable font into a PDF and
emits Type 3 glyph procedures instead: 57 objects across 18 pages. Fix: commit ten
**static instances** to `brand/fonts-static/` and point `deck.css` and
`linkedin.css` at them, keeping the variable fonts for screen and the brand kit.
Adds `fontTools` and `brotli` to `requirements.txt`, where they were already an
undeclared dependency of the brand kit.

**The cover scrim costs time.** `.scrim` stacks three full-bleed gradients that
Chrome writes as per-pixel shading functions: page 1 costs 2.671 ms against 70 to
130 ms for every other page. Fix: apply the lighter `.cover--open` values — which
already existed and left the library with the two retired covers — and **bake them
into the hero image** at export.

| | bytes | fonts | 18 pages | page 1 |
|---|---|---|---|---|
| today | 2.868.605 | 57 Type 3 | 4.714 ms | 3.083 ms |
| both fixes | 2.220.311 | 8 Type 0 | **1.643 ms** | **132 ms** |

**22,6 % smaller, 2,9x faster.** The cover also gets lighter: the right half of the
photograph rises from 27/255 to 37/255 mean luminance, so the operator, the phone
screen and the pipework are readable again.

The composite is generated by a tool at the slide's aspect and crop
(`object-fit: cover`, `object-position: 72% 38%`), with the gradient recipe kept in
the repo so it stays reproducible. The cost, accepted: the scrim is no longer a CSS
value you can nudge.

## 8. Migration

**Backfill nothing.** Recipes exist from the first publish on the new model. A
version with no recipe shows no drift flag, which is honest.

**Retired, not deleted.** The 21 slides retired by the refresh stay on disk, so
every id in already-published HTML still resolves. They cannot be picked into
anything new.

**The three masters are rebuilt, not migrated** — `engagement` v5,
`management-outlook` v3, `product-showcase` v2 — so they are the first clean
examples. This is not optional: `eng-proof` was in all three and is retired, so all
three need `outcomes-reference` plus `evidence-quotes` in its place.

**The two derived decks** (`2026-07-22_teaser-demo`, `2026-08-01_wavin-rnd`) are
left alone. Rebuilding a deck already sent is what this spec exists to prevent.

**Social artifacts keep a null recipe.** No library parentage, never returned by the
drift query.

## What this does not change

The one artifact model (`kind` + `page_format`), the single verify gate, the
immutable version history, PDF naming and the freshness rule, entitlement and
clearance, secrets handling, and "nothing is done until it is in the backend". This
spec adds a layer above the library and a column beside the version. It replaces
none of them.
