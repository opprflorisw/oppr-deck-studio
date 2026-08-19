---
description: Edit mode — change a library slide, recipe, canonical composition or shared CSS, then re-verify and tag
---

# /edit-canonical — the deliberate step across the wall

This is **Edit mode**: reworking the system itself, not personalizing a deck.
Scope you may change here: `library/slides/`, `library/design-system/`,
`types/*/recipe.md`, `decks/*/deck.yaml`, and the shared stylesheets
`templates/deck.css` / `templates/showcase.css`. (Personalizing a single deck for
a situation is a normal deck build; frozen variants are never touched here.)

> **v3 (edit-master).** A master now lives in the backend as a tagged deck. To
> change one structurally: `python tools/fetch-deck.py <master-slug>`, make the
> change in the fetched deck (edit the snapshot HTML, or rebuild affected slides
> from library fragments), `python tools/verify-deck.py --snapshot <dir>`, then
> `python tools/publish-deck.py <dir> --version-of <master-slug>`. Editing the
> repo `canonical/` fragments below still works as the source for a fresh publish;
> library/design-system rules for NEW slide patterns are unchanged. This is also
> how a **harvest** lands — lifting an app-side improvement back into the master.

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
- **A canonical composition**: edit `decks/<type>/deck.yaml`.

## 3. Regenerate everything the change touches
Rebuild every canonical deck that uses the touched slide(s), and refresh the
design-system specimens if CSS changed:
```
python tools/assemble-deck.py decks/product-showcase
python tools/assemble-deck.py decks/management-outlook
.\tools\build-pdf.ps1 -Deck decks\canonical\product-showcase
.\tools\build-pdf.ps1 -Deck decks\canonical\management-outlook
python tools/verify-deck.py decks/product-showcase
python tools/verify-deck.py decks/management-outlook
.\tools\build-slide-catalog.ps1        # refresh thumbnails + catalog
.\tools\build-asset-index.ps1          # if images/manifest changed
```
Do the visual per-slide pass on any changed deck. Fix and repeat until clean.

## 4. Commit and (if it is the new best version) TAG
```
git add -A && git commit -m "<the one-line change>"
```
When Floris declares this the new best version of a deck type, **publish it and
mark it master** — the `canonical/<type>@vN` git tag is retired (Deck Studio 2.0):
```
python tools/publish-deck.py decks/<type> --master --type <type>
```
`is_master` is one row per type, and the backend moves the flag off the previous
holder. "Look back at old versions" is the version timeline in the app for
content, and `git log`/`git show` on the fragment for the library.

## 5. Published artifacts are untouched
A published version is immutable; improving the library never rewrites an
artifact that already shipped. If an existing deck should adopt the improvement,
that is a new build published with `--version-of <slug>`.

## 6. Hand back to the app
Close by telling Floris where to look, so the CLI → app direction is never a
guess:

> Published. Open it at **http://127.0.0.1:4173/#/decks** to review, fine-tune
> the wording, and download the PDF.

## Promotion path (library grows from real work)
When a **new** slide crafted inside a variant (`decks/<slug>/slides/…`)
proves good, lift it into `library/slides/<id>/` with a proper `meta.yaml` here,
add its specimen if it introduced a pattern, and let the next deck reuse it.
