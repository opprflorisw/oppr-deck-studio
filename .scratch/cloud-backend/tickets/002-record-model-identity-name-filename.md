# record model identity name filename

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001`

## Question

What is the record model for an output: how do a stable identity, a mutable display
name and a derived filename relate?

The problem this map opened with. Today `2026-07-23_cant-put-your-finger-on-it` is
one string doing four jobs: folder name, key in `social/_status.json`, key in
`app/index.json`, and stem of the PDF filename. That is precisely why renaming is
impossible.

Define concretely:

- **Identity** - opaque and permanent, or the current slug promoted to an id? Does
  it survive a rename, a move between channels, and a rebuild?
- **Display name** - freely editable, and where it is stored.
- **Filename** - still *derived* and rule-enforced. `deck_pdf_name.py` computes it
  and `verify-deck.py` FAILs a name missing `oppr` or the client slug. Editable
  display names must not weaken that control, so say exactly what the filename is
  derived from once the folder name is no longer identity.
- **Slug / URL** - stable permalink, or does it follow the display name with
  redirects from old ones?
- What happens to the six existing outputs and their committed history.
