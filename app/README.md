# app/ — Oppr Deck Studio App (Deck Studio 2.0)

A local, single-user web app over the Supabase backend. **The CLI creates; the
app changes and ships.**

```
cd app
npm install        # pdf-lib, and Chromium for printing
npm run dev        # -> http://127.0.0.1:4173
```

**Hosted:** https://deck-manager-oppr.vercel.app — same `server.mjs`, same router,
same gate. Vercel runs it as the root entrypoint via its default export; `npm run
dev` wraps the identical handler in an http server. There is deliberately no
separate serverless implementation, because two implementations is how a hosted
app and a local app quietly stop behaving the same.

Deploy with `npx vercel deploy --prod` from `app/`.

No install step, no dependencies: the server uses only Node built-ins (Node 18+).
It also needs **Python on PATH** (library index, verify, element export),
**Chrome or Edge** (printing), and **git** (slide version history).

## Signing in

Supabase Auth, email magic link. **Only @oppr.ai addresses can have an account**,
and that is enforced by a trigger on `auth.users`, not by the UI — a wrong domain
is refused at signup, so the account never exists. No password is typed, stored
or sent.

`profiles` is the account registry (email, name, role, disabled, last seen).
Roles: **owner** manages people, **editor** changes artifacts, **viewer** reads.
New colleagues arrive as `editor`, because the domain is the gate; an owner can
demote or remove access on the Accounts page, but not their own.

Every `/api` call carries the session token. `/repo` and `/deck-cache` are gated
by an HttpOnly cookie instead, because an `<img>`, an `<iframe>` and a download
link cannot send an Authorization header — and those two paths serve the whole
image library and every rendered deck.

`python tools/check-access.py --app-url <url>` is the proof: 26 adversarial
checks that assert refusals, not happy paths. Run it after any change to
policies, roles or the signup gate.

## Rendering and verification, anywhere

Printing picks its backend from what exists: the installed Chrome or Edge
locally, a packaged Chromium (`@sparticuz/chromium` + `puppeteer-core`) on
Vercel. A 12-slide deck prints in about 19s in the cloud, at exactly
13.333 x 7.5 in — the same geometry the local browser produces, which the verify
gate checks to 0.02 in.

The gate itself is `lib/verify.mjs`, a deliberate port of `tools/verifylib.py`
with the same codes and the same `PAGE_FORMATS` table. The app uses the JS gate
in **both** environments, so its answer never depends on where it is running.
`python tools/check-verify-parity.py` runs both over every published artifact and
fails if they disagree — that check is the reason a second implementation is
allowed to exist at all.

## The boundary, in one table

Every capability sits on exactly one side. Where the app cannot do something it
hands you a prompt — click it to copy — instead of failing silently.

| The CLI creates | The app changes and ships |
|---|---|
| A new deck, carousel, post or article | Edit text, spacing and images in place |
| A new library slide or design-system block | Save a new version (immutable) |
| Any **structural** change (add/remove/reorder a page) | Rename the artifact and its PDF |
| New image generation, ingest, research runs | Regenerate + download the PDF |
| | Personalize a master into a customer deck |
| | Mark posted, track the publish log |
| | Download a single library element |

The wall is enforced in code, not by convention: `app/lib/htmlcheck.mjs`
fingerprints the document on every save and rejects anything that is not
text/attribute-level, so a structural edit cannot slip through the browser.

## One artifact model

A deck, a carousel and a social image are **the same kind of record**, told apart
by `kind`. That is what lets one editor, one verify gate, one build job and one
version history serve all of them.

| | |
|---|---|
| `decks` | every artifact: `kind` (deck·carousel·image·article·post), `page_format`, clearance, master flag, `pdf_core` |
| `deck_versions` | the content, one immutable row per version (`html`, `verify_report`, `pdf_object`) |
| `deck_assets` | its bundled images and fonts |
| `publish_log` | posted / not posted, date, link, archived |
| `app/.deck-cache/` | **pure cache** — rebuilt from the backend on demand, safe to delete at any moment |

