# concurrency and editing

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001` · `006`

## Question

What happens when two people work on the same thing at once?

The current app is single-user by construction: it writes whole JSON files
(`social/_status.json`, draft files) with last-write-wins and no locking, and the
index is a regenerated cache.

Define the concurrency contract - optimistic locking, per-record versioning, or
soft locks - what a teammate sees when someone else is editing, and what happens to
a build triggered while someone edits the source. If git stays the store, say how
concurrent commits are handled.
