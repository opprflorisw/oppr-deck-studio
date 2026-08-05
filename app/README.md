# app/ — Oppr Deck Studio App (Deck Studio 2.0)

A local, single-user web app over the Supabase backend. **The CLI creates; the
app changes and ships** — with one revision (2026-08-04): composing a deck from
library slides now happens on either side, via the **Deck builder** below.

## Deck builder (Work → Deck builder)

**A workspace bound to a deck**, not a place you go to make things. The route
says which deck you are in, and that is what makes the version rule structural:

| Route | What it is |
|---|---|
| `#/build` | the chooser: start a new deck, or open one of yours |
| `#/build/new` | a deck that does not exist yet; publishes as **v1** |
| `#/build/<deck-id>` | an existing deck; publishes as its **next version** |

**A version can only come from a deck.** There is no "new version of" dropdown:
a blank form is always a new deck at v1, and opening a deck is always its next
version, with the slug, client and clearance inherited and read-only. For a
variant rather than a version, **Save as a new deck** in the publish dialog
starts its own timeline and records where it came from.

You get there two ways: **Deck builder** in the sidebar, or **Edit slides** on
any deck. A deck's Edit is two doors, because the server already treats them as
two jobs — *Edit slides* (structure, here) and *Edit text* (words and images, in
the editor, enforced by `lib/htmlcheck.mjs`).

**The workspace is a slide sorter.** The grid is the deck: drag a page anywhere,
or use the arrows on each card. Chapters collapse into a rail on the left whose
only job is adding, because chapter order seeds a deck and then gets out of the
way. Everything that is not "which slides, in what order" is behind **Deck
details**.

**Preview** opens the deck full screen with its own footer and **real page
numbers** (07 / 16, not a placeholder), and you can reorder from inside it —
`Earlier` / `Later`, or Alt+arrow — because the moment you notice a page is in
the wrong place is the moment you should be able to move it.

**Clearance is checked while you pick.** A slide whose images need a clearance
this deck does not have is greyed out with the reason (`needs holliday
clearance`) instead of failing verify 40 seconds into a build. The rule is
computed from the same per-image manifest `verifylib` uses, mirrored into
`library_slides.entitlements` by `check-drift.py --sync`, so the picker and the
gate cannot disagree.

**Your work is saved as you go.** An open deck's working recipe lives on the deck
row (`decks.draft_recipe`), so it survives a reload and is not trapped in one
browser; a deck that does not exist yet keeps its draft locally until the first
publish gives it a row. A draft is never a version — the published deck and its
PDF are untouched until you publish — and both the deck list and the deck page
say **unpublished changes** so you cannot forget it.

**Archive** demotes a slide so it cannot be picked by accident — the case where a
chapter holds three versions and you want one of them. It is a backend flag, not
a repo edit: the app never writes `library/`. Archiving a slide that is already
picked removes it from the deck rather than shipping it silently. Make an archive
permanent with `python tools\check-drift.py --apply-archives`, which writes
`retired: true` into `meta.yaml` so git keeps the durable record.

**Check** runs everything except publish. **Publish** runs the CLI's own pipeline
(`tools/build-from-recipe.py`: compose → assemble → build-pdf → verify →
publish) as a background job, and the dialog shows those five gates arriving as
they finish, so you can see which one you are standing at. **Verify still
blocks** — a deck that fails is not published, and the failures come back in
words. On success it takes you to the deck, with the new version at the top of
its timeline and the PDF ready.

A slide that does not exist yet is still a CLI job, because it must compose only
from documented design-system blocks. The panel at the bottom of the rail writes
the prompt for you, including the chapter it must land in and the commands to run
afterwards; once it is filed and synced it appears in the picker.

**Building works hosted too** (2026-08-05). Locally the five gates are the CLI's
own Python (`tools/build-from-recipe.py`). Hosted there is no Python and no repo,
so the same five gates run in JavaScript over Supabase Storage:
`app/lib/assemble.mjs` composes and snapshots, `render.mjs` prints,
`verify.mjs` blocks, `publish.mjs` writes the rows.

It is one transform with two runners, not two pipelines.
`tools/check-assemble-parity.py` builds the same recipe both ways and diffs the
snapshot **byte for byte**, including the asset bundle, so they cannot drift
apart quietly — the same guard `check-verify-parity.py` gives the verify gate.
Run it (with `--via-storage` for the path that actually runs hosted) whenever you
change either assembler.

One difference is real and stays: hosted the build finishes inside the POST
rather than as a polled job, because a serverless instance can be frozen the
moment it answers and the next poll may land somewhere that never had the job.
That is affordable because the JS pipeline takes seconds where four Python
subprocesses took the better part of a minute.

```
npm install        # from the REPO ROOT, not from app/
npm run dev        # -> http://127.0.0.1:4173
```

**The Node project is the repo root; the app is `app/`.** `package.json`,
`package-lock.json` and `vercel.json` sit at the root with `"main":
"app/server.mjs"`, because Vercel builds a GitHub push from the repo root and a
root with no entrypoint is a failed build. One manifest, one lockfile, one
`node_modules`, and `git push` is the deploy.

Inside `app/` the split is the obvious one:

| | |
|---|---|
| `server.mjs` | the back end: one router, every route |
| `lib/*.mjs` | the back end's modules (auth, Supabase, verify, htmlcheck, render, jobs, deck cache, env) |
| `web/` | the front end: `index.html`, `app.css`, `js/` (plain ES modules, no build step) |

