# user proof contract

`wayfinder:grilling` · child of `../MAP.md` · unassigned

## Question

What does "user proof" actually mean, as a checkable contract?

Named in the original brief and worth pinning down before the architecture hardens.
A concrete instance already happened: deleting an output left a stale row in
`app/index.json` that could not be deleted, because the cache outlived the folder
and the endpoint answered 404. The class of bug is "the UI shows something the
backend no longer agrees exists".

Produce a short list of guarantees, each one testable. Likely candidates: no
destructive action without a reversible alternative offered; no dead-end states
where the UI and the store disagree; every destructive action attributed and
logged; caches never authoritative; validation at the boundary rather than in the
UI; and a clear surface for build failures.
