# MAP — "Welcome a colleague" output type

`wayfinder:map` · charted 2026-07-23 · owner: Floris Wyers

Tickets live in `./tickets/`. Open tickets are not listed here; the frontier is
whatever is open, unblocked and unclaimed. This file is an index: a decision lives
in its ticket and gets one line here when it closes.

## Destination

**A written spec for a new social output type: "Welcome a colleague."** Upload a
colleague's headshot plus name and role; generate an on-brand cartoon portrait of
that person (overalls, Oppr logo, recognizable features); pair it with a LinkedIn
post in the Oppr voice; and give it its own subpage in the app's Output/Create
structure. The spec covers the upload flow, the generation recipe, the image
template, the post template, where it slots into the app, the filename/verify
rules, and the consent/likeness handling. **Nothing is built inside this map.**

## Notes

**Domain.** This is a new output *kind*, unlike decks or existing social: it is
seeded from an uploaded photo of a real person, not composed from the slide
library. The app currently splits Output into Decks / Social; the user wants
subpages, so this feature also touches the Output/Create information architecture.

**What exists to build on:**

- `tools/generate-image.py` already accepts up to 14 reference images and Nano
  Banana 2 (`gemini-3.1-flash-image`) supports character/subject references, so a
  headshot-to-cartoon generation is within reach. The tool frames refs as *style*
  today; a subject/character ref may need adding.
- `brand/assets/` has `wordmark-*.svg` and `icon-bare-*.svg` for the overalls logo.
- `knowledge/best-practices/social-image.md` exists as the format's home.
- The carousel pipeline (`linkedin.css` + `build-carousel.ps1` +
  `verify-carousel.py`) is the pattern to mirror for template + build + gate.
- Two sample headshots are in `dump/` (`derek.jpg`, `sanchay.jpg`) for the
  prototype. They are transient inputs (see standing decisions), not committed.

**Standing decisions from charting** (do not relitigate without redrawing the map):

- **Generate the cartoon, template the text.** The model generates only the
  cartoon figure; "Welcome XXX", the role and branding are laid over it with an
  HTML/CSS template, exactly as carousels use `linkedin.css`. The model never has
  to spell a name. This is the repo's images-generated / text-templated ethos.
- **Consent-gated, source photos not committed.** The colleague must have OK'd a
  public welcome post before generating. The uploaded headshot is transient input,
  kept out of git (like `.env`); only the finished cartoon and post ship. A real
  employee's raw photo must not live forever in repo history.
- **Destination is a spec, not a build.** Every ticket produces a decision or a
  proven recipe; assembly of the spec is the last ticket.

**Skills to consult:** `/prototype` for the image recipe; `/grill-me` and
`/domain-modeling` for the design tickets.

## Decisions so far

<!-- one line per closed ticket -->

_None yet — charted this session._

## Not yet specified

Fog toward the destination. Graduates into tickets as the frontier advances.

- **Reusability of a generated character.** If a colleague later needs a second
  asset (a different pose, a farewell, a conference badge), is the cartoon
  regenerable to look like the same person? Higgsfield Soul-ID and Nano Banana
  character refs both bear on this; only worth charting once the base recipe works.
- **Other "team" outputs.** A welcome post may be the first of a family (birthdays,
  work anniversaries, new-role announcements) sharing the character pipeline. Out
  of this destination unless the base feature proves out, but the IA ticket should
  not paint them out.
- **Batch / multiple people.** A "welcome the new cohort" image with several
  colleagues at once. Depends entirely on how the single-person recipe behaves.
- **Non-LinkedIn placement.** The same welcome card on the website or in a deck.

## Out of scope

Ruled beyond this destination while charting. Returns only if the destination is
redrawn, and then as a fresh effort.

- **Building the feature.** This map produces the spec; implementation is a
  separate effort.
- **Restructuring all of Output.** The IA ticket decides where *this* output type
  lives and may propose a subpage split, but a full redesign of Decks/Social
  browsing is its own thing.