**Hosted:** https://deck-manager-oppr.vercel.app — same `server.mjs`, same router,
same gate. Vercel runs it as the root entrypoint via its default export; `npm run
dev` wraps the identical handler in an http server. There is deliberately no
separate serverless implementation, because two implementations is how a hosted
app and a local app quietly stop behaving the same.

Deploy by pushing to `main`. `npx vercel deploy --prod` from the repo root does
the same thing by hand.

Three dependencies, all of them for printing when hosted (`pdf-lib`,
`puppeteer-core`, `@sparticuz/chromium`); locally it prints with the Chrome or
Edge already on the machine. It also needs **Python on PATH** (library index,
verify, element export) and **git** (slide version history).

**Hosted, there is no repo on disk.** `server.mjs` points `REPO_ROOT` at a path
that cannot exist when `VERCEL` is set, so every read takes its Supabase Storage
fallback. That is deliberate: the builder traces a few repo JSON files into the
function, and a partial repo is worse than none — a `brain.json` frozen at deploy
time would quietly beat the synced one.

## Signing in

Supabase Auth, **email and password**. This replaced email magic links on
2026-08-03: a link meant a round trip through an inbox on every sign-in, it is
single-use so a second click reads as "broken", and the email rate limit could
lock you out of your own tool for an hour.

Two rules decide who can have an account, both enforced by triggers on
`auth.users` rather than by the UI, so neither depends on a dashboard setting:

1. **Only @oppr.ai addresses.** A wrong domain is refused at signup, so the
   account never exists rather than being created and cleaned up later.
2. **Only accounts an owner invited.** A password proves nothing about owning
   the mailbox, which a magic link did implicitly. So an owner records the
   invitation (`invited_emails`) and creates the account with its first
   password; creating it consumes the invitation, making it single use. There is
   no self-serve signup.

`profiles` is the account registry (email, name, role, disabled, last seen).
Roles: **owner** manages people, **editor** changes artifacts, **viewer** reads.
New colleagues arrive as `editor` unless the owner picks otherwise; an owner can
demote or remove access on the Accounts page, but not their own.

Add people on the **Accounts** page, or from the CLI when nobody can sign in yet
(a fresh deploy, a forgotten password):

```powershell
python tools\manage-users.py list
python tools\manage-users.py add colleague@oppr.ai --name "Their Name" --role editor
python tools\manage-users.py password colleague@oppr.ai
```

`add` and `password` generate a password and print it once. Pass it on; the
person changes it on the Accounts page. Anyone may change their own password,
including a viewer, because that sits above the editor gate.

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
| `decks` | every artifact: `kind` (deck·carousel·image·article·post), `page_format`, clearance, master flag, `pdf_core`, and the finding aids (`note`, `starred`, `post_text`) |
| `deck_versions` | the content, one immutable row per version (`html`, `verify_report`, `pdf_object`, `page_count`) |
| `deck_assets` | its bundled images and fonts |
| `publish_log` | posted / not posted, date, link, archived |
| `app/.deck-cache/` | **pure cache** — rebuilt from the backend on demand, safe to delete at any moment |

`page_format` (`deck-16x9`, `linkedin-4x5`, `square-1x1`, `hero-1200x627`) decides
the page geometry and which verify rules apply. It is **declared**, never guessed
from the bytes.

`page_count` is derived in the database from the `<section>` blocks, by a trigger
on `deck_versions`, so the CLI publisher and the app editor cannot disagree about
it and neither has to remember to set it.

## Areas

The sidebar is grouped, and the two administrative pages sit at the bottom behind
a rule because neither is somewhere you go to do the work.

**Work** — Customers · Decks · Social output · Last 30 days
**System** — Library · Knowledge
**Bottom** — Accounts · Settings

- **Customers** — a customer, its decks, and the intake that stages a new one to
  `dump/_app/` for the CLI to file.
- **Decks** — masters, company decks, customer decks.
- **Social output** — carousels, images and articles. Same rows, same actions:
  social is not a different system. On **All** you can look at it flat or grouped
  by type; posted state is a checkbox in one fixed column, so "what have I not
  posted yet" reads straight down the page.
- **Library** — slides, graphics, icons, design system. Each slide and block can
  be **downloaded on its own** as self-contained HTML, PNG or PDF.
- **Last 30 days** — the research brain, runs, ideas and performance.
- **Knowledge** — design philosophy, best practices, recipes.
- **Accounts** — who can sign in, and what they may do.
- **Settings** — the read-only browser over the studio's own knowledge files
  (this was Knowledge's Config tab).

### The overview answers "which one do I want?"

Every artifact row states how long it is, when it last changed and who changed
it, whatever you wrote about it, and whether you starred it. The note is edited
where it is read, the star sorts its artifact first in its section, and the
filter bar searches titles **and** notes — a deck you can only find by its exact
title is a deck you have to remember the title of.

**Edit is not in the list.** It is on the artifact's own page, one click in:
editing is something you do to an artifact you have already chosen, and an Edit
button on every row made every row look like a fork in the road. The row actions
are **Open · [Post text] · PDF**.

### Post text

A carousel or an image goes out with copy above it. **Post text** opens the
Unicode post editor: bold/italic/bold-italic (Mathematical Alphanumeric Symbols,
because LinkedIn has no rich text), the marks LinkedIn keeps, a live feed preview
with the 140-character fold, a character count against the 3.000 limit, **Copy
all**, and **Save**. Digits are deliberately never mapped — a bolded number
cannot be indexed and a screen reader spells it out.

The text lives on the artifact as `decks.post_text`, not in a file beside a build
folder. Saving it does **not** make a version: rewording a caption is not a new
carousel.

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
