# Oppr Deck Studio — complete build instruction

**Status: BUILT (2026-07-22).** Approved by Floris and implemented end to end;
see git history (Phase 0 baseline → Phase 7), one commit per phase, and `MAP.md`.
Deferred-as-planned items are listed in the MAP's "BUILT" note. This file remains
the design rationale; the operating manual is the root `CLAUDE.md`.

This is the destination artifact of the wayfinder map at
[.scratch/deck-tool/MAP.md](MAP.md). Where a decision was already settled during
wayfinding it is marked **[settled]**; where this spec proposes an answer to a
still-open ticket it is marked **[proposed — ticket NN]** and needs Floris's yes.

---

## 1. What is being built

A deck system on top of the existing HTML + Claude Code workflow (no PowerPoint,
no SaaS — **[settled]**) with five layers:

| Layer | What it is | New or existing |
|---|---|---|
| Brand system | `templates/deck.css`, `showcase.css`, `brand/` | exists |
| **Element library** | every slide as a reusable, described element + an image manifest | new |
| **Deck types ("recipes")** | one markdown brief per named cut: goal, audience, skeleton, learnings | new |
| **Canonical decks + frozen variants** | masters defined as compositions of library slides; variants are frozen snapshots | new model over existing decks |
| **Intake workflow** | interactive Q&A → proposed slide plan → approval → assemble → PDF | new (Claude Code command) |

Plus a **visual showcase**: an auto-generated slide catalog (thumbnails of every
library slide, browsable in the browser) — the human-facing "see what we have"
surface until the Phase-2 app.

Everything is driven from the **Claude Code CLI** — intake, assembly, edit, and
build are conversations/commands in this repo, backed by deterministic PowerShell/
Python scripts for the mechanical parts.

**The repo must be self-describing to Claude.** Every future session — any
machine, any teammate, no prior context — must understand the system from the
repo alone. That is a build deliverable, not a nicety (see §10a): `CLAUDE.md`
rewritten as the system's operating manual, thin per-folder `CLAUDE.md` files
at the layer boundaries, and the two command files carrying the full workflow
logic. The rule of thumb: **if Claude needs to know it to act correctly, it
lives in a checked-in file, never only in a chat history.**

---

## 2. Repository layout (target state) [proposed — ticket 04]

```
deck_manager/
├── CLAUDE.md                      # updated to describe this system
├── brand/                         # unchanged + one new file
│   └── img/library.json           # image manifest [settled — ticket 02]
├── templates/                     # unchanged (deck.css, showcase.css, deck-starter.html)
├── library/                       # NEW — the element library
│   ├── slides/
│   │   └── <slide-id>/
│   │       ├── slide.html         # one <section> fragment, self-contained markup
│   │       ├── meta.yaml          # role, tags, variables, css deps, entitlement
│   │       └── thumb.png          # generated 1280×720 render (git-ignored, rebuildable)
│   └── catalog.html               # generated contact sheet of all slides
├── types/                         # NEW — deck-type recipes (the reusable "briefs")
│   ├── product-showcase/recipe.md
│   ├── management-outlook/recipe.md
│   └── teaser/recipe.md           # created when the type is first made
├── decks/
│   ├── canonical/                 # NEW home for masters
│   │   └── <type-slug>/
│   │       ├── deck.yaml          # composition: ordered refs to library slides
│   │       ├── index.html         # GENERATED from deck.yaml (never hand-edited)
│   │       └── <type-slug>.pdf
│   └── variants/                  # frozen snapshots, one folder per produced deck
│       └── YYYY-MM-DD_<purpose-or-client-slug>/
│           ├── brief.md           # the filled intake brief + approved plan
│           ├── index.html         # fully assembled, SELF-CONTAINED (frozen)
│           ├── <slug>.pdf
│           └── manifest.yaml      # source type + canonical version + slide versions
├── tools/
│   ├── build-pdf.ps1              # exists, unchanged
│   ├── build-asset-index.ps1      # extended: reads library.json, warns on drift
│   ├── build-slide-catalog.ps1    # NEW: renders thumbs + library/catalog.html
│   ├── assemble-deck.py           # NEW: deck.yaml/plan → index.html (deterministic)
│   └── verify-deck.py             # NEW: automated quality gates (see §9)
├── .claude/commands/
│   ├── new-deck.md                # the intake workflow (see §7)
│   └── edit-canonical.md          # the edit-mode workflow (see §8)
└── .scratch/deck-tool/            # this planning effort (map, tickets, spec)
```

