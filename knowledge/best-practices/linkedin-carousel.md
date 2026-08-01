# Best practice — LinkedIn carousel (document post)

## Platform practices

Sources: LinkedIn Help (document posts) + 2026 marketing research; full cited
findings in `.scratch/deck-app/research/05-linkedin-formats.md` (2026-07-22).

- A carousel is a **document post**: upload a **PDF** (PPT/DOC also accepted).
  Hard caps: **100 MB, 300 pages**; one document per post; not editable after
  posting; animations flatten to static; uniform page size required; viewers can
  download the PDF.
- **Page size: 1080×1350 px (4:5 portrait)** is 2026 best practice (converged
  from older 1:1 advice, driven by mobile dwell time). **8–10 pages** typical.
  Export well under 5 MB.
- **Type floor** on the 1080 canvas: body ≥ 32 px, headlines 60–80 px. One idea
  and ≤ 35 words per page.
- The feed weights **dwell time** and **saves** (saves ≈ 5× likes). External
  links in the post body are down-ranked. Carousels are again a top
  engagement-rate format after the 2024–25 video push.

---

# The Oppr carousel playbook

Version 1.0, 2026-07-23, consolidated from two review rounds on the July 2026
three-carousel series. Everything below is how Oppr writes, not what LinkedIn is.

## A1. The brief comes first

No carousel is drafted until `brief.md` answers all six. If any answer is missing
or vague, stop and ask.

| Field | Question it answers | Example (Carousel 1) |
|---|---|---|
| Job | What is the ONE thing this carousel does? | Make the reader recognise a problem they have never named |
| Reader | Who, specifically, at what moment? | Plant/ops manager, scrolling on a phone, mid-frustration |
| Emotional payoff | What does the reader feel at the end? | "Someone finally described my Tuesday" |
| Ask | The single action requested | A comment (no product, no offer) |
| Winning signal | How we know it worked | Comment volume and specificity |
| Tension | The open question that forces the swipe | "If everyone feels it, why can nobody point at it?" |

**No tension, no carousel.** A carousel without its own tension is a brochure. If
the tension cannot be written in one sentence, the concept is not ready.

**One job per carousel.** Never stack recognise + explain + prove in one document.
A series may share a spine (repetition builds recognition, and almost nobody sees
every post), but each entry needs a distinct job, ask and winning signal.

## A2. The three archetypes

Every Oppr carousel is one of these until we deliberately add a fourth.

**The Mirror** — problem recognition. Photography register. Ask = comment.
Cover → recognition checklist → the turn → reframe → "you are not alone" → name
the problem → comment CTA.

**The Path** — approach and de-risking. Product screenshot register. Ask = a
low-friction click. Fear-based hook → "you already have half" → three moves →
phased path → reassurance chips → soft CTA. The hook must attack the reader's real
fear (adoption death), not a sales-call objection (hardware).

**The Ammunition** — proof, built to be forwarded. Industry-image register.
Ask = forward it. Assumes zero context, always carries a contact strip.
Cover → setup → three cases in a fixed shape → the pattern → method compressed →
what it takes → forwardable close.

## A3. Copy craft

- **Write for the thumb.** One idea per page, hard ceiling ~25 words of body per
  page. The headline must survive as a 300px thumbnail.
- **The cover has one job: earn one swipe.** Never spend it on logistics, page
  counts or "Part N". Tension only.
- **Recognition beats explanation.** Turn claims into questions the reader answers
  in their own head. Every symptom recognised buys the right to make one claim.
  Recognition also does sales qualification for free.
- **End every content page with a reason to swipe.** The `.loop` line is mandatory
  and must open a loop, not summarise. It must not repeat its own headline.
- **De-blame.** The failure is always the system's, never the reader's. Test every
  hinge line as a skeptical plant manager: does this describe my plant, or accuse
  me of running it badly? "Somebody already knew" is a status threat. "The answer
  was in the building by Tuesday afternoon. It just had nowhere to go" is the same
  insight without the accusation. Contrast with systems is safe; contrast with the
  reader's awareness is not.
- **Risk reversal sits directly before the CTA.** Reassurance chips are the last
  thing read before the ask, never buried mid-deck.
- **One number plus one mechanism.** Four unattributed numbers read as marketing;
  one number with a mechanism reads as true. A mechanistic qualitative outcome
  ("The buying spec changed, not the line") can beat a percentage. Do not chase
  numbers to fill a template. Multiple numbers are allowed only when the customer
  is nameable, even loosely ("a Benelux extrusion producer") plus a one-line quote.
- **Scale-of-commitment signal.** If price is removed, replace its signal in words:
  "Small enough to decide without a business case." Removing the number must not
  remove the message that this is not a capex case.
- **The post is a separate asset, not a retell.** If the post delivers the whole
  argument, nobody swipes, and swipes drive document-post reach. Post = a
  scroll-stopping first two lines before the "see more" fold + one framing
  paragraph + the ask. Target one third the carousel's word count.
