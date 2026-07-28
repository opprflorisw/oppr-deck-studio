# cartoon recipe

`wayfinder:prototype` · child of `../MAP.md` · unassigned

## Question

Can we reliably turn a headshot into an on-brand cartoon we would actually post?

The make-or-break unknown. Using `derek.jpg` and `sanchay.jpg` in `dump/`,
prototype the generation until it produces a postable figure:

- A cartoon of the person with **recognizable features** (the whole point - it has
  to read as *them*).
- In **overalls** with the **Oppr logo** on them (`brand/assets/icon-bare-*.svg` or
  `wordmark-*.svg` for reference).
- On-brand illustration register (warm, restrained, terracotta/teal accents), not
  generic clip-art.
- **No baked-in text** - the "Welcome XXX" and role come from a template later
  (standing decision). The figure should sit on a plain or transparent background
  with room for that text.

Resolve via `/prototype` with `tools/generate-image.py`, passing the headshot as a
subject/character reference. Note whether the tool needs a subject-ref mode added
(it frames refs as *style* today). Record the exact prompt, the reference-image
handling, aspect ratio and background that worked, and attach the best output.

The answer feeds the image-template ticket (what background/shape the template
overlays) and the build-pipeline ticket. If the cartoon cannot be made
recognizable and on-brand, the whole feature's design changes, so this goes first.

HITL prototype.
