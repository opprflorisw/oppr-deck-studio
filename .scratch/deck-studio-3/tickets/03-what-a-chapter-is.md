# 03 — What a chapter is, and what the chapter set is

- **type:** grilling, then prototype
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** 02
- **blocks:** 06, 09

## Question

Define the chapter object, then sort the refreshed slide set into chapters.

Blocked by 02 on purpose: sorting slides into chapters while three near-copies of
the same slide are still in the library sorts noise.

**The object.** Is a chapter a folder on disk (`library/chapters/<id>/`), a field
on each slide's `meta.yaml`, or its own manifest? Can a slide belong to more than
one chapter, or is membership exclusive? Does a chapter carry anything beyond a
name and an order: a purpose line, a default pick, a rule that it must appear
before another chapter, a rule that it is mandatory?

**The set.** Does the refreshed slide set fall into chapters cleanly, and what is
the pick per chapter for each of the three masters? The 2026-08-03 masters build
is the worked example: Management Outlook took `engagement-ladder` alone where
Product Showcase took `engagement-ladder` plus `step1-analyze` / `step2-prove` /
`step3-scale`. That is one chapter, two depths, decided by hand with nowhere to
record it.

**Prototype:** an HTML sheet showing the chapters, their slides, and the three
masters read back as chapter picks.

## Amended by ticket 07 (competitive scan, 2026-08-04)

**No tool in the scan ships chapters.** That is a finding, not an oversight to
correct: it means there is no prior art to copy and no reason to expect the idea to
be wrong. The two nearest primitives should be considered and explicitly rejected
in the answer, rather than left unexamined:

- **PowerPoint Custom Shows** — a named subset of one deck's slides. Cannot express
  "these three slides are alternatives to that one", which is the whole
  requirement, so it is a weaker model.
- **Seismic LiveDocs conditional slides** — rules on slides driven by a
  questionnaire, so the deck assembles itself from answers rather than from picks.
  Genuinely different: it replaces choosing with configuring. Worth a paragraph on
  whether that is desirable here (it removes judgement from deck-building, which
  may be exactly wrong for a founder-led pitch).

## Decided 2026-08-04 — the chapter model

Floris, in his own words:

> *"a deck recipe in this case should just have chapters, meaning that we have the
> different slides within a chapter... we might even have a deck that completely
> skips a certain chapter so that all the slides underneath are also not followed.
> The rules I keep more as a help to you: these are the rules which typically would
> be in a certain type of deck, not necessarily hard requirements. So if you make a
> customer deck you would get a suggestion of which slides to put in there, but not
> a restriction that you cannot add a certain slide... let's keep it open and
> something that generally develops as we move forward."*

**1. The recipe is chapters and nothing else.** An ordered list of chapters, each
holding the slides chosen from it. No conditions, no rules engine, no second
mechanism. A deck may **skip a whole chapter**, and skipping it drops every slide
under it.

**2. Rules are suggestions, not constraints.** A chapter may say what *typically*
belongs in a given deck type. That produces a **recommended pick**, never a
restriction. Any slide can go in any deck. Nothing is refused.

**3. The set is expected to grow.** New chapters get added as new deck types
appear. Floris's example: a verification deck using chapters 1, 2, 3 and 12, where
12 is never used anywhere else. So chapter ids must not encode position, and a
chapter used by exactly one deck type is normal rather than a smell.

**4. The library records intent per slide**, not just content: what the slide is
for, why you would use it, and which slides go well with it. That is what makes a
suggestion possible at all.

**5. Coherence is an advisory AI check from the CLI, not a hard gate.** Floris:
*"if you make your selection you can then do a verification to see, are we telling
enough stories, are we not leaving any blanks... this is something we don't
necessarily need to hard code, it's more like an AI check you can do from the CLI."*
Split out as **ticket 12**.

### The one place this collides with an existing rule, and must not

"No restrictions" is about **narrative** rules. It does **not** extend to
**entitlement**. `allowed_entitlements` and the image clearance check in
`verifylib.py` are a confidentiality gate, not a storytelling preference, and a
deck naming a customer it is not cleared for is a hard FAIL today for good reason.
The Product Showcase is blocked on exactly this right now. So:

- **narrative fit** → suggestion, never blocks (ticket 12)
- **entitlement, unfilled placeholders, em dashes, footer discipline, page
  geometry** → hard gate, still blocks (`verifylib.py`, unchanged)

Ticket 06's recommendation is amended accordingly: chapter picks are *suggested*
freely, and the clearance check stays mechanical and final.

## The chapter set, proposed 2026-08-04

Tab 3 of https://claude.ai/code/artifact/4f58396c-8d3f-4850-a0a7-980323e1740e
Data in `scratchpad/chapters.py`.

