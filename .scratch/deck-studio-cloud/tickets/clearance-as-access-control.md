# Clearance as access control

Type: grilling · Status: open · Blocked by: Identity and roles, Lock the database down

## Question

`allowed_entitlements` says what content may go *into* an artifact. With several
users, what says who may *open* it?

## Why it matters

This is the ticket where the existing safety property either extends correctly or
quietly stops meaning anything.

Today clearance is checked at build time by `verify-deck.py` and at image-swap
time by the app. Both ask "may this content be in this deck". Neither asks "may
this person see this deck", because there has only ever been one person.

A Holliday-cleared deck is currently readable only by whoever holds the secret
key, which is Floris's machine — so there is no exposure today. The gap opens the
moment colleagues get accounts: the first policy that lets an authenticated user
read `decks` will, unless it says otherwise, let *every* colleague read *every*
customer's deck. That is the leak to design against, and it does not exist until
the grant is written.

## What a good answer settles

- Whether every colleague may see every customer's material (plausible for a small
  team, and much simpler) or whether clearance is per person.
- If per person: where that lives — a `user_clearances` table mapping user to
  entitlement slug — and how an RLS policy on `decks` and on Storage uses it.
- What happens to an artifact with **no** customer material: public and social
  artifacts should be visible to every colleague.
- The failure direction. Deny by default: a user with no clearance row sees only
  `public` artifacts, never everything.
- Whether the **PDF in Storage** is covered by the same rule. A deck's PDF is the
  deck; protecting the row and leaving the object readable protects nothing.
