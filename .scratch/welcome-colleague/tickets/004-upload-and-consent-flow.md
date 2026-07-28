# upload and consent flow

`wayfinder:grilling` · child of `../MAP.md` · unassigned

## Question

By what mechanism does a colleague's photo get into the pipeline, and how is the
consent gate and transient-storage rule enforced?

The *principle* is decided (consent required; source photo not committed; only the
finished cartoon and post ship). This ticket decides the *mechanism*:

- How the photo enters: the existing `dump/` + `/ingest-dump` path, the app's
  `import-graphics` staging (`dump/_app/`), or a new direct upload. Note these are
  people photos, not brand images - the existing ingest flow files images into
  `brand/img/` with manifest entries, which the standing decision says we do NOT
  want for raw headshots.
- Where the transient headshot physically lives while generation runs, and what
  guarantees it is not committed (gitignore path, cleanup after build).
- How consent is recorded - a required field/checkbox in the flow, a note in the
  brief, or out-of-band. It needs to be visible enough that no one generates a
  cartoon of someone who did not agree.
- Whether the finished cartoon (a likeness) is itself committed like other
  generated images, or also treated as sensitive.

Independent of the image recipe. Unblocked.
