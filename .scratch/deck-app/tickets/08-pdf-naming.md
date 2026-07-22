---
id: 08
title: PDF naming convention & enforcement
type: grilling
status: closed
assignee:
blocked-by: []
---

## Question

Every built PDF must be recognizably Oppr's, and client decks must carry the
client. Confirm the pattern and where it's enforced (small ticket):

1. **Pattern**: `YYYY-MM-DD_oppr_<type-or-purpose>[_<client>].pdf` — today's
   builds already follow the first half (`2026-07-21_oppr_product-showcase.pdf`).
   Confirm: client slug appended for named-client variants; lowercase;
   hyphens; LinkedIn outputs follow the same rule.
2. **Enforcement**: `build-pdf.ps1` derives the name from deck.yaml
   (type + client field) instead of trusting the caller, and `verify-deck.py`
   FAILs a PDF whose name lacks `oppr` or (for a client deck) the client slug.
3. **Edge**: client name in the *filename* of a deck cleared for that client
   is fine — but never for merely "prepared for" decks that aren't entitled?
   Or is filename-level naming always OK because the file goes only to that
   client? Decide the rule.

## Resolution

Built 2026-07-22. Pattern `YYYY-MM-DD_oppr_<type-or-purpose>[_<client>].pdf`
(canonical `oppr_<type>.pdf`). `deckstudio.pdf_name()` derives it from deck.yaml
(top-level `client:` for named decks); `build-pdf.ps1` uses it via
`tools/deck_pdf_name.py`; `verify-deck.py` FAILs a PDF missing `oppr` or the
client slug (WARNs if the name differs from derived). The 3 existing PDFs were
renamed to comply and all decks re-verified PASS. LinkedIn PDFs follow the rule.
