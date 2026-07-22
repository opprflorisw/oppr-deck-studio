# Image library semantics — findings

**Ticket:** how should the image library describe its contents so a build-time
assembly step (Claude) can retrieve an image *by meaning* ("get me something
that reinforces 'operators are the sensor'") instead of by remembering
filenames?

**Bottom line:** add a small, hand-checkable **JSON sidecar manifest**
(`brand/img/library.json`) that carries a one-line description + tags +
suggested-use phrases per image, regenerated alongside the contact sheet. At
this scale **Claude reading that manifest at build time _is_ the semantic search
engine** — no embeddings, no vector DB. Skip the pipeline.

---

## 1. Current reality

- **23 images**, three flat groups (verified by walking the tree):
  - `brand/img/` (root, 4): `capture.jpg`, `connect-timeline.jpg`,
    `execute-loop.jpg`, `hero-plate.jpg`
  - `brand/img/customers/` (8): logos — `attero`, `holliday`, `host`,
    `keeeper`, `mutares`, `omniplast`, `selo`, `sonneborn`
  - `brand/img/product/` (11): `logs-app-*`, `logs-desktop-*`, `ida-*`,
    `docs-showcase`, `platform-loop`
- **Naming is already semantic-ish** (`ida-laptop-wall-thickness`,
  `logs-app-round`) but encodes *module + device*, not *message* — useless for
  "operators are the sensor".
- **`tools/build-asset-index.ps1`** just globs the folder, groups by parent, and
  emits `index.html` with filename captions. No descriptions anywhere.
- **A description source already exists but is trapped in the decks:** every
  `<img>` in the two live decks carries a hand-written, meaning-rich `alt`, e.g.
  `hero-plate.jpg` → *"Operator on the plant floor capturing an observation on
  his phone"*; `platform-loop.png` → *"The Capture, Connect, Execute loop:
  operator context above the timeline, machine data below"*. These are the seed
  descriptions — harvest them rather than invent from scratch.
- **Entitlement rule matters (per CLAUDE.md):** named customer imagery
  (Holliday/Venator) may only appear in decks for entitled audiences. Retrieval
  must be able to *exclude*, so gating has to live in the manifest, not just in
  Claude's memory.

---

## 2. Three approaches

### A. Filename convention + tag list only (lightest, weakest)
Encode meaning into names / a flat `tags.txt`, retrieve by keyword grep.
- **+** zero new format; trivial.
- **–** No room for a real sentence of meaning; "operators are the sensor" won't
  match `capture.jpg` unless someone pre-guessed the exact keyword. Brittle,
  and it fights the existing module-based naming. **Rejected.**

### B. JSON sidecar manifest + Claude-as-retriever (recommended)
One `brand/img/library.json`, one object per image: `description`,
`tags`, `suggested_use` (message-level phrases), plus practical fields
(`orientation`, `type`, `entitlement`). At build time Claude reads the whole
file (it's a few KB) and does the meaning-match itself.
- **+** The "understanding" is the natural-language description; the LLM already
  excels at fuzzy semantic matching over 23 short records held in context. No
  runtime, no index to stay in sync, human-readable/diffable, git-friendly,
  survives the "don't remember filenames" requirement completely.
- **+** `entitlement` field lets the same query respect the Mutares-family rule.
- **–** Descriptions are authored once (Claude vision pass) and must be
  refreshed when images change — cheap, and the build script can flag drift.

### C. Local embedding / semantic index (overkill here)
Embed descriptions (sentence-transformers) or images (CLIP) into vectors, query
by cosine similarity.
- **+** Scales to thousands of assets; ranked recall.
- **–** New Python deps, model download, an index file to rebuild and keep in
  sync, and a similarity score that Claude would only re-read anyway. For **~two
  dozen** images it adds a moving part to solve a problem Claude already solves
  for free by reading 23 lines of JSON. **Overkill — revisit only past ~150–200
  images**, and even then embeddings over the *descriptions* (not raw pixels)
  would be the first step, reusing manifest B.

**Verdict:** B. The corpus fits in context; the model is the retriever. An
embedding pipeline buys nothing at this scale and adds sync burden.

---

## 3. How the build-time query actually works

No tool call, no query language. During a deck build Claude:

1. Reads `brand/img/library.json` (already in the repo it's editing).
2. Reads the slide's message (e.g. *"operators are the sensor on the floor"*).
3. Matches intent against `description` + `suggested_use` + `tags`, filters out
   any `entitlement` the target audience isn't cleared for, and picks the best
   fit — writing the chosen file into the `<img src>` and reusing the manifest
   `description` as the `alt`.

So the manifest does double duty: retrieval index *and* alt-text source.

---

## 4. Manifest sketch (real entries)

`brand/img/library.json`:

```json
{
  "images": [
    {
      "file": "hero-plate.jpg",
      "group": "root",
      "type": "photo",
      "orientation": "landscape",
      "entitlement": "public",
      "description": "Operator on the plant floor capturing an observation on his phone.",
      "tags": ["operator", "shop-floor", "capture", "human", "mobile", "hero"],
      "suggested_use": [
        "operators are the sensor",
        "augment don't replace",
        "cover / opening emotional hook",
        "the human context machines can't see"
      ]
    },
    {
      "file": "capture.jpg",
      "group": "root",
      "type": "photo",
      "orientation": "landscape",
      "entitlement": "public",
      "description": "Film still of an operator logging what he sees in the moment it happens.",
      "tags": ["operator", "capture", "field", "attention", "human"],
      "suggested_use": [
        "operators are the sensor",
        "Capture step of Capture -> Connect -> Execute",
        "catching signal at the source"
      ]
    },
    {
      "file": "product/platform-loop.png",
      "group": "product",
      "type": "diagram",
      "orientation": "square",
      "entitlement": "public",
      "description": "The Capture -> Connect -> Execute loop: operator context above the timeline, machine data below.",
      "tags": ["framework", "loop", "capture", "connect", "execute", "diagram"],
      "suggested_use": [
        "explaining the three moves",
        "how the product works end to end",
        "connect human + machine signal"
      ]
    },
    {
      "file": "customers/holliday.png",
      "group": "customers",
      "type": "logo",
      "orientation": "landscape",
      "entitlement": "mutares-family",
      "description": "Holliday (Venator) customer logo.",
      "tags": ["logo", "customer", "reference"],
      "suggested_use": ["named reference — Mutares-entitled decks only"]
    }
  ]
}
```

**Worked query — slide says "operators are the sensor", audience = public:**
Claude scans the array, sees `hero-plate.jpg` and `capture.jpg` both list that
exact phrase in `suggested_use`; picks `hero-plate.jpg` for a cover (hero tag) or
`capture.jpg` inline; skips `holliday.png` because `entitlement` = `mutares-family`
≠ the public audience. Chosen `alt` = the manifest `description`.

---

## 5. Fit with the existing tooling

- Extend **`build-asset-index.ps1`** minimally: after globbing, load
  `library.json`, (a) render each `description`/`tags` under its thumbnail in
  `index.html` so the human contact sheet becomes self-documenting, and (b)
  **print a warning for any image file with no manifest entry and any manifest
  entry with no file** — that's the whole "stay in sync" mechanism.
- **Seed descriptions** for the current 23 by harvesting the `alt` text already
  in the two decks, then a one-time Claude vision pass fills the rest and the
  `suggested_use` phrases. Author `suggested_use` in the deck's own vocabulary
  (Capture→Connect→Execute, "augment don't replace") so slide messages and image
  metadata share a language — that's what makes meaning-matching reliable.
- Keep it one file, checked into git, edited by hand or by Claude. If the library
  ever crosses ~150 images, layer embeddings over these same `description`
  strings — the manifest is forward-compatible.
