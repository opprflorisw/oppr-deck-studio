---
type: engagement
goal: 'Explain how getting on board works. Not an offer: a document that describes the stepwise
  path from the data a plant already has to a verified case for improvement: what each step
  produces, what it costs, and how the scope of the next step comes out of the one before
  it. The reader should finish knowing what would happen, and should not feel asked to sign
  anything.

  '
audiences:
- operations leaders
- plant management
- process experts
- project sponsors
- and the people they forward it to (controllers
- procurement)
default_language: en
default_length: 12 slides (v4, current). v1 was 19; all versions stay in the history.
presenter: Floris (Founder & CEO) unless specified
entitlement_default: public
derived_from: product-showcase
picks:
  ch-open:
  - cover
  ch-idea:
  - eng2-idea
  ch-problem:
  - eng2-opportunity
  ch-evidence:
  - outcomes-reference
  ch-engagement:
  - engagement-ladder
  - eng2-step1
  - eng2-step2
  - step3
  - eng2-plan
  - eng-criteria
  ch-decision:
  - eng2-outcomes
  ch-commercials:
  - eng-investment
  ch-close:
  - eng-next-step
  - back-cover
  ch-annex:
  - eng-annex-a
  - eng-annex-b
skips:
- ch-platform
- ch-company
---

<!-- picks/skips are the SUGGESTION for this deck type (Deck Studio 3, SPEC §2).
     They are never a restriction: any slide can go in any deck. The deck's actual
     picks are deck_versions.recipe in the backend. -->

# Engagement — recipe

**How we work together.** Sent after the Product Showcase has landed, to a
prospect who believes the idea and now wants to know what actually happens.

## Where it sits in the document flow

| Stage | Buyer's question | Document |
|---|---|---|
| Attract | is this relevant to me | LinkedIn carousel / article |
| First meeting | who are you, why should I care | **Product Showcase** (20 sl.) |
| Qualified interest | what happens at my plant, what does it cost, how do we decide | **this deck** |
| Commitment | legal terms | the Proof of Value document / SOW (Annex A) |
| Conversion | procurement | Order Form, MSSA, DPA, SLA, AUP, TOMs, NDA (Annex B) |

**It is not a proposal.** No signature block, no acceptance language, no "we
propose". It says what would happen and what it would cost, and lets the reader
decide whether to start the Analyze. The commercials stay in (a reader who
cannot see the price cannot evaluate the process) but they sit in the step bands
and on the path slide, not on a slide of their own. Payment terms are not in the
slim cut at all.

**The overlap rule.** It is forwarded to people who never saw the showcase, so
it must survive standalone, but it must not re-run the pitch. Repeat compressed,
one slide each: the opportunity, the idea in one sentence, the track record.
Never repeat `recognize-problems`, `when-time-matters`, either `product-flow`
slide, `kpi-payback`, `running-projects` or `who-is-oppr`.

## Vocabulary (locked)

A document whose job is explaining a process cannot use two names for the same
thing. Fixed 2026-07-30:

| use | never |
|---|---|
| **Analyze**, **Prove**, **Scale** (the three steps) | "phase" |
| **Proof of Value** on first use, **the Proof** after | "10-Week Proof", "PoV" in body copy |
| ten weeks as an *attribute* ("ten weeks on one line") | "the ten-week Proof" as a name |
| **Step 1 / Step 2 / Step 3** | "Gate 1 / Gate 2" outside the timeline slide |

`gate` survives only on `eng-plan`, where it labels the two blocks of the
timeline and describes a decision moment rather than a step.

> **Open:** the Product Showcase still says "10-Week Proof" in
> `engagement-ladder` and `step2-prove`. Aligning it means republishing that
> master. Not done; decide before the two documents go out together.

## Two states of the same deck

The master and a customer copy are the same composition with different variable
values. The Analyze deliverable is what turns the slots into values.

| | **v0 · pre-Analyze** (the master) | **v1 · post-Analyze** (per customer) |
|---|---|---|
| scope | described by pattern | the named line and log points |
| hypotheses | "three or more, named in the Analyze" | the three, written out |
| criteria | by type, with target ranges | agreed values |
| payback | deliberately absent | the customer's own numbers |
| dates | relative weeks | real calendar dates |

Slots: `prepared_for`, `scope_line`, `start_target`. A named-customer copy also
needs `client:` in deck.yaml and `allowed_entitlements` clearance.

## Versions

All live in the backend under slug `engagement`; the master pointer is on v4.

| | slides | register | when to use |
|---|---|---|---|
| **v1** (`eng-*`) | 19 | thorough, near-proposal: signed criteria, team requirements, fee equation, annexes | a deal already advanced, where the buyer asks procurement-shaped questions |
| **v2** | 12 | first slim cut. Superseded by v3 | history only |
| **v3** | 12 | superseded by v4 | history only |
| **v4** (`eng2-*`) | 12 | **the default, cleared to send.** Slim, plain-spoken, deliberately non-committal | anything sent generically, or before a scope exists |