- **A forwardable carousel gets a forward ask.** If the document is built to travel,
  do not close it with a lead-gen ask. You are recruiting a champion, not a lead.
  One reader per carousel: the buyer or the forwarder, never both.

## A4. Visual rules

- **Never publish customer-identifiable material.** No live IDs, named assets, site
  signage or customer UI states. **Never blur** — blur tells every prospect that we
  screenshot customer environments. Product visuals come from a demo tenant with
  plausible fictional names, or from hypothetical data.
- **Downloadable means permanent.** A carousel PDF travels without its post, cannot
  be retracted and does not expire. Entitlement is public or nothing.
- **One visual register per carousel.** Photography (Mirror), real product
  screenshots (Path), generated industry material (Ammunition). Do not mix.
- **A Mirror uses real photography or no photography.** The archetype trades on
  "I have stood where you stand", so a generated approximation of a flange or a
  sorting belt costs more credibility than the picture adds: the reader works
  next to the real thing every day and spots it instantly. Generated material is
  the Ammunition register and stays there. We own exactly one cleared plant
  photograph, so in practice a Mirror is **one image on the cover and type
  everywhere after it**. If a page needs an image to be interesting, the page is
  not written yet.
- **Never reuse an image inside one carousel.** A tile on page 05 cannot become
  the full-bleed hero on page 06. Same file, one appearance.
- **Best asset forward.** The single most striking image carries a cover, not an
  interior page.
- **Type floor applies to every label that carries meaning**, not just body copy:
  `.wtag`, `.ltrio figcaption`, `.lcontrast .lbl`, `.lcase .r .k`. Below ~26px on
  the 1080 canvas they are unreadable at feed thumbnail size, so the qualification
  work they do is thrown away. Check any new label at 320px before shipping it.
- **The naming page carries no image.** The line the reader screenshots gets an
  ink ground (`.lpage--mark`) and nothing competing with it.
- Line-art diagrams are **retired** in favour of real screenshots.

## A5. Review panel

Before build, test the draft against six lenses and answer all six under a
`## Panel` heading in `brief.md`.

| Lens | Question |
|---|---|
| Demand-gen strategist | What does this cost us if it works, and how would we know? |
| Direct-response copywriter | Does page 1 survive as a 300px thumbnail on a phone? |
| Skeptical plant manager | Is this describing my plant, or accusing me of running it badly? |
| Our future AE | Does this produce a conversation I can actually work? |
| Claims/legal | Would the customer say these numbers publicly? |
| Champion-enablement | Can someone two levels below the buyer forward this without explaining it? |

## A6. Distribution

- **Cadence:** 7–10 days between posts in a series.
- **Order by job, not narrative:** widest-reach Mirror first (comments warm the
  account) → Ammunition (converts warmth into forwards) → Path (lowest ceiling,
  best read warm).
- **Language:** English is canon. A Dutch edition of the single widest-reach piece
  is a cheap, high-signal test (Dutch named pipeline, emptier feed). Never
  translate the whole series by default.
- **Measurement per archetype:** Mirror = comment volume and specificity;
  Path = profile visits and site sessions; Ammunition = downloads, DMs, inbound
  from non-buyers.

## A7. Build and QA

Compose only from the documented blocks below, then:

```powershell
.\tools\build-carousel.ps1 -Carousel social\linkedin\<date>_<slug>
python tools\verify-carousel.py social\linkedin\<date>_<slug>   # or --all
python tools\publish-social.py       # publish to the backend: without this the
                                      # app never sees it. Then read the row back.
```

`verify-carousel.py` is the automated gate. It FAILs on: em dashes, unfilled
placeholders, customer-identifier patterns, a content page without `.loop`, a cover
carrying "Part N" or page counts, a missing or non-public image, an image without
alt text, a PDF whose page count differs from the HTML, and a PDF name without
`oppr`. It WARNs on: a body block over 25 words, a post over one third of the
carousel's word count, chips not on the page before the CTA, a forwardable carousel
whose ask is not a forward, and a PDF over 5 MB.

**Two checks a script cannot make** stay in the panel: the blame audit, and whether
a number is defensible.

### Format: 4:5 vs square

Both ship from `templates/linkedin.css`. **4:5 portrait (1080×1350) is the
default and the one to reach for.** It is the platform's own recommendation and
buys ~25% more vertical feed real estate on mobile. Nothing extra to declare.

**Square (1:1, 1080×1080)** only for a genuinely short deck: add
`class="carousel carousel--square"` and an inline
`<style>@page { size: 1080px 1080px; }</style>` after the CSS link. Square gives
each page ~780px of usable content height once the wordmark and swipe-line bands
are reserved, so a dense page will overflow it. Measure before choosing it.

### Blocks (compose, never free-style)