Existing decks (`decks/2026-07-21_product-showcase/`, `…management-outlook/`)
migrate into this shape in Phase 1 (§11) and their folders are retired after a
verified-identical rebuild.

---

## 3. The slide element [proposed — ticket 01]

**A library slide is a folder: one HTML fragment + one metadata sidecar.**

`library/slides/<slide-id>/slide.html` — exactly one `<section>…</section>`,
copy-paste identical to what would sit in a deck. No `<html>`/`<head>`; CSS stays
in the shared stylesheets. Deck-specific one-off styles are not allowed in
library slides — if a slide needs a style, that style graduates into
`showcase.css` (or a new shared sheet) first. This is the rule that makes slides
portable.

`library/slides/<slide-id>/meta.yaml`:

```yaml
id: idea-one-sentence
role: idea                  # the skeleton slot this slide fills (see roles below)
title: The idea in one sentence
css: [deck.css, showcase.css]   # stylesheets the markup depends on
entitlement: public         # public | mutares-family | <other named scope>
language: en
tags: [opening, message, management, attero-style]
images: []                  # files from brand/img it references
variables:                  # personalizable values that appear in the markup
  - name: footer_meta       # matched as {{footer_meta}} in slide.html
    scope: deck             # deck-level: filled once per deck
  - name: prepared_for
    scope: deck
    optional: true
used_in: [product-showcase, management-outlook]   # maintained by assemble tool
notes: One big statement, no visual. Keep under 20 words.
```

**Variables [proposed — ticket 05]:** the existing `[DYNAMIC BLOCK]` comment
convention is replaced by explicit `{{variable}}` placeholders in `slide.html`,
declared in `meta.yaml`. Two scopes:

- `deck` — filled once at assembly (footer meta line, prepared-for, client logo,
  date, page total). The assembler fills every occurrence.
- `slide` — filled per use (a headline stat, a named process type).

Assembly **fails loudly** on any unfilled required variable — no placeholder ever
reaches a PDF.

**Roles** are the vocabulary recipes use to describe a skeleton without naming
files: `cover`, `idea`, `why-now`, `problem-recognition`, `when-time-matters`,
`platform`, `product-flow`, `outcomes`, `evidence`, `kpi`, `engagement`,
`step-detail`, `acceptance`, `running-projects`, `who-is-oppr`, `cta`, `closer`.
A role can have multiple library slides (e.g. two `evidence` designs); the
intake proposes the best fit.

---

## 4. The image library [settled — ticket 02]

As resolved by research (full detail:
[research/02-image-library-semantics-findings.md](research/02-image-library-semantics-findings.md)):

- `brand/img/library.json` — one entry per image: `file`, `group`, `type`,
  `orientation`, `entitlement`, `description`, `tags`, `suggested_use` phrases
  written in Oppr's own vocabulary (Capture → Connect → Execute, "operators are
  the sensor").
- **Claude reading the manifest at build time is the retriever** — at ~23 images
  no embeddings, no index. Revisit only past ~150 images.
- Seed descriptions by harvesting the existing `alt` texts in the two decks;
  each chosen image's `alt` is thereafter its manifest `description`.
- `entitlement` gates named-customer imagery mechanically (Holliday/Venator →
  `mutares-family` only).
- `tools/build-asset-index.ps1` is extended to render descriptions on the contact
  sheet and **warn on any file↔manifest mismatch** — the entire sync mechanism.

---

## 5. Deck types: the recipe (the "living brain") [proposed — ticket 08]

One folder per **existing named cut** **[settled]** under `types/`, holding
`recipe.md` — the reusable brief for that kind of deck:

```markdown
---
type: management-outlook
goal: convince a management/economic buyer to take the Analyze step
audiences: [portfolio-company management, PE operating partners]
default_language: en
default_length: 10-14 slides
presenter: Floris (founder) unless specified
entitlement_default: public
---

# Management Outlook — recipe

## Skeleton
| # | role | default slide | required |
|---|------|---------------|----------|
| 1 | cover | cover | yes |
| 2 | when-time-matters | when-time-matters | yes |
| 3 | why-now | why-now | yes |
| … | … | … | … |

## Intake questions
What must be asked fresh every time (client? language? entitlement? emphasis?)
vs. what this recipe fixes (tone, skeleton, audience register).

## Learnings   <!-- append-only; the accumulating half of the brain -->
- 2026-07-22 — Icons on the four pressure boxes tested well; keep.
```

**Recipe vs. instance:** the recipe is reusable and lives in `types/`; the
**filled brief for one specific deck** (`brief.md`) lives in that variant's
folder and records the intake answers + the approved plan. Recipe = template,
brief = one deck's contract.

