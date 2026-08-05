# 02 — The slide refresh: one repository of master slides

- **type:** prototype (HITL)
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** —
- **blocks:** 03, 06, 09

## Question

Before anything can be sorted into chapters, the library has to stop holding three
near-copies of the same slide. Floris, 2026-08-04:

> *"we look at all the different slides that we have from three different versions
> and then if we have slides that are almost identical but with small modifications
> then I can choose which one of the two or 3 we want to use and that's then going
> to be the master slide, and all other slides that are not duplicated are shown as
> separate slides, so that I first choose what the master deck is with all the
> slides in repository, and based on that repository we can start creating the
> three different versions."*

Explicitly **not** a tooling exercise: *"we don't need to build a tool around it."*
The output is a decided slide set, not a feature.

The three versions are the three published masters: **engagement** (v4),
**management-outlook** (v2), **product-showcase** (v1).

## What this ticket produces

A **review sheet** (HTML, same shape as the 2026-08-03 masters review, which
worked) showing every duplicate cluster side by side, rendered, with the wording
differences called out, so Floris picks one winner per cluster in one pass. Then a
recorded decision list: for each cluster, which slide survives as the master slide,
what happens to the losers (retire, or keep as a genuinely different slide), and
whether the winner needs wording grafted from a loser.

Applying the decisions to `library/slides/` is **build work, not this ticket.**

## The clusters, from `role` in each `meta.yaml`

`role` is already a de-facto subject key, and the clusters fall straight out of it.
32 of 47 slides sit in a cluster; 15 are already unique.

| role | slides in the cluster |
|---|---|
| `step-detail` | `eng-step1-do`, `eng-step1-get`, `eng-step2-do`, `eng-step2-get`, `eng2-step1`, `eng2-step2`, `step1-analyze`, `step2-prove`, `step3-scale` |
| `cover` | `cover`, `eng-cover`, `eng2-cover` |
| `cta` | `cta-next-step`, `eng-next-step`, `eng2-next-step` |
| `why-now` | `why-now`, `eng-opportunity`, `eng2-opportunity` |
| `outcomes` | `eng-outcomes`, `eng2-outcomes`, `outcomes-reference` |
| `engagement` | `eng-three-steps`, `eng2-path`, `engagement-ladder` |
| `idea` | `eng2-idea`, `idea-one-sentence` |
| `plan` | `eng-plan`, `eng2-plan` |
| `scale` | `eng-scale-path`, `eng2-scale-path` |
| `evidence` | `eng-proof`, `evidence-quotes` |

Unique, nothing to choose: `back-cover`, `eng-annex-a`, `eng-annex-b`,
`eng-criteria`, `eng-investment`, `eng-needs`, `kpi-payback`,
`operator-acceptance`, `platform-cce`, `product-flow-insight`,
`product-flow-setup`, `recognize-problems`, `running-projects`,
`when-time-matters`, `who-is-oppr`.

## Amended by ticket 07 (competitive scan, 2026-08-04)

**Retire, do not delete.** SlideLizard makes "outdated" a first-class release
status rather than removing the slide. Applied here: a cluster's losers should be
marked retired and kept, so that already-published decks referencing them can still
explain their own pages. This also removes the dangling-reference worry from
ticket 09.

~~Ticket 04 may additionally require **stable element ids** on every text-bearing
element in a slide fragment, back-filled during this refresh.~~
**Withdrawn 2026-08-04 by ticket 04.** `app/lib/htmlcheck.mjs` already guarantees
the tag stream is byte-identical across every version of a deck, so position is a
stable identity for free. Do **not** back-fill ids during the apply: they would
buy nothing.

## Review sheet, built 2026-08-04

https://claude.ai/code/artifact/4f58396c-8d3f-4850-a0a7-980323e1740e

Generator: `scratchpad/build_refresh.py` (reads `scratchpad/slides.json`, which is
the full text of all 32 cluster slides extracted with an HTML parser). 50 slide
thumbnails embedded, brand fonts inlined, 1,03 MB.

**13 decisions, C1 to C13.** Nine clusters (C1 to C9) plus four things the `role`
grouping got wrong (C10 to C13). Awaiting Floris's picks.

