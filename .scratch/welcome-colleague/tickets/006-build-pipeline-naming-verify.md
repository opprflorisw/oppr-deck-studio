# build pipeline naming verify

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001` · `005` · `002`

## Question

How does the CLI assemble a welcome output end to end, and what are its naming and
verify rules?

Mirror the carousel pipeline (`build-carousel.ps1` + `verify-carousel.py`). Define:

- The build steps: generate cartoon -> render template to PNG (single image, so PNG
  not PDF) -> land it in the output folder.
- The **filename rule**: every artifact carries `oppr` (the standing repo rule);
  what else - the person's name? `verify` must enforce it, like `deck_pdf_name.py`
  does for decks.
- What a **verify gate** checks for this kind: correct canvas size, wordmark
  present, no em dashes in the post, the consent record exists, entitlement is
  public (a staff cartoon is public-facing but is a real person - confirm it is not
  named-customer-gated).
- How it plugs into `/deckbuilder` and the app's hand-off.

Blocked by: cartoon recipe · image template · output IA.
