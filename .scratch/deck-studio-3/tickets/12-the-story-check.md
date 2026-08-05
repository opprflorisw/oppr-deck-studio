# 12 — The story check: an advisory AI pass over a chosen deck

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (2026-08-04)
- **blocked by:** 03
- **blocks:** 10

## Question

Ticket 03 decided that narrative rules are **suggestions, never constraints**, and
that coherence is checked by an AI pass rather than hard-coded. Floris:

> *"if you make your selection you can then do a verification to see, hey are we
> telling enough stories and are we not leaving any blanks in there... this is
> something that we don't necessarily need to hard code, it's more like an AI check
> you can do from the CLI to verify whether or not the setup that you chose makes
> sense."*

Design that check.

- **What does it actually read?** The recipe alone (chapter ids and slide ids), or
  the assembled HTML? Reading the recipe is cheap and structural; reading the deck
  is what catches two slides that contradict each other, which is the failure this
  whole effort started from.
- **What does it check for?** Candidates: a chapter skipped that this deck type
  usually includes; a slide whose companions are absent; two slides making the same
  point; a claim in one slide contradicted in another; a promise set up and never
  paid off; ordering that breaks the argument.
- **What does it emit?** Prose, or structured findings with a slide id and a
  severity? Structured is reusable (the app could show it); prose is more honest
  about being a judgement.
- **Does it ever block?** Ticket 03 says no. Confirm that holds even for the worst
  case, and confirm it stays visibly separate from `verify-deck.py`, which does
  block and must not be confused with it.
- **How is it invoked?** A tool (`tools/check-story.py`), a slash command, or a
  step inside `/deckbuilder`. It needs a model, so it is the first thing in the
  repo that calls one at build time. Which model, and what happens with no key?
- **Where does its output live?** Nowhere, a version's `change_note`, or a column?

## Why this is separate from the verify gate

`tools/verifylib.py` is mechanical, deterministic and blocking: em dashes,
placeholders, entitlement, geometry, footers. This check is none of those things.
Keeping them in one tool would make a judgement look like a rule and would put a
model in the path of every build. Two tools, two jobs, and only one of them can
fail a deck.

## Answer — closed 2026-08-04

Settled on the recommendation.

**Reads** the assembled HTML **and** the recipe. The recipe alone would catch gaps
(a chapter skipped that this type usually includes, a slide whose companions are
absent); only the HTML catches two slides contradicting each other, which is the
failure that started this whole effort.

**Checks**, in order of how much they are worth:

1. Two slides making the same point, or contradicting each other.
2. A promise set up and never paid off.
3. A chapter skipped that this deck type usually includes (from
   `types/<type>/recipe.md`).
4. A slide whose `with:` companions are absent.
5. Ordering that breaks the argument.

**Emits** structured findings (`slide_id`, `kind`, one sentence), rendered as prose
in the CLI. Structured so the app can surface them later without a second format.

**Never blocks. Exits 0 always**, and says so in its own output. This is the rule,
not a default: `tools/verifylib.py` is mechanical, deterministic and blocking; this
is a judgement. Keeping them in one tool would make a judgement look like a rule and
would put a model in the path of every build.

**Invoked** as `python tools/check-story.py decks/<slug>`, and automatically at the
end of `/deckbuilder`. With no API key it prints one line saying it was skipped and
exits 0, so a fresh clone with no key still builds decks.

**Output lives nowhere.** It is advice at build time, not a property of the
artifact. If it later earns a place in the app, it can be re-run; storing a stale
judgement against a version would be worse than not having one.

**Model:** the same one the session runs on, called through the Anthropic API with
`ANTHROPIC_API_KEY` in `.env`. This is the first thing in the repo that calls a
model at build time, so `.env.example` gains the name and `CLAUDE.md` gains a line.

## Recommended answer to react to

Reads the **assembled HTML plus the recipe**, so it can see both structure and
wording. Emits **structured findings** (slide id, kind, one sentence) so the app
can surface them later, rendered as prose in the CLI. **Never blocks**, exits 0
always, and says so in its own output. Invoked as `python tools/check-story.py
decks/<slug>` and called automatically at the end of `/deckbuilder`, skipped with a
clear message when no API key is configured.