The `eng-*` slides are the long cut and the `eng2-*` slides are the slim cut;
the prefix marks the **cut**, not the version number. Versions live in the
backend, so the library always holds the current source of each cut.

## The defensive rule (the slim cut)

The slim cut is written to be **safe if it lands in the wrong hands**. A document sent
generically to prospects will be forwarded, filed, and quoted back later. So:

- **Never promise an outcome we do not control.** "A verified improvement"
  became "the data behind each hypothesis: what it supports, and what it does
  not". Too much of a real plant is outside our measurement to guarantee a
  result.
- **No numeric commitments on either side.** v1's ≥ 85% adoption and 4-week
  capture minimum are conditions we would have to enforce and could be held to.
  The slim cut says success is a joint effort and adoption is planned together.
- **The Proof of Value proves the value is *there*.** It is not the
  implementation of the improvement. Cover, step 2 and the outcomes slide all say
  checked and verified, never delivered.
- **Hedge the Analyze.** "Where the value looks likely", "an indicative
  payback", "the blind spots we can see". Not a report card we owe.
- **State the fees once per place they belong.** The path slide for the whole
  ladder, and each step's band for that step. A dedicated investment slide reads
  as a quote, so there isn't one.
- **Not marked Confidential**, and no prepared-for line. It is a shareable
  artifact, so the cover should not pretend otherwise.

Floris usually pairs it with an email carrying the customer-specific detail.
That is the right split: the deck stays generic and safe, the email carries the
specifics and is not a document.

## Skeleton (v4, current)

| #  | role          | slide             | required | note |
|----|---------------|-------------------|----------|------|
| 1  | cover         | eng2-cover        | yes      | `.cover--open` scrim; no prepared-for; no footer |
| 2  | why-now       | eng2-opportunity  | yes      | the blind spot is what sensors do not capture |
| 3  | idea          | eng2-idea         | yes      | the whole platform, framed as broader than the two steps |
| 4  | engagement    | eng2-path         | yes      | the stepwise path; the full ladder of fees |
| 5  | step-detail   | eng2-step1        | yes      | sb1 band; what we do / what you get, side by side |
| 6  | step-detail   | eng2-step2        | yes      | sb2 band; same shape; carries the joint-effort line |
| 7  | plan          | eng2-plan         | yes      | gated timeline, ~13 weeks end to end |
| 8  | outcomes      | eng2-outcomes     | yes      | three potential outcomes |
| 9  | scale         | eng2-scale-path   | yes      | chevron flow: one line, one site, several sites |
| 10 | evidence      | eng-proof         | yes      | verified case left, running projects right |
| 11 | cta           | eng2-next-step    | yes      | the Analyze in two parts, ending in a scope; no footer |
| 12 | closer        | back-cover        | yes      | contact; no footer |

**One slide per step, split down the middle.** What we do on the left, what you
get on the right. v1's four step slides said the same things across twice the
space; merging them is most of why the slim cut is shorter without losing content.

**Cut from v1 and why:** success criteria (too complex, and the numbers were
commitments), what we need from you (repeated the step slides), the fee equation
(fees already on slide 4), both annexes (far more legal detail than this stage
needs).

## Project-pattern presets

The pattern changes the wording of `eng-opportunity` and two or three cards on
the "get" slides; nothing structural.

- **Sorting / recycling line** — variable infeed, end-of-line weight and uptime
  only, sample analyses days later. Outcomes: stream quality, throughput.
- **Kiln / long batch** — a process you cannot see inside, an outcome weeks after
  the cause. Outcomes: first-time-right, yield.
- **Extrusion / continuous** — shift-to-shift variance on the same product.
  Outcomes: scrap, off-spec, changeover loss.
- **Waste-to-energy** — variable feedstock, constant manual correction.
  Outcomes: stability, availability.

## Intake questions

- named customer, and is the deck cleared for named material (entitlement)?
- the line or process in scope (`scope_line`), and which project pattern
- who receives it, and will it be forwarded past the room (drives 15, 17, 18)
- target start date (`start_target`) and the date of use
- has the Analyze already run? (v0 or v1)
- language

## Commercials (verify against Floris before reuse — see brand/BRAND.md)

Confirmed current 2026-07-30:
- Analyze: € 10.000 fixed, 2–3 weeks, 100% credited against the Proof.
- Proof of Value: € 25.000 fixed, all-in, ten weeks. Total to a verified
  improvement: € 25.000.
- Annual (Scale): priced on operational size; 50% of the Proof fee (€ 12.500)
  credited on conversion within 30 days of acceptance.

**"All-in" is deliberate and "regardless of hours" is deliberately gone.** The
old phrasing read as unlimited support. The fee is fixed on the agreed result,
not on effort; say that instead.

## Learnings
<!-- append-only; the accumulating half of the brain. Newest first. -->