**The sheet is interactive** (asked for 2026-08-04, after the first static
version): every one of the 47 slides carries a tri-state **No mark / Keep /
Retire** pill and its own feedback box, and a sticky bar collects the lot into
plain text with a copy button. State is keyed by slide id, so a slide appearing in
two clusters (`eng-proof` in C11 and C12, `eng2-outcomes` in C10 and C13) stays in
sync in both places. Marks and notes persist in `localStorage`, so the page can be
closed and come back.

Verified in the browser, not assumed: 50 mark buttons, 50 note boxes, duplicate
slides synced in both directions, tally correct, output text correct, state
surviving reload. One bug found and fixed in the process: HTML entities in the
cluster titles (`Step 1 &middot; Analyze`) were leaking raw into the plain-text
output, which is pasted into a chat rather than rendered.

### What the sheet found, beyond the cluster list

- **`role` is a good chapter key and a bad dedup key.** It produced the clusters
  almost for free, which is the strongest evidence yet for ticket 03. But it gave
  **two false positives** (`outcomes` and `evidence` each hold two genuinely
  different slides, not variants) and **two false negatives** (identical content
  duplicated across *different* roles, which role-grouping cannot see by
  construction).
- **The reference statistics block exists twice**, in full, in `eng-proof` and
  `outcomes-reference`. Revising the numbers today means revising two files.
- **Convert / Extend / Wind down exists three times**: `eng-outcomes`,
  `eng2-outcomes` and `step3-scale`. The third hides under the `step-detail` role
  and is the version Product Showcase uses.
- **`step-detail` split exactly as predicted, and proved the chapter model.** It is
  not one cluster of nine, it is Step 1 and Step 2, and each holds a **pair**
  (`eng-stepN-do` + `eng-stepN-get`, two slides) alongside two **single-slide**
  versions of the same ground. That is not a duplicate, it is one chapter with a
  shallow pick and a deep pick, discovered from the content rather than assumed.
  Feeds straight into ticket 03.
- **`eng-next-step` has a defect**: its third item, "Proof of Value kick-off", has
  a heading and no body text at all.
- **`eng2-idea` and `idea-one-sentence` have byte-identical bodies.** Only the
  eyebrow and headline differ, so C2 is a one-line decision.
- **`engagement-ladder` has quietly dropped commercial detail** the other two
  members of C4 carry: both "ten weeks" and the "€ 10.000 credited". It is the
  version in two of the three masters.

## Round one decided, 2026-08-04

**27 kept, 19 retired, 1 unmarked** (`eng-criteria`). Recorded in `proposal.py`
next to the generator, and seeded into the sheet so it opens on what was decided.

Floris overrode the recommendation on three clusters:

- **C4** took `engagement-ladder` over `eng2-path`. That is the one version which
  dropped both "ten weeks" and "€ 10.000 credited", so the overview slide is now
  vaguer than the slides after it. Flagged in place; needs restoring, not
  re-deciding.
- **C9** took `eng-next-step` over `eng2-next-step`. That is the one with the
  missing paragraph. A draft for its third item is in the sheet.
- **C5/C6** retired *both* the pairs and the Product Showcase singles, keeping only
  `eng2-step1` / `eng2-step2`. This **settles a question ticket 03 was going to
  ask**: the step chapter has no depth choice. One step, one slide, always.
  Floris: *"we dont need 2 slides to say the same"*.

### The second view, added at Floris's request

> *"showcase the different slides from top to bottom... make a second page or tab...
> a more easy view where we can look at the groupings and the follow-through...
> make sure there are no doublings... potentially new slides where you feel like
> maybe two should be combined into one, or process my feedback and then showcase
> how you would process it."*

Tab 2, **The proposed library**: the kept set in reading order across **10 groups**,
each slide carrying its status (kept / needs work / retired / new / open), the
round-one remark as a read-only quote, and what would be done about it. Draft
wording is included inline where a rewrite was asked for (the `eng2-opportunity`
kicker, the `kpi-payback` softening, the missing `eng-next-step` paragraph).

