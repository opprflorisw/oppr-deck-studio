---
id: 07
title: Gemini image generation — capabilities & fit
type: research
status: open
assignee: claude (subagent)
blocked-by: []
---

## Question

Facts for the later image-generation phase (docs only — do NOT use any API
key):

1. **Current Gemini image models** (as of mid-2026): names, what each is good
   at (photoreal vs illustration), REST/Python usage with an API key from a
   `GEMINI_API_KEY` env var.
2. **Controls**: aspect ratios (16:9 slide, 4:5 carousel), style steering
   (can we hold a consistent brand look: warm paper, terracotta accents,
   industrial subject matter), text-in-image quality, editing/variation of an
   existing image.
3. **Pricing** per image and rate limits on the standard API-key tier.
4. **Pipeline fit**: recommended flow for generated images entering
   `brand/img/` — file naming, a `source: generated` field + description/tags/
   entitlement in `library.json`, and licensing/usage terms for commercial
   decks.

Findings → `.scratch/deck-app/research/07-gemini-imagegen.md`, cited.
