---
description: Edit mode — change a library slide, recipe, canonical composition or shared CSS, then re-verify and tag
---

# /edit-canonical — the deliberate step across the wall

This is **Edit mode**: reworking the system itself, not personalizing a deck.
Scope you may change here: `library/slides/`, `library/design-system/`,
`types/*/recipe.md`, `decks/canonical/*/deck.yaml`, and the shared stylesheets
`templates/deck.css` / `templates/showcase.css`. (Personalizing a single deck for
a situation is `/new-deck`; frozen variants are never touched here.)

Read `SPEC.md` sections 3, 6, 8, 10b first. Then:

## 1. Name the change
State in one line what is changing and why — this becomes the commit message.

## 2. Make the edit
- **A library slide**: edit `library/slides/<id>/slide.html` (+ `meta.yaml` if
  role/tags/variables/images changed). Keep it self-contained: one `<section>`,
  `{{deck_footer}}` / `{{total}}` / `{{cover_meta}}` / `{{asset}}` placeholders,
  no one-off inline CSS.
- **The design system (composition rule)**: a slide may only use documented
  design-system blocks. If you need a new pattern, add its specimen under
  `library/design-system/<group>/<name>.html` and put its CSS in `showcase.css`
  (or `deck.css` if truly systemic) **first**, then use it in the slide.
- **A recipe / skeleton**: edit `types/<type>/recipe.md`.
- **A canonical composition**: edit `decks/canonical/<type>/deck.yaml`.

## 3. Regenerate everything the change touches
Rebuild every canonical deck that uses the touched slide(s), and refresh the
design-system specimens if CSS changed:
```
python tools/assemble-deck.py decks/canonical/product-showcase
python tools/assemble-deck.py decks/canonical/management-outlook
.\tools\build-pdf.ps1 -Deck decks\canonical\product-showcase
.\tools\build-pdf.ps1 -Deck decks\canonical\management-outlook
python tools/verify-deck.py decks/canonical/product-showcase
python tools/verify-deck.py decks/canonical/management-outlook
.\tools\build-slide-catalog.ps1        # refresh thumbnails + catalog
.\tools\build-asset-index.ps1          # if images/manifest changed
```
Do the visual per-slide pass on any changed deck. Fix and repeat until clean.

## 4. Commit and (if it is the new best version) TAG
```
git add -A && git commit -m "<the one-line change>"
```
When Floris declares this the new canonical best version, tag it — tagging is the
explicit "mark canonical" act and `data-total`/counts must already be clean:
```
git tag canonical/<type>@vN+1
```
"Look back at old versions" is then `git log`/`git show` on the fragment or the tag.

## 5. Frozen variants are untouched
Existing `decks/variants/*` are frozen snapshots; do not regenerate them. If a
variant should adopt the improvement, that is a new `/new-deck` run.

## Promotion path (library grows from real work)
When a **new** slide crafted inside a variant (`decks/variants/<slug>/slides/…`)
proves good, lift it into `library/slides/<id>/` with a proper `meta.yaml` here,
add its specimen if it introduced a pattern, and let the next deck reuse it.
