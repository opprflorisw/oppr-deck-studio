# Prove it before it is public

Type: task · Status: open · Blocked by: everything above

## Question

Demonstrate that the access rules actually refuse what they should, before the app
is reachable from the internet.

## Why this exists as its own ticket

Floris chose "build it all, show me at the end". This is the one hold on that: the
difference between a bug and a customer-data leak is whether anybody checked. A
happy-path demo proves nothing about a leak.

## The checklist

Each of these must be executed and its output recorded, not reasoned about:

1. An authenticated colleague **without** a customer's clearance cannot read that
   customer's deck row. Assert the query returns nothing — not that the UI hides
   it.
2. The same user cannot fetch that deck's **PDF or assets from Storage**, by
   direct object path or by signed URL.
3. An **unauthenticated** request to every endpoint is refused.
4. The **anon key**, which is public by definition, cannot read a single row of
   `decks`, `deck_versions` or `deck_assets`.
5. The **secret key does not appear** in the deployed bundle, in any response body,
   or in the repo. Grep the built output, not the source.
6. The **MCP** cannot act outside the identity it was given.
7. `verify` still FAILs the artifact it is supposed to: the Holliday-cleared image
   in the public carousel (`2026-07-23_no-hardware-no-rip-and-replace`) is a live
   regression test for the entitlement gate.

## Execution

Write these as a runnable script committed to the repo, not a one-off session. The
rules will change again; these tests are what stop that being a leak.