**11 chapters over the 26 surviving slides**, in reading order:

| n | chapter | slides |
|---|---|---|
| 01 | Open | `cover` |
| 02 | The idea | `eng2-idea` |
| 03 | The problem | `recognize-problems`, `eng2-opportunity`, `when-time-matters` |
| 04 | The platform | `platform-cce`, `product-flow-setup`, `product-flow-insight` |
| 05 | Evidence | `outcomes-reference`, `running-projects`, `evidence-quotes` |
| 06 | The engagement | `engagement-ladder`, `eng2-step1`, `eng2-step2`, `step3`, `eng2-plan`, `eng-criteria` |
| 07 | The decision | `eng2-outcomes` |
| 08 | Commercials | `eng-investment`, `kpi-payback` |
| 09 | Adoption and company | `operator-acceptance`, `who-is-oppr` |
| 10 | Close | `eng-next-step`, `back-cover` |
| 11 | Annex | `eng-annex-a`, `eng-annex-b` |

Every slide carries the **intent metadata** ticket 03 called for: what it is for,
when to use it, and which slides it goes with. That is what a suggestion reads and
what the story check (ticket 12) reasons over.

**The three masters as picks** (a chapter absent from the picks is skipped
entirely): Engagement **16 pages**, skipping platform and company. Management
Outlook **11 pages**, skipping platform, decision and annex, and taking **1 of 6**
engagement slides. Product Showcase **20 pages**, skipping decision and annex.

Management Outlook is the model doing its job: the same engagement chapter, one
slide instead of six, decided by pick rather than by keeping a shorter variant of
anything. That is exactly the hand-built choice of 2026-08-03, now expressible.

## Where it all lives — closed 2026-08-04

The remaining questions were implementation shape rather than product decisions, so
they are answered here with reasoning rather than grilled.

**`library/chapters.yaml`** holds the ordered chapter list **and each chapter's
ordered slide list**:

```yaml
- id: ch-engagement
  title: The engagement
  purpose: The three steps, in order.
  slides: [engagement-ladder, eng2-step1, eng2-step2, step3, eng2-plan, eng-criteria]
```

Membership and order live in **one** file rather than being spread across 26
`meta.yaml` files. That makes the library's whole shape readable at a glance, makes
exclusivity structural rather than a rule to enforce, and gives
`tools/check-docs.py` a cheap new check: every slide appears in exactly one
chapter, and every id resolves.

**`role` stays on `meta.yaml` and is not renamed.** It looked like the chapter key
and it is not: `verify-deck.py` enforces footer discipline **by role** (`cover`,
`closer`, `cta` carry no footer). Role is a **render contract**; chapter is an
**authoring grouping**. They agree today by coincidence, and overloading one field
with both jobs would couple the verify gate to the chapter set.

**Intent metadata goes on `meta.yaml`**, beside the slide it describes:

```yaml
goal: State what Oppr does in a sentence a person can repeat.
why:  Use immediately after the cover in every deck.
with: [cover, platform-cce]
```

Authored for all 26 slides already, in `scratchpad/chapters.py`. This is what a
suggestion reads and what the story check (ticket 12) reasons over.

**Suggested picks live in `types/<type>/recipe.md`**, as a fenced YAML block inside
the existing prose rather than a new file. Ticket 01 settled the other half: the
deck's actual picks are `deck_versions.recipe`. So `recipe.md` is the *suggestion*
and the column is the *fact*, which is the input/output split the map's fog section
predicted.

## What is still open in this ticket

- The **chapter set** itself, and the three masters expressed as picks against it.
- Where chapters are **declared** (a field on `meta.yaml` plus one
  `library/chapters.yaml`, most likely) and whether membership is exclusive.
- The **shape of the intent metadata** on a slide: goal, why-use, companions.

## Recommended answer to react to

**`role` is already the chapter key.** Every `meta.yaml` carries one, the values
are subject-shaped (`why-now`, `engagement`, `kpi`, `acceptance`, `who-is-oppr`),
and the duplicate clusters in ticket 02 fell straight out of it. Promote `role` to
`chapter`, declare the chapters in one `library/chapters.yaml` carrying name, order
and purpose, and keep membership exclusive.

Two things this has to survive:

- `verify-deck.py` enforces footer discipline **by role** (`cover`, `closer`, `cta`
  have no footer). If `role` becomes `chapter`, either the verify gate reads the
  new field, or role and chapter stay two fields that happen to agree today.
  Cleaner: keep `role` for the render/verify contract, add `chapter` beside it, and
  accept the near-duplication rather than overloading one field with two jobs.
- `step-detail` as a role covers nine slides across two ideas and two depths.
  Whatever ticket 02 does to it decides whether it is one chapter or several.
