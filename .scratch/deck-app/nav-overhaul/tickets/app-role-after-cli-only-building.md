# App role after CLI-only building

**Type:** grilling · **Blocked by:** — (root ticket) · **Status:** ✅ resolved 2026-07-23

## Answer (2026-07-23)

The app is a **customer-first cockpit**, not a builder. Purpose:

> Browse, organize and archive Oppr's decks and outputs, and kick off customer
> decks by handing the CLI a company + brief. Building stays in the CLI.

**Top-level IA (sidebar order):**
1. **Customers** — the home. Each company shows its logo, its shipped decks
   (today's frozen variants, relocated here), and a "+ New" intake (drop logo +
   brief → `dump/` → CLI builds).
2. **Output** — tabs **Masters** (canonical master decks) · **Social output**
   (public carousels / posts).
3. **Library** — Slides · Graphics · Icons · Design system.
4. **Knowledge** — the docs.

**Create is removed** (composing moves to the CLI; the code's fate is its own
ticket). Frozen variants move from Output to under their customer; canonical
masters stay in Output.

**Graduates / re-wires:** "Customers" becomes a first-class object → new ticket
*Customer as a first-class object*, now the root of the customer cluster.
*Company intake via the dump folder* and *Unified Archive & History* block on it.
*Fate of the in-app builder* is unblocked.

## Question

Now that every deck and social output is built in the CLI, what is the Deck
Studio App actually *for*, and what are its top-level areas?

Sub-questions to settle:
- Is the app now **browse + organize + archive + intake** (no composing)? Or does
  a slimmed "assemble a brief" role survive?
- What are the sidebar areas after **Create** is removed? Candidates:
  Library · Output · Knowledge · **Intake/Customers**?
- Where does the company-intake flow (logo → dump → CLI) live in the IA — its own
  area, or folded into an existing one?
- One-line purpose statement the whole app is designed around.

This is the root: *Company intake via the dump folder*, *Fate of the in-app
builder*, *Unified Archive & History home*, and *Wayfinding polish* all hang off
the answer.
