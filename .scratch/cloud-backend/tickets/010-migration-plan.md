# migration plan

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `001` · `002` · `003`

## Question

How do we get from here to there without breaking the current workflow?

The local workflow must keep working throughout: `/deckbuilder`, the verify gates,
and a repo a fresh clone can build from. Six built outputs and the whole slide
library already exist and are committed.

Produce a staged plan where each stage is independently shippable and reversible,
with the order justified. Say explicitly which stage first makes display names
editable, since that is the pain that started this effort, and whether it can land
before the cloud move rather than after.