**Memory tie-in [settled]:** cross-cutting style learnings (register, type
sizes, "no em dashes") stay in Claude's `memory/` as they do today; **per-type**
learnings append to that recipe's `## Learnings`. After every finished deck, the
workflow's last step asks: "anything to feed back into the recipe or memory?" —
that closing question is what makes the brain living rather than a folder.

---

## 6. Canonical decks, variants, versioning [proposed — tickets 03 + 07]

**Version-control baseline [ticket 03 — needs Floris's explicit yes]:**
`git init` this repo. Commit the current state as the baseline. `.gitignore`:
`library/slides/*/thumb.png` and other regenerables; **PDFs of variants ARE
committed** (they are the shipped artifact and the historical record); canonical
PDFs are committed too (cheap, useful diff-by-eye anchor).

**Canonical decks** live in `decks/canonical/<type>/` as a `deck.yaml`
composition — an ordered list of library slide refs plus deck-level variable
defaults. `index.html` is generated from it, never hand-edited. The canonical
"best version" **is the tip of `main` plus a git tag**:

```
canonical/product-showcase@v1, @v2, …
```

Tagging is part of the edit-mode workflow (§8), so "mark the best version" is a
deliberate act, and "look back at old versions" is `git log`/`git show` on the
slide fragment or the tag — no parallel history system.

**Variants are frozen snapshots [settled].** Assembly copies fully-resolved
markup into the variant's `index.html` — no live references back to the library.
`manifest.yaml` records provenance:

```yaml
type: management-outlook
canonical: canonical/management-outlook@v3
assembled: 2026-09-14
slides:
  - id: cover            # + the git commit hash of each slide.html used
    commit: 4f2a91c
language: fr
entitlement: public
```

So any variant can always answer "which canonical, which slide versions, was it
entitled to what it shows."

---

## 7. The intake workflow — `/new-deck` [proposed — ticket 06]

A Claude Code command (`.claude/commands/new-deck.md`) that scripts this
conversation. **It proposes; Floris approves; only then does it build
[settled].**

**Step 1 — choose the type.** List `types/`; pick one, or declare a new type
(which first creates its recipe by interview, seeded from the nearest existing
recipe).

**Step 2 — intake questions.** From the recipe's fixed answers + these asked
fresh (one compact pass, not twenty separate prompts):

1. Who is the audience — company, role, what they already know of Oppr?
2. Prepared for a named client? (name, logo, "prepared for" line) — or generic?
3. Language? (en / fr / de / nl / …)
4. Entitlement — may this deck show named-customer material, or public-safe?
5. Goal & emphasis — teaser vs. full; more illustration vs. more numbers; what
   single action should the audience take afterwards?
6. Presenter — who from Oppr stands in front of it?
7. Length target and date of use.

**Step 3 — the proposed plan.** Claude reads the recipe skeleton, the slide
library metas, and `brand/img/library.json`, then presents one table:

| # | role | plan | source | note |
|---|------|------|--------|------|
| 1 | cover | **reuse** | `cover` | fill prepared_for = Acme |
| 2 | idea | **reuse** | `idea-one-sentence` | as-is |
| 5 | evidence | **adjust** | `evidence-quotes` | drop 3rd quote for length |
| 7 | kpi | **new** | — | needs Acme-specific payback framing |

…plus proposed images (by manifest description) and every variable value it
intends to fill. **Hard gate: Floris approves or edits the plan before anything
is assembled.**

**Step 4 — assemble.** `tools/assemble-deck.py` executes the approved plan
deterministically: concatenate fragments in order, fill variables, run the
entitlement check, set `data-total` and footers, write the variant folder
(`brief.md`, `index.html`, `manifest.yaml`). "Adjust" and "new" slides are
crafted by Claude in the variant only — the library is untouched (see §8 for how
good new slides get promoted).

**Step 5 — build + verify.** `build-pdf.ps1`, then `verify-deck.py` (§9), then
the visual per-slide check exactly as CLAUDE.md mandates today. Fix, rebuild,
until clean.

**Step 6 — freeze + learn.** `git commit` the variant ("variant: acme-teaser
from management-outlook@v3"). Then the closing question: any learning for the
recipe or memory? Append it.

**Guardrail:** `/new-deck` may write only in `decks/variants/`. It never
modifies `library/`, `types/` skeletons, or canonical decks. That is the wall
between **Personalize** and **Edit**.

---

## 8. Edit mode — `/edit-canonical` [proposed — ticket 06]

The deliberate step across the wall. Scope: library slide fragments, recipes,
canonical `deck.yaml`s, shared CSS.

1. Name what is being changed and why (one line, goes in the commit message).
2. Edit the library slide(s) / recipe / composition.
3. Regenerate every canonical deck that uses the touched slides
   (`assemble-deck.py` from each `deck.yaml`), rebuild PDFs, verify (§9 + visual).
4. Commit; **tag** `canonical/<type>@vN+1` when Floris declares it the new best
   version — tagging is the explicit "mark canonical" act.
5. Regenerate `library/catalog.html` thumbnails for changed slides.
6. Existing variants are untouched — frozen **[settled]**.

**Promotion path:** when a variant's "new" slide proves good, edit mode lifts it
into `library/slides/` with proper meta — that's how the library grows from real
work instead of speculation.

---

## 9. Automated verification — `verify-deck.py` [proposed]

Codifies the manual gates from CLAUDE.md so every assembly runs them:

- PDF page count == slide count == every `data-total`.
- Page size 13.33 × 7.5 in (pypdf mediabox).
- Full-text scan: **zero em dashes**; zero unfilled `{{…}}`; zero
  customer names (`mutares|holliday|venator|attero|keeeper|…`) unless
  `manifest.yaml` entitlement allows them; European number formats on € amounts.
- Every content slide has `.slide-foot`; cover/closer have none.
- Every `<img src>` resolves; every image's entitlement ≤ deck entitlement.
- Renders each page via PyMuPDF at low DPI and flags near-blank pages.

Exit non-zero on any failure. The visual look-at-the-slides check stays human/
Claude — this script only removes the mechanical part.

---

## 10. The visual showcase [proposed]

`tools/build-slide-catalog.ps1`:

1. For each `library/slides/<id>/`, wrap `slide.html` in a minimal page with the
   CSS from its meta, screenshot at 1280×720 via headless Edge/Chrome (same
   engine as build-pdf), save `thumb.png`.
2. Generate `library/catalog.html`: thumbnails grouped by role, showing id,
   tags, entitlement badge, `used_in` list; click for full size. Same pattern as
   the existing `brand/img/index.html` contact sheet.
3. A small index page also lists canonical decks (+ current tag) and recent
   variants with dates — "what do we have and what went out lately" at a glance.

This is the cherry-picking surface for humans and the seam where the **Phase-2
visual app** later plugs in (the app is a richer catalog + plan-approval UI over
this same data; explicitly **not designed in this spec** **[settled]**).

---

## 10a. The knowledge layer — the repo teaches Claude [proposed]

The system is operated through the Claude CLI, so the repo must carry its own
operating manual. Deliverables:

- **Root `CLAUDE.md` rewritten** as the system manual: the five layers, the
  Personalize/Edit wall, where things live, the verify gates, and pointers into
  the deeper docs. It replaces today's deck-folder-centric text.
- **Thin per-folder `CLAUDE.md` files** at the layer boundaries — `library/`
  ("what an element is, the CSS-graduation rule, meta.yaml schema"), `types/`
  ("recipe vs. brief, how Learnings append"), `decks/` ("canonical vs. variant,
  frozen means frozen") — each a page, not a book.
- **The two command files** (`.claude/commands/new-deck.md`, `edit-canonical.md`)
  carry the complete workflow logic, so invoking them IS loading the process.
- **`brand/BRAND.md` stays the brand truth**; the design system (§10b) becomes
  its visual, enforceable counterpart.

Acceptance test for this layer: a **fresh Claude session in a clean clone** is
asked to produce a teaser variant — it must find `/new-deck`, follow the whole
flow, and respect every rule without any prior conversation context.

---

## 10b. The design system — built with Claude Design [proposed]

New slides must *follow the system*, not just sit near it. Today the design
system is implicit (tokens and blocks in `deck.css`/`showcase.css`, prose in
`BRAND.md`). This makes it explicit and visual:

1. **Specimens in-repo:** `library/design-system/<group>/<name>.html` — small
   self-contained preview pages that render each piece using the real
   stylesheets: **Foundations** (color tokens, type scale, eyebrow/mono labels,
   EU number formatting), **Blocks** (`.card`, `.stat`, `.tag`, `.steps`,
   `.tbl`, `.fact-strip`, `.stepband`, `.grid2`+`.g2ico`, `.quotes`, `.rungs`,
   `.ctatl`…), **Slide patterns** (cover treatment, one-idea slide, footer
   anatomy). Each carries a first-line `@dsCard` marker naming its group.
2. **Published to Claude Design:** a design-system project ("Oppr Deck System")
   on claude.ai, synced from those specimens via the `/design-sync` skill +
   DesignSync tool — incremental, component by component. This gives Floris and
   later teammates a browsable, always-current design reference outside the
   repo, and gives design work in claude.ai/design the real Oppr system to
   build against.
3. **The composition rule (the enforcement):** a **new slide may only be built
   from design-system blocks**. If it needs a pattern that doesn't exist, the
   pattern is added to the design system first (specimen + CSS graduation per
   §3), *then* the slide uses it. `/new-deck` and `/edit-canonical` both carry
   this rule; `verify-deck.py` adds a soft check (warn on classes used in
   slides that no specimen documents).
4. **One source of truth:** the specimens render from the same `deck.css`/
   `showcase.css` the decks use — the design system can never drift from what
   ships, because they are the same stylesheets. Sync to Claude Design is a
   push of the specimens, never a fork.

---

## 11. Build phases (execute in order, verify each before the next)

**Phase 0 — baseline.** Get Floris's yes on §6, then `git init`, `.gitignore`,
baseline commit, tag `baseline-2026-07`. *Done when: `git log` shows the
baseline and a throwaway edit can be reverted.*

**Phase 1 — extract the library.** Split the Product Showcase's 20 sections into
`library/slides/` (script-assisted, then hand-QA'd), write each `meta.yaml`,
convert dynamic blocks to `{{variables}}`. Write `deck.yaml` for both canonical
decks. Rebuild both via `assemble-deck.py`; **PDFs must be visually identical to
the shipped ones** (per-slide screenshot diff). Retire the old deck folders.
Tag `canonical/*@v1`. *Done when: both decks rebuild verified-identical from the
library.*

**Phase 2 — image manifest.** Create `library.json` (harvest alts, vision pass
for the rest), extend `build-asset-index.ps1` with descriptions + drift warning.
*Done when: contact sheet shows descriptions; a deliberate mismatch warns.*

**Phase 3 — verification.** `verify-deck.py` per §9; run it against both
canonicals; wire it into the standard flow. *Done when: it passes on both and
correctly fails a seeded bad deck (em dash, wrong data-total, leaked name).*

**Phase 4 — recipes + intake.** Write `recipe.md` for product-showcase and
management-outlook (mined from the decks + memory), then `.claude/commands/
new-deck.md` and `edit-canonical.md` per §7–8. Dry-run: produce one real teaser
variant end-to-end. *Done when: a variant exists that went intake → plan →
approval → assemble → verify → freeze, and its manifest traces provenance.*

**Phase 5 — showcase.** `build-slide-catalog.ps1` + catalog + decks index.
*Done when: every library slide has a thumbnail and the catalog opens clean.*

**Phase 6 — knowledge layer.** Rewrite root `CLAUDE.md` as the system manual,
add the per-folder `CLAUDE.md` files (§10a). *Done when: a fresh Claude session
in a clean clone produces a teaser variant end-to-end from the repo docs alone.*

**Phase 7 — design system.** Build the specimens under `library/design-system/`
(§10b), create the "Oppr Deck System" project on claude.ai/design, sync via
`/design-sync`, and switch on the composition rule in both commands +
`verify-deck.py`. *Done when: the design system is browsable on claude.ai, every
block used by the two canonical decks has a specimen, and a slide using an
undocumented class triggers the warning.*

**Later (separate efforts, out of this spec):** the visual app; team access &
sharing; translation-alignment tooling.

---

## 12. What this spec deliberately does not decide

- **Team access / sharing** — deferred **[settled]**; who uses it changes what
  sharing means.
- **Phase-2 app design** — only its seam (§10) is named.
- **Translation workflow details** — a `fr` variant works through §7 today
  (language is an intake answer; Claude translates at assembly, EU formats and
  brand terms preserved); keeping translations *aligned* over time is fogged on
  the map.

---

## Approval checklist (what Floris is saying yes to)

1. §2 repository layout · 2. §3 slide-element + variable model · 3. §6 `git init`
+ tag-based canonical versioning + committed PDFs · 4. §5 recipe shape ·
5. §7/§8 the two commands and the Personalize/Edit wall · 6. §10a the
self-describing repo · 7. §10b the design system built with Claude Design +
the composition rule · 8. the §11 phase order.

On approval: this file graduates to the repo root as `TOOL-SPEC.md`, the map's
remaining tickets close as "resolved by spec", and building starts at Phase 0.
