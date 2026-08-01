# Editor coverage and the edit wall

Type: prototype · Status: open · Blocked by: Artifact model

## Question

Which edits does the app allow, for which artifact types — and when the wall
says no, what does it say?

## Why it matters

The editor exists and is tighter than Floris expected. `editor.js` offers exactly
three verbs:

- **text in place** (contenteditable; Enter suppressed so no tags are injected;
  paste flattened to text; `—` auto-replaced with `–` per brand rule)
- **nudge** — 10 whitelisted properties: `margin-*`, `padding-*`, `gap`,
  `font-size`, `line-height`, `max-width`, clamped
- **image swap** — entitlement-filtered against `deck.allowed_entitlements`

Every save is re-validated server-side by `app/lib/htmlcheck.mjs` (123 lines) —
a structural fingerprint comparison. Anything else is rejected with a modal
telling you to run the CLI. Carousels, posts and articles have **no editor**.

## What a good answer settles

- Is the three-verb set enough for real fine-tuning, or is the missing verb the
  reason a one-word change still feels like CLI work? Candidates to test:
  reorder slides, delete a slide, duplicate a slide, swap a slide for another
  library slide, edit a list item count, change a colour token.
- Whether each added verb stays **structure-preserving** (so the fingerprint
  check still holds) or needs a different guarantee.
- Per artifact type: which verbs apply to a carousel frame, a post body, an
  article. A post may need a plain-text editor with a character counter rather
  than a DOM editor.
- What the **rejection** should say and offer: today a modal with a paste-able
  prompt. Should it copy to clipboard, save the partial edit, or offer to keep
  the non-structural half of the change?
- Whether overflow detection (already present — `checkOverflow()` badges the
  filmstrip) is trustworthy enough to block a save.

## How to resolve

`/prototype`. Take one real deck and one real carousel; drive the editor for the
edits Floris actually makes; find where it stops. The crux is behavioural, not
theoretical.

## Evidence to gather while resolving

- `app/web/js/views/editor.js`, `app/lib/htmlcheck.mjs`
- `templates/linkedin.css` — the 4:5 frame model