`page_format` (`deck-16x9`, `linkedin-4x5`, `square-1x1`, `hero-1200x627`) decides
the page geometry and which verify rules apply. It is **declared**, never guessed
from the bytes.

## Areas

- **Customers** — a customer, its decks, and the intake that stages a new one to
  `dump/_app/` for the CLI to file.
- **Decks** — masters, company decks, customer decks. Every row carries the same
  actions: **Open · Edit · PDF**.
- **Social output** — carousels, images and articles, tabbed by category, with
  publish status. Same rows, same actions: social is not a different system.
- **Library** — slides, graphics, icons, design system. Each slide and block can
  be **downloaded on its own** as self-contained HTML, PNG or PDF.
- **Last 30 days** — the research brain, runs, ideas and performance (read-only).
- **Knowledge** — design philosophy, best practices, recipes, config.

## The PDF is always the version you are looking at

This is the rule the whole download path exists to keep.

A version saved in the editor has no PDF until something prints one. Downloading
such a version **prints it on demand and waits**, then serves it — it never falls
back to an older version's file. The filename comes from the server
(`Content-Disposition`), so what lands in your Downloads folder is the name the
system computed.

If verify FAILs, the PDF is **not** attached to the version and the response is a
409 carrying the report in plain language. You can still take the file via
**Download anyway**, which serves it prefixed `UNVERIFIED_` and never records it
as the PDF of record.

Naming: `<date>_oppr_<core>[_<client>].pdf`, or `oppr_<type>.pdf` for a master.
**Rename** lets you set `<core>` and the title; the date, the `oppr` token and the
client slug stay system-owned, because `verify-deck.py` FAILs a PDF missing them
and a rename must not be able to defeat a gate.

## Editing: three verbs, or the HTML itself

Click text and retype, nudge spacing, swap an entitlement-filtered image. When
that is not enough, **HTML** in the editor bar opens the live source of the page
you are on — edit it and **Apply** to see it immediately.

A line under the box tells you what will happen *before* you save:

| | |
|---|---|
| **Text and attributes only. This will save.** | it is within the wall |
| **This changes the structure…** | the save will be refused and handed to the CLI |
| **That is not valid HTML yet.** | Apply is a no-op until it parses |

That last check is the same question the server's fingerprint asks; asking it
locally as you type just means you find out before typing a page of changes.
Applying only touches the live document — nothing is written until **Save
version**.

## Title-page thumbnails

Every artifact row shows page 1. Thumbnails are rendered **on demand** the first
time one is asked for (`/api/decks/:id/versions/:n/thumb`), from the version's
PDF, or by screenshotting its HTML when there is no PDF — so CLI-published and
imported artifacts get a picture too, not a grey placeholder. Each render is
uploaded once, so a wiped cache costs nothing the second time.

## Verification, said in words

`verify_report` is structured (`{level, code, slide_id, msg}`). `web/js/verify.js`
turns each code into a sentence and says who fixes it — **fix here**, **needs the
CLI**, or **your call** — rather than showing a count. A clean report and no
report are different states and read differently.

## How it works

- **`server.mjs`** — a localhost HTTP server holding the Supabase secret key
  (never sent to the browser). Serves the front-end, repo files read-only under
  `/repo/…`, the materialized cache under `/deck-cache/…`, and the API. Writes
  only staging areas (`dump/_app/`, `decks/drafts/`, `social/drafts/`) and the
  backend; never `library/`, `brand/` or `templates/`.
- **`lib/jobs.mjs`** — printing and the build job. Runs the **same**
  `tools/verify-deck.py` gate the CLI runs.
- **`lib/htmlcheck.mjs`** — the structural fingerprint that keeps the wall honest.
- **`lib/deckcache.mjs`** — materializes a version to disk for the iframes and
  the printer.
- **`tools/build_app_index.py`** — Python owns all YAML, so the Node server needs
  no YAML parser. Emits `app/index.json` (gitignored); rebuilt on start and on
  **Refresh**.
- **`web/`** — plain ES modules, no build step.

Design rationale: `.scratch/deck-studio-2/MAP.md` (current) and
`.scratch/deck-app/hybrid-editor/report_and_implementation.md` (the v3 backend).
