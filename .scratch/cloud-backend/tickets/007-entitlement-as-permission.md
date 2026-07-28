# entitlement as permission

`wayfinder:grilling` · child of `../MAP.md` · unassigned

**Blocked by:** `006`

## Question

How does entitlement stop being a convention and become access control?

`public` / `named-customer` / `mutares-family` are enforced today by verify scripts
at build time on one laptop, plus `allowed_entitlements` in `deck.yaml` and an
`entitlement` field per image in `brand/img/library.json`. The rule that
Holliday and Venator material appears only in mutares-family decks is a lint, not
a lock.

With a team and cloud storage, define: whether entitlement gates *retrieval* (can
this user even list this asset) as well as composition; how it maps onto storage
(separate buckets, object ACLs, signed URLs only); what happens to an already-built
PDF that contains cleared material; and whether the build-time verify gate stays as
defence in depth.

Highest-consequence ticket on the map. Design against a leak as the failure mode.