**One new slide proposed: `step3`**, in the same two-card style and `sb3` band as
`eng2-step1` / `eng2-step2`, built from `eng-scale-path`. It does not exist today
and Floris asked for it twice.

**The flow contradiction is named and resolved.** Floris: *"we need to figure out
what the correct flow is... to ensure that we are not talking against each other."*
The cause is that convert / extend / wind down appears both as `eng2-outcomes` (the
decision ending Step 2) and as `step3-scale` (the content of Step 3). It is a
decision taken **to enter** Step 3, not something that happens **during** it. So
the proposal gives the decision its own group after the step slides, makes Step 3 a
real step slide, and retires `step3-scale` with its content split between the two.

**Four doublings, three resolved by the proposal**: the same three customers on
three evidence slides (fixed by cutting `eng-proof` back to the reference case, so
`running-projects` was right to be suspected but `eng-proof` was at fault); the
reference statistics duplicated verbatim; the outcomes contradiction above. The
fourth needs Floris: retiring `eng-plan` and keeping the ladder that dropped the
credit line leaves `eng-investment` as the only slide with the full arithmetic,
which is also the slide he questioned.

Round two is collected the same way, but the copy button now emits **only changes
and new remarks**, with `(was keep)` on anything flipped, so a reply is a few lines
rather than a re-listing of 46 settled decisions.

## Round two decided, 2026-08-04

**25 kept, 22 retired.** Every one of the 47 is now decided.

- **Evidence collapses from four slides to two.** `eng-proof` and `running-projects`
  both retired; `outcomes-reference` is the hard slide, `evidence-quotes` the soft
  one. Floris: *"so that we have a 'harder' outcome slide and just some quotes"*.
- **`eng-criteria` retired.** Floris: *"we dont want to define too many of these
  outcomes, we want a short mention in step 2 slide... this will depend on each new
  POV"*. So `eng2-step2` gains a scope-and-criteria line, drafted in the sheet.
- **`eng-investment` kept**, to be realigned with the new flow.

### This reversed one of my own round-one proposals

Round one proposed stripping the reference statistics from `outcomes-reference`,
because `eng-proof` carried the same block. With `eng-proof` retired, that block
must **stay** on `outcomes-reference`, and take `eng-proof`'s reference-case
attribution with it or the figures read as an average rather than one plant.
Corrected in place in the sheet.

### Consequences flagged, not silently absorbed

- **The mineral pigments producer leaves the library.** It appeared only on
  `eng-proof` and `running-projects`. The PVC extruder and the waste plant survive
  on `evidence-quotes`.
- **Retiring `eng-criteria` removes the hardest numbers in the deck**: ≥ 85 %
  adoption, four consecutive weeks, ≥ 3 hypotheses answered. They exist nowhere
  else. It is what was asked for, but it trades the most concrete commitment in the
  engagement story for a general one.
- **`eng-proof` was in all three masters**, so all three need the two survivors in
  its place. Largest single consequence of round two.
- **Open item 02 is effectively answered** by the `eng-criteria` decision: criteria
  are agreed up front but set per Proof, so the deck mentions rather than
  enumerates them. Item 01 (the ten weeks promise) is still open.

### One divergence still outstanding

`step3-scale`: Floris marked it **keep** in round one and did not revisit it. The
proposal **retires** it, splitting its outcomes into `eng2-outcomes` and its Step 3
framing into the new `step3` slide, because keeping it is what makes the deck
contradict itself. This is the only place the proposal overrides a decision, and it
needs a yes or a no before the ticket can close.

## Round three decided, 2026-08-04 — the slide set is settled

**27 kept, 20 retired.** Two reinstatements:

- **`running-projects` back**, to keep the mineral pigments producer. Floris:
  *"this is good and usefull"*. The reason it was retired (doubling `eng-proof`)
  went away when `eng-proof` was retired, so this costs nothing. It is also the
  right home: the pigments story is an eight-week kiln you cannot see inside, a
  process insight rather than a testimonial, and `.quotes` on `evidence-quotes` is
  a flex row built for three cards.