- 2026-07-30 — **v4 cleared to send.** Final round was three words: the cover
  eyebrow carries the category (**Operator Intelligence**) rather than the
  document's name, which the footer and cover meta already say twice; the plan
  slide promises "ten weeks to **prove**", not to test, because testing is what we
  do and proving is what the customer buys; and "About thirteen weeks" lost its
  hedge. A document that hedges its own timeline invites the reader to hedge back.

- 2026-07-30 — **The working session belongs inside the Analyze, not before it.**
  Framing it as a free scoping call invites a plant to take the session and skip
  the paid step. v3 says plainly that it is the opening of the Analyze, and the
  CTA slide is now "The Analyze comes in two parts, and ends in a scope."
- 2026-07-30 — **The scope of the Proof of Value is an output, never an input.**
  The Analyze report returns *scope options*, each with the question it would
  answer; the customer picks one and signs it off. That sequence is what makes the
  € 25.000 step worth running, and saying it removes the suspicion that the scope
  was decided before anyone looked at the data.
- 2026-07-30 — **Fees belong in the step band.** Price, duration and the credit
  in the coloured band at the top of each step slide: the reader gets the
  commercial frame before reading a word of the content, and the redundant
  bottom fact-line disappears. Watch the band length; ~85 mono characters fits.
- 2026-07-30 — **"Staggered" was the wrong word.** It sounds like a concession.
  "A stepwise path, easy to follow" plus one plain sentence ("we look at your
  data, then we set up a defined experiment, then it becomes an annual
  agreement") does more than three abstract lines about commitment ever did.
- 2026-07-30 — **Never write "install".** Oppr installs nothing. "Before anything
  is captured on the floor" replaced "before anything is installed or captured".
- 2026-07-30 — **Shortening a headline creates a hole.** Cutting the platform
  slide's h2 from five lines to two left a dead band under the cards. The fix is
  to grow the block below it (`min-height` on the card row), not to leave the air.

- 2026-07-30 — **v2: the document a generic send actually needs.** v1 was
  thorough and that was the problem. A deck sent widely gets forwarded and quoted
  back, so every number in it is a number someone can hold you to. Trimming 19
  slides to 12 was mostly deleting *commitments*, not prose: the ≥ 85% adoption
  requirement, the "verified improvement" promise, the fee equation, both
  annexes. What is left describes the process and leaves room to work.
- 2026-07-30 — **"Verified improvement" is the phrase to watch.** The Proof of
  Value proves the value is *there*; it does not deliver the improvement. Too
  much of a plant is outside our measurement to promise a result. Every place
  that phrase appeared in v2 now says what the data supports and what it does not.
- 2026-07-30 — **A do/get pair per step wants one slide, not two.** v1 gave each
  step a "what we do" and a "what you get" slide. Correct structure, twice the
  space it needed: split one slide down the middle instead and the reader gets the
  same thing in half the pages. The action plan out of Step 1 also stopped needing
  its own bullet, because the scoped Proof of Value *is* that action plan.
- 2026-07-30 — **The success-criteria slide never worked.** Two attempts: four
  across (hid the difference between conditions and promises), then two labelled
  columns (the boxes would not align, because a 3-line card sits beside a 2-line
  card). The third fix was removing it. If a slide needs two structural rewrites
  and still misaligns, the content probably belongs in a contract, not a deck.
- 2026-07-30 — **Say the fees once.** Fees on the path slide read as context;
  the same fees on a dedicated "investment" slide read as a quote, which is
  exactly the register this document is trying to avoid.

- 2026-07-30 — **Superseded the `proposal` type after one build.** The 17-slide
  proposal master was correct as a proposal and wrong as an artifact: what this
  stage of the sale needs is a document that *describes* the path, so the reader
  can evaluate it without feeling closed. Three edits carried most of the change:
  "this proposal asks you to sign Step 1 only" became "this document describes
  the path, not a commitment to it"; "Investment" became "What each step costs";
  and the CTA became "How we would start". Everything else followed.
- 2026-07-30 — **"What you get" was on the wrong slide, and that exposed the real
  structure.** Its six cards described Step 2 deliverables while sitting between
  the Step 1 detail and the timeline. Splitting the deck into do/get per step
  fixed the placement *and* answered where the action plan belongs: one per step,
  as the bridge to the next. Cost two extra slides, worth it.
- 2026-07-30 — **Success criteria are two different kinds of thing.** Adoption
  and consistent capture are conditions on the customer (without them the dataset
  is not trustworthy); hypotheses answered and the action plan are what Oppr is
  held to. Shown as one row of four, that distinction disappears, and the customer
  reads all four as promises Oppr is making. Two labelled columns, `.critcols`.
- 2026-07-30 — **Three quotes that all say "game changer" read as boilerplate.**
  Raw dictation repeats the phrase; on the page each quote must land a different
  claim (correlation / SOP benchmarking / feedstock-to-quality). Same substance,
  three distinct reasons to believe.
- 2026-07-30 — **The stock cover scrim is ~74% black over the photograph** at the
  right edge, which loses the plant entirely. `.cover--open` takes it to ~40%
  while holding ~93% behind the headline. Worth considering for every deck.
