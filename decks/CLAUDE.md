# decks/ — build scratch, not a store

**A deck does not live here. It lives in the backend.**

`decks/<slug>/` is a **workspace the CLI assembles into and then publishes from**.
Once `tools/publish-deck.py` has run and the version is confirmed in Supabase,
the folder has served its purpose and can be deleted. Nothing here is the source
of truth for anything, and nothing here is committed (see `.gitignore`).

## Where a deck actually lives (Deck Studio 2.0, 2026-08-01)

| Thing | Store |
|---|---|
| A deck's identity (slug, title, type, client, clearance, master flag) | `decks` table |
| Its content, one immutable row per version | `deck_versions` (`n`, `html`, `change_note`, `verify_report`, `pdf_object`) |
| Its images and fonts | `deck_assets` + Storage |
| The rendered version you are looking at | `app/.deck-cache/<deck-id>/v<n>/` — **pure cache**, rebuilt from the backend on demand, safe to delete at any moment |

## Versioning: `deck_versions.n`, and nothing else

A new version of a deck is a **new row**, made either by the app (edit → Save
version) or by the CLI:

```powershell
python tools\publish-deck.py decks\<slug> --version-of <deck-slug>
```

**Never `<slug>-v2/`.** Folder-suffix versioning is how the system drifted: it
ran `engagement`, `engagement-v2`, `-v3`, `-v4` on disk in parallel with the real
version history in the backend. Those folders were reconciled (they *were*
versions 1-4, each already published with its PDF) and deleted on 2026-08-01. Do
not recreate that pattern.

The old `canonical/<type>@vN` **git tags are retired** too. A master is a flag on
a deck row (`is_master`, one per type), moved with the app's master toggle or
`POST /api/decks/:id/master`. Git versions the tool, not the content.

## Building a deck

```powershell
python tools\assemble-deck.py decks\<slug>
.\tools\build-pdf.ps1 -Deck decks\<slug>
python tools\verify-deck.py decks\<slug>
python tools\publish-deck.py decks\<slug> [--master --type <t>] [--customer <slug>] `
    [--derived-from <deck-slug>] [--version-of <deck-slug>]
```

Then **confirm it landed** — a row whose bytes never uploaded looks healthy from
the CLI's output. Query it back and download one object (see "Nothing is done
until it is in the backend" in the root `CLAUDE.md`). Then delete the folder.

To build from an existing deck, `python tools\fetch-deck.py <slug>` first and use
the fetched HTML as the content source.

## drafts/

`decks/drafts/<slug>/` is **staging**, deliberately unpublished: material the app
staged for a CLI session to turn into a real deck. It is the one thing here that
is not disposable build output, and it is emptied by building it, not by deleting
it.

## Personalizing

Personalization is variables and slots, never editing the library. A master is
personalized into a customer deck through the app (which checks the result is
fingerprint-identical to the master and records lineage), or in the CLI with
`--derived-from`. Named-customer material requires that customer's clearance slug
in `allowed_entitlements`; `verify-deck.py` enforces it mechanically.
