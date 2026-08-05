# 04 — What counts as drift when the app has already edited the page

- **type:** grilling
- **status:** closed 2026-08-04
- **assignee:** Claude + Floris (claimed 2026-08-04)
- **blocked by:** 01
- **blocks:** 05, 09

## Question

Flag-and-accept assumes a page can be compared to its mother. But the app edits
published HTML in place, so a page's text can already differ from the library
slide it came from. When the mother then changes, what happens to that page?

Settle:

- **Does a library slide get a version number?** Today it is a file under git and
  nothing records "slide X changed on date Y". Something has to, or "behind"
  cannot be computed. Git history, a `version:` in `meta.yaml`, or a content hash?
- **What is the rule for a page that was edited in the app?** Three candidates:
  **detach** (the page is marked as no longer following its mother, and you can
  re-link and lose your edit), **override** (the edit is recorded per element, so
  unedited parts still update and edited parts keep your text and get flagged), or
  **block** (the app refuses free-text edits on linked pages, and only the
  personalization slots stay editable).
- **What is the unit of accept?** Whole deck, or page by page? Floris chose "per
  deck (or per page)" at charting without picking between them.
- **What about a change that is only cosmetic** (spacing, an image swap)? Does it
  raise the same flag as a wording change, or is there a severity?

`app/lib/htmlcheck.mjs` already fingerprints every save server-side to prove it is
structure-preserving, so it can already tell which text nodes changed. Whatever is
decided here should reuse that, not invent a second comparison.

## Answer — closed 2026-08-04

### Two of the four questions were already answered elsewhere

- **Does a library slide get a version number?** No. Ticket 01 settled it: drift is
  a **content-hash** comparison, so there is no library version bookkeeping.
- **Is there a severity tier?** No. Floris rejected graded flags in ticket 01:
  *"any change"*. A change is a change; the side-by-side shows what it is.

### The stable-element-id requirement is withdrawn

Ticket 07 found that Figma loses an override when a layer is renamed, and this
ticket therefore required stable ids on every text-bearing element, with ticket 02
warning that back-filling them during the refresh would be cheaper than a second
pass over 47 fragments later.

**Reading `app/lib/htmlcheck.mjs` shows that work is unnecessary.** `fingerprint()`
tokenises the tag stream plus `class`, `data-slide-id`, `data-role` and
`data-slot`; text is not in the fingerprint and `style` is excluded. `validateSave`
rejects any save whose fingerprint differs from the version it edits. So **the tag
stream is byte-identical across every version of a deck, enforced server-side**.

Position in that stream is therefore already a stable element identity, for free.
The Figma failure cannot occur inside a deck's history, because the app is
structurally incapable of causing it. No ids, no library migration.

### The rule

Compare `fingerprint(mother_old)` against `fingerprint(mother_new)`:

- **Fingerprints equal** (a text-only change upstream, the common case): **merge by
  position**. Positions Floris never edited take the new wording; positions he did
  edit keep his text and are listed in the accept view. Automatic and safe.
- **Fingerprints differ** (a structural change upstream, CLI-only and rarer):
  position mapping is no longer trustworthy, so there is no safe merge.
  **Replace the page**, and before accepting, list every local edit that will be
  discarded with its old and new text side by side so it can be copied out first.

Floris chose replace-and-show over detach and over a per-case prompt. Detaching was
rejected for the right reason: a detached page keeps its old wording forever and
stops appearing in any future flag, which is precisely the failure this whole
effort exists to remove.

**Unit of accept:** per page, with an accept-all on the deck. Recommended rather
than grilled, since it is a surface decision that belongs to ticket 05.

**Keep both** (the Templafy / SlideLizard model surfaced by ticket 07) is not
available here: inserting a page beside another is a structural change to the deck,
which is CLI-only by the boundary rule. Noted so it is not re-proposed.

## Amended by ticket 07 (competitive scan, 2026-08-04)

Three changes, from how other tools actually resolved this:

- **There is a fourth option: keep both.** Templafy (unlocked slides) and
  SlideLizard ("Insert Copy") insert the new page *beside* the old one and mark the
  old as outdated, rather than merging. It needs no per-element merge logic at all.
  Add it to the candidates.
- **Element-level override is real, but Figma pays for it** by forbidding
  structural change to an instance. Our `htmlcheck.mjs` already forbids exactly
  that, so the price is one we have already paid. The recommendation below stands,
  with its cost now stated rather than assumed.
- **Overrides need stable element identity.** Figma retains an override by matching
  layer names, and *loses it when a name changes*. Applied here: if a mother-slide
  edit reorders or renames paragraphs, a local edit is silently discarded. So this
  ticket also has to decide whether every text-bearing element in a slide fragment
  gets a stable id, who assigns it, and whether the 47 fragments are back-filled
  with ids during the slide refresh (ticket 02) while they are being touched
  anyway. This is a new requirement on the library slide format and it did not
  exist when this ticket was written.

## Recommended answer to react to

Content hash per library slide, so "behind" is a hash mismatch and needs no
version bookkeeping. **Override** rather than detach, since detach throws away the
link the whole map exists to create, and htmlcheck already gives us the per-node
diff for free. Accept per page, with an "accept all" on the deck. No severity
tiers in v1: a change is a change, and the side-by-side shows you what it is.