`.lpage--hook` (opening page) · `.lpage--full` (full-bleed image, `.bg` + `.scrim`
+ `.inner`; covers and section breaks only) · `.lpage--point` · `.lpage--mark`
(ink-ground statement page, no image, for the one line that names the thing) ·
`.lpage--cta` · `.lstat` · `.lcheck` (recognition checklist) · `.wtag` (lean-waste
tag) · `.loop` (swipe line) · `.lcontrast` (two columns) · `.lrecord` (one event,
two records: the human sentence against the stored value) · `.lcce` (numbered
ladder) · `.lchip`/`.lchips` (reassurance) · `.lband` (+ `--tall` 560px /
`--short` 260px) · `.lshot` (screenshot panel, contains rather than crops, so
portrait phone captures survive) · `.ltrio` (three captioned images) · `.lcase`
(one engagement in a fixed four-row shape) · `.lcontact` (contact strip for a
forwardable carousel) · `.sig` (wraps `.handle` + `.handle-sub` on a CTA page to
pin the signature to the same baseline the `.loop` uses; optional, and without it
both stay in flow as before).

A new pattern graduates into `linkedin.css` **before** it is used.

**Bottom furniture.** `.loop` is pinned, not flowed: on `.lpage--point` and
`.lpage--mark` it sits at a fixed baseline like the wordmark and the page number,
so the swipe line lands in the same place on every page of every carousel and the
page's own content stays optically centred above it. Those two page types
therefore reserve a top and bottom band (`padding-top` / `padding-bottom`), and
use `justify-content: safe center` so an over-full page overflows downward instead
of sliding up under the wordmark. On `.lpage--full` the loop stays in flow inside
`.inner`. If you add a page type that carries a `.loop`, give it the band too.

Note: `build-carousel.ps1` renders `index.html` straight through Chrome and does
**not** run `deckstudio.py`, so `{{icon:NAME}}` is not expanded in a carousel.
Inline the SVG from `library/icons/NAME.svg` verbatim rather than drawing a new one.

### Learnings

- 2026-07-23 — **Show the gap, do not assert it.** The `cant-put-your-finger-on-it`
  rework (`-impeccable`) replaced a page that stated its insight three times (headline,
  card, loop) with `.lrecord`: one event at 14:07, the operator's sentence beside
  the code the system actually stored (`07 · OTHER`). Recognition pages make the
  reader nod; one evidence page makes them believe. Every Mirror should carry one.
  It also earns the CTA: "I have met its cousin" only lands after we have shown we
  know what the cousin looks like.
- 2026-07-23 — **The `.loop` line never sat where it looked like it sat.**
  `.lpage p` (0-1-1) outranked `.loop` (0-1-0), so the shorthand margin cancelled
  `margin-top:auto` and every carousel in the repo centred its whole stack,
  leaving 110-140px of dead space under the swipe line. Raising specificity alone
  then jammed all content to the top and pushed the eyebrow under the wordmark,
  because a single auto margin swallows every pixel of slack. The fix is to treat
  `.loop` as pinned bottom furniture with a reserved band, plus
  `justify-content: safe center`. Lesson: when a layout looks *symmetrically*
  wrong, suspect a cancelled property, not a missing one.
- 2026-07-23 — **A Mirror cannot be told with generated images**, and we only own
  one cleared plant photograph. That is a budget fact, not a style choice, and the
  answer is fewer images rather than synthetic ones. `floor-round-overlay.png` is
  not publishable either: readable site signage plus an off-brand purple overlay.
- 2026-07-23 — **`verify-carousel.py --all` was skipping carousels.**
  `all(generator)` short-circuits, so the first failing carousel silently
  cancelled every check after it; two July-22 carousels had been unverified for a
  day. Fixed to build the list first. Lesson: a gate that stops early is worse
  than no gate, because it reports PASS-shaped output.
- 2026-07-23 — 4:5 (1080x1350) beats square for anything with normal density. The
  square July series measured a dead band on every page, so it had height to spare,
  not to fight. Keep square for genuinely short decks only.
- 2026-07-23 — Playbook v1.0 adopted (above) and `verify-carousel.py` built to
  enforce it. Building the three-carousel series produced it: the first drafts
  failed on blame ("Somebody already knew"), on a hook that answered a sales
  objection rather than the real fear (adoption death), on four unattributed
  numbers, and on posts that retold the whole carousel.
- 2026-07-23 — Pages whose only bottom element is `.loop` look half-empty; give
  them a `.ltrio`, a `.lcontrast` or a full-bleed image. A 2K generated image lands
  at 2–3 MB and must be re-encoded or the PDF passes 5 MB. A screenshot must never
  go in a `.lband`: portrait phone captures become a useless slice. Use `.lshot`.
- 2026-07-23 — Generated industry imagery for customer stories shows **material and
  process only, never people or an identifiable plant**. Generated images carry a
  SynthID watermark and must never read as a photo of the customer described. See
  the image-generation section in the root `CLAUDE.md`.
- 2026-07-22 — Reworked `book-a-data-analysis` to 8 square slides, recognition-first,
  with the visual blocks above and lean-waste tags tying symptoms to site copy.
- 2026-07-22 — First carousel (`operators-are-the-sensor`) confirmed the pipeline:
  on-screen page gap must be `@media screen` only, or blank PDF pages appear.
