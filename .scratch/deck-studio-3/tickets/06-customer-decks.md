# 06 — Customer decks under the chapter model

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (2026-08-04)
- **blocked by:** 01, 03
- **blocks:** 10

## Question

A customer deck is a fourth thing beside the three masters, and the map has not
said what it is yet.

- **Is a customer deck a recipe of its own, or a master plus a delta?** Today it
  is `--derived-from` lineage plus personalization variables plus optional
  variant-local slide overrides under `decks/variants/<slug>/slides/<id>/`. Under
  chapters it could instead be: this master's chapter picks, with these
  substitutions.
- **Can a customer deck hold a slide that is in no chapter?** A Holliday-only
  page, a plant photo, a slide built for one meeting. If yes, the library stops
  being the whole story and the recipe needs an "inline slide" escape hatch.
- **Does a customer deck follow its master's chapter picks?** If the master gains
  a chapter, does every customer deck derived from it go "behind"? Or does a
  customer deck freeze its picks at derivation and only track slide *content*?
- **How does entitlement interact?** Clearance is one slug per customer, and
  `allowed_entitlements` on the deck is checked against every image. If a chapter
  holds slides at different entitlements, a pick can be illegal for a given deck.
  Does the chapter pick get filtered by clearance, and does that surface as a
  choice you cannot make, or as a verify FAIL after the fact?

That last one is live, not theoretical: the Product Showcase master is blocked
right now because `product-flow-setup` carries three `holliday`-entitled
screenshots against a `['public']` clearance.

## Amended by ticket 07 (competitive scan, 2026-08-04)

Confirming, with one warning.

The already-sent problem splits by artefact type rather than by policy: link-hosted
tools can update what was sent, file-based tools can only flag on next open. We
send files, so flag-on-open is the only honest behaviour available, which is what
charting chose anyway.

**Warning: nothing in the scan propagates a *structural* change into an
already-built deck.** Every shipped tool tracks slide content and leaves deck
structure alone. That makes the recommendation below (track content, freeze chapter
structure at derivation) the industry-standard split rather than a compromise, but
it also means there is no prior art to lean on if we ever want the other thing.

## Amended by ticket 03 (the chapter model, 2026-08-04)

Chapter picks are **suggested, never restricted**: a customer deck gets a
recommended set for its type and can then take any slide from any chapter,
including one no other deck uses.

**This does not extend to entitlement.** The last bullet of the question above
asked whether an illegal pick should be prevented at compose time or caught by
verify. Ticket 03's "no restrictions" answer is about narrative fit, so the answer
here is now: **suggest freely, and leave the clearance check hard and mechanical.**
`allowed_entitlements` still FAILs a deck naming a customer it is not cleared for.
Confidentiality is not a storytelling preference.

Optionally the picker can *mark* a slide as out of clearance while still letting it
be chosen, so the failure is visible early rather than at the gate. That is a
convenience, not a rule.

## Answer — closed 2026-08-04

Settled on the recommendation, with ticket 03's suggestion/restriction split
applied.

**A customer deck is master plus delta.** It records the master and version it was
derived from (`derived_from_deck_id` + `derived_from_version_n`, both already on the
`decks` row), its chapter picks as overrides on that master's picks, and its
variable values.

**It tracks slide content, not chapter structure.** A wording fix on a mother slide
reaches it, because that is the whole point of the map. A *new chapter* on the
master does not silently appear in a deck already sent. This is also what every
tool in the ticket 07 scan does: none of them propagates a structural change into
an already-built deck.

**Inline customer-only slides are allowed**, and live in the recipe rather than the
library. A Holliday-only page or a plant photo should not become a library slide
that everyone else can pick.

**Entitlement stays hard.** Chapter picks are *suggested* freely per ticket 03, and
nothing narrative is refused, but `allowed_entitlements` and the image clearance
check in `verifylib.py` still FAIL a deck naming a customer it is not cleared for.
The picker may **mark** an out-of-clearance slide so the failure is visible early,
but that is a convenience, not a gate: the gate is the verify run.

That distinction is live rather than theoretical. The Product Showcase master is
blocked right now because `product-flow-setup` carries three `holliday`-entitled
screenshots against a `public` clearance.

## Recommended answer to react to

Customer deck as **master plus delta**: it records the master and version it was
derived from, its chapter picks as overrides on that master's picks, and its
variables. It tracks slide *content* (so a wording fix reaches it) but **not**
chapter structure (a new chapter on the master does not silently appear in a deck
already sent). Inline customer-only slides are allowed and live in the recipe, not
the library. Chapter picks are filtered by clearance at compose time so an illegal
pick cannot be made, with the verify gate kept as the backstop.
