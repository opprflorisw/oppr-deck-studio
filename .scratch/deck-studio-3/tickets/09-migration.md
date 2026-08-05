# 09 — What happens to everything already published

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (2026-08-04)
- **blocked by:** 01, 02, 03, 04
- **blocks:** 10

## Question

Seven decks are already published, and none of them has a recipe:

| slug | master | version | type |
|---|---|---|---|
| `engagement` | yes | v4 | engagement |
| `management-outlook` | yes | v2 | management-outlook |
| `product-showcase` | yes | v1 | product-showcase |
| `2026-07-22_teaser-demo` | no | v1 | management-outlook |
| `2026-08-01_wavin-rnd` | no | v2 | product-showcase |
| `2026-07-23_investor-update-post-round` | no | v1 | investor-update-post-round |
| `proposal` | no | v1 | proposal |

Plus the social artifacts, which share the `decks` table but have no library
parentage at all.

Decide:

- **Are recipes backfilled or not?** Every published version stamps
  `data-slide-id` on each `<section>`, so a recipe can be reconstructed from the
  HTML. But ticket 02 is going to retire some of those slide ids, so a backfilled
  recipe may point at slides that no longer exist.
- **What does a retired slide id mean?** If `eng2-opportunity` wins and
  `eng-opportunity` is retired, the published `engagement` v4 still references the
  retired one. Is it a tombstone that keeps the old content, a redirect to the
  winner, or is the reference simply allowed to dangle because the version is
  immutable HTML that renders fine either way?
- **Do the three masters get republished on the new model,** as a v5 / v3 / v2, or
  does the model only apply to decks built from here on?
- **What about the two non-master decks derived from masters** (`teaser-demo`,
  `wavin-rnd`)? They are what customer decks will look like under ticket 06, so
  they are the migration's real test case.
- **Do social artifacts get a null recipe, or stay outside the model?**

## Amended by ticket 07 (competitive scan, 2026-08-04)

If ticket 02 marks refresh losers **retired rather than deleted** (SlideLizard's
"outdated" release status), the dangling-reference question above largely
evaporates: a retired slide id still resolves, it just cannot be picked into a new
deck. Confirm 02's decision before spending time on tombstones and redirects.

Also relevant: **no tool in the scan stores a recipe at all.** Parentage lives per
page inside the file, and "is this deck behind" is answered only by opening it.
That is precisely today's position, so backfilling nothing leaves us no worse off
than the entire market.

## Answer — closed 2026-08-04

Settled on the recommendation.

**Backfill nothing.** Recipes exist from the first publish on the new model. A
version with no `recipe` shows no drift flag, which is honest: we genuinely do not
know what it was composed from at chapter level. Reconstructing one from
`data-slide-id` would be guessing, and ticket 02 retired 21 of those ids, so a
backfilled recipe would point at slides that are no longer pickable.

**Dangling ids are fine.** Ticket 02 decided losers are **retired, not deleted**, so
every id in old HTML still resolves to a slide that can explain itself. A published
version is immutable rendered HTML and does not need its parents to be current.

**The three masters get republished deliberately**, once the library apply lands, so
they are the first clean examples on the new model: `engagement` v5,
`management-outlook` v3, `product-showcase` v2. Not a migration script, a rebuild.

**The two derived decks** (`2026-07-22_teaser-demo`, `2026-08-01_wavin-rnd`) are left
alone. They are exactly what ticket 06 describes as customer decks, and they are the
real test case, but rebuilding a deck already sent is precisely what this map spent
its time preventing. They gain recipes only if and when they are next republished.

**Social artifacts keep a null recipe.** They have no library parentage at all, so
the column stays empty and the drift query never returns them.

**One consequence to plan for.** `eng-proof` was in all three masters and is retired,
so all three need `outcomes-reference` plus `evidence-quotes` in its place. That is
already covered by the rebuild above, but it is the reason the rebuild is not
optional.

## Recommended answer to react to

Backfill nothing. Recipes exist from the first publish on the new model; a version
with no recipe is simply pre-model and shows no drift flag, which is honest. Slide
ids in old HTML are allowed to dangle, because a version is immutable rendered HTML
and does not need its parents to survive. Republish the three masters on the new
model as a deliberate act once the slide refresh lands, so the masters are the
first clean examples. Social artifacts keep a null recipe.