- **`eng-criteria` back**, rephrased. Floris: *"rephrase to make it clear that
  results are not a 1 way street but collaboration to achieve results between us
  and customer"*. The slide is already structurally two-sided; what it never says
  is that neither half produces a result alone. Three drafts in the sheet: the
  headline, the two column labels, and a closing line. The hard numbers
  (≥ 85 % adoption, four consecutive weeks, ≥ 3 hypotheses) stay.
- **Round two's plan to fold criteria into `eng2-step2` is withdrawn.** That slide
  already ends on *"Success here is a joint effort"*, which is the same point; keep
  the two consistent.

Evidence is now three slides with no overlap: `outcomes-reference` (the hard
numbers, inheriting `eng-proof`'s reference-case attribution), `running-projects`
(work by process type) and `evidence-quotes` (voices). One more than the
*"harder outcome slide and just some quotes"* shape, and the trade is stated.

**Open item 02 is answered**: criteria are agreed before the Proof and the deck
says so. Item 01 (the ten weeks promise) is the last one open, and it blocks the
`engagement-ladder` fix.

**Still outstanding before this ticket closes:** the `step3-scale` divergence.
Floris marked it keep; the proposal retires it, splitting its content between
`eng2-outcomes` and the new `step3` slide. Not yet answered across three rounds.

## Answer — closed 2026-08-04

**The slide set is settled: 26 kept, 21 retired, one restyled into a new id.**

Round three's last call resolved the only divergence. Floris: *"step 3 is scale..
the decision convert or wind down is the outcome of step 2.. so use that to decide
how to proceed."* That is the rule the flow was missing:

- **`eng2-outcomes`** keeps convert / extend / wind down as the **gate closing
  Step 2**.
- **`eng-scale-path` becomes `step3`**: same content, gains the `sb3` band and the
  two-card treatment so it matches steps 1 and 2. Renamed and restyled, nothing
  invented, nothing lost.
- **`step3-scale` retires.** It was the slide holding both ideas at once, which is
  what made the deck contradict itself.

Nothing in the proposal now overrides a decision of Floris's.

### Findings that outlive this ticket

- **`role` is a good chapter key and a bad dedup key.** It found the clusters for
  free, which is the strongest evidence for ticket 03, but it is blind to content
  duplicated across roles and it groups slides that merely share a purpose.
- **The step chapter has no depth choice.** One step, one slide, always. Decided by
  Floris in C5/C6 and it removes a question ticket 03 was going to have to ask.
- **Open item 02 from the 3 August review is answered**: criteria are agreed before
  the Proof and the deck says so, mutually. Item 01 (the ten weeks promise) is
  still open and blocks the `engagement-ladder` fix.

### Build work this creates (not this ticket)

Apply to `library/slides/`: retire 21, restyle `eng-scale-path` into `step3`,
restore the ten weeks and credited lines on `engagement-ladder`, write the missing
third paragraph on `eng-next-step`, rephrase `eng-criteria` as a two-sided
commitment, soften `kpi-payback`, rewrite the `eng2-opportunity` kicker, move
`eng-proof`'s reference-case attribution onto `outcomes-reference`, lighten the
cover scrim (which is also ticket 11), and realign `eng-investment` with the new
flow. All three masters need rebuilding, since `eng-proof` was in every one.

## Things to watch

- **`step-detail` is not one cluster.** Nine slides under one role covers at least
  two different ideas (what we do in a step, versus what you get from it) at two
  different depths. Expect it to split rather than collapse to one winner.
- **The `eng` and `eng2` prefixes encode history, not meaning.** `eng2-*` is the
  30 July revision round that the other two masters never received. Where an
  `eng2-` slide wins, the name should stop carrying a version number.
- **Four slides are already orphaned** (`used_in: []`): `cta-next-step`,
  `evidence-quotes`, `outcomes-reference`, `platform-cce`, `why-now`. They are
  candidates to retire, but check first: `cta-next-step` is still used by
  `2026-07-22_teaser-demo` and `2026-08-01_wavin-rnd`, which `used_in` does not
  record.
- **Items 01 and 02 of the 2026-08-03 masters review are still open** (the ten
  weeks promise, and criteria signed before the Proof). Do not settle wording that
  depends on them.
