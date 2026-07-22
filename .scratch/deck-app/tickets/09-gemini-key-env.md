---
id: 09
title: Rotate Gemini key + .env handling
type: task
status: open
assignee:
blocked-by: []
---

## Question

The Gemini API key was pasted in plain chat (2026-07-22) — treat as exposed.
HITL checklist for Floris:

1. In Google AI Studio, **delete/rotate** the pasted key and create a fresh one.
2. Store the new key in `<repo>/.env` as `GEMINI_API_KEY=...` (create the file;
   tell Claude when done — never paste the key in chat again).
3. Claude side: add `.env` to `.gitignore`, add `.env.example` with the
   variable name only, and note the convention in root CLAUDE.md.

Resolved when the old key is dead and the new one lives only in `.env`.

## Partial resolution (2026-07-22)

Claude side **done**: `.gitignore` ignores `.env`; `.env.example` created with
`GEMINI_API_KEY` (name only); the convention is documented in root CLAUDE.md
(Setup + Rules). **Still open — Floris's action:** rotate/delete the key pasted
in chat and put the new one only in `.env`. Ticket stays OPEN until that is done.
