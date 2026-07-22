---
id: 07
title: Gemini image generation — capabilities & fit
type: research
status: closed
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

## Resolution

Researched 2026-07-22 against official Google AI docs. Current lineup is the
Nano Banana family: `gemini-3.1-flash-image` (NB2, the workhorse; 0.5K-4K,
ten aspect ratios incl. 16:9 and 4:5), `gemini-3-pro-image` (Pro, best text
rendering/design), `gemini-3.1-flash-lite-image` (cheap, 1K only). Imagen 4 is
deprecated and shuts down 2026-08-17. New Interactions API
(`POST /v1beta/interactions`, GA 2026-06-22) is the primary surface; the
`google-genai` SDK reads `GEMINI_API_KEY` automatically. Cost ~$0.067-0.101
per NB2 image (1K-2K), ~$0.134 Pro; no free tier for image models (Tier 1
billing needed). Consistency via up to 14 style/character reference images
(no seeds). Google claims no ownership, commercial use fine, but no IP
indemnity on the API-key tier; all images carry SynthID. Manifest schema for
`source: generated` entries (prompt, model, date, style refs) proposed.
Full findings: [../research/07-gemini-imagegen.md](../research/07-gemini-imagegen.md)
