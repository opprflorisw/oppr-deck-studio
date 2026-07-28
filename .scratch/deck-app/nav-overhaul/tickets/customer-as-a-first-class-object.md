# Customer as a first-class object

**Type:** grilling (+ domain-modeling) · **Blocked by:** — (unblocked by app-role) · **Status:** ✅ resolved 2026-07-23

## Answer (2026-07-23)

A customer is a **folder on disk, CLI-owned, read by the app.**

- **Storage:** `customers/<slug>/` — a small `customer.yaml` (name, slug, logo
  filename, notes) + the logo file. **No clearance field.**
- **Decks:** a customer's decks are matched by the `client:` slug on `deck.yaml` /
  `decks/variants/*` and shown under the customer.
- **Clearance:** unchanged — stays on `deck.yaml` / `library.json`. The app only
  reads and groups; no entitlement migration.
- **Ownership / writes:** `customers/` is created by the **CLI** (from a dump
  intake), never written by the app. Starting a customer in the app stages
  `name + logo + brief` into `dump/_app/<company>/`; `/ingest-dump` (or
  `/deckbuilder`) files it into `customers/<slug>/` and builds the first deck.
  Pending (not-yet-filed) customers can be surfaced in the app from `dump/_app/`.

**Re-wires:** *Company intake via the dump folder* and *Unified Archive & History
home* are now unblocked. The Customers-area layout (read `customers/`, list
companies, drill into a company's decks + pending intake) folds into the intake
ticket.

## Question

Customers is the home and decks live under each customer — so what *is* a customer,
in the repo and in the app?

To settle:
- Where a customer lives on disk: a `customers/<slug>/` folder? a registry file?
  or derived from the `client:` field on existing `decks/variants/*`? Reuse the
  existing entitlement slugs (mutares-family, named-customer, per-client slugs).
- What it holds: display name, logo, clearance/entitlement, notes, and the link to
  its decks (variants) + any intake in progress.
- How existing frozen variants map onto customers (by `client:` / slug).
- Whether the app *writes* any of this or only reads it — staging discipline: a
  new customer's logo + brief go to `dump/_app/<company>/` for the CLI to file.
- The minimum the CLI needs to build a customer deck from a dropped logo.

Root of the customer cluster: *Company intake via the dump folder* and *Unified
Archive & History home* depend on the model chosen here.
