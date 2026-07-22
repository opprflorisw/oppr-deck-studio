---
id: 01
title: /deckbuilder orchestrator — scope & routes
type: grilling
status: open
assignee:
blocked-by: []
---

## Question

Floris wants **one orchestrator skill** (`/deckbuilder`) instead of many
separate commands: "I want to make a LinkedIn carousel", "build this draft",
etc. Decide:

1. **What intents does v1 route?** Candidates: build-from-draft (the app
   handoff), new deck from scratch (today's `/new-deck` intake), ingest the
   dump, LinkedIn post / carousel, image generation (later phase). Which are
   in, which stay separate?
2. **Do existing commands survive?** Does `/deckbuilder` *wrap* `/new-deck`
   and `/ingest-dump` (they remain callable directly, orchestrator delegates),
   or *replace* them (their content folds into `/deckbuilder` routes)?
   `/edit-canonical` presumably stays separate — it's the other side of the
   Personalize/Edit wall.
3. **How does routing work?** Free-text intent ("i want to…") classified at
   the top of the skill, vs. explicit subcommands (`/deckbuilder draft <slug>`).
4. **Approval gates**: every route that builds something keeps a hard
   plan-approval stop, same as `/new-deck` today. Confirm no route is exempt.
