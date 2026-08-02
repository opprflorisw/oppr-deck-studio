# The MCP server

Type: prototype · Status: open · Blocked by: Where the secret key goes

## Question

What does Claude get to do with Deck Studio from surfaces that are not this repo,
and how does that connection authenticate?

## Framing, so this does not get overbuilt

Claude Code **already has full access here**: it runs beside the repo, the local
agent and the Python tools. An MCP adds nothing on this machine. Its value is
elsewhere — Claude on desktop, on the web, or on a phone driving Deck Studio
without a checkout.

So this ticket is not "expose the API as tools". It is "what is worth doing from a
surface with no repo".

## What a good answer settles

- **The tool surface.** Likely: list artifacts, read a version's HTML, propose an
  edit, save a version, print and verify, read the verify report, get a PDF.
  Almost certainly not: creating a new artifact — that is CLI work and the Deck
  Studio 2.0 boundary holds.
- **Where it runs.** A Vercel route serving MCP over HTTP alongside the app is the
  obvious answer once the app is there; a Supabase Edge Function is the other
  candidate Floris raised. The deciding factor is where auth already lives after
  *Where the secret key goes*.
- **Auth is the crux.** A remote MCP acting for a user must carry that user's
  identity, or every RLS policy this map writes is bypassed by the MCP. A
  service-role MCP is a public bypass of the entire access model.
- Whether the same server can also front a **local stdio MCP** for CLI ergonomics
  — typed tools instead of shelling out to Python and curl. That is the cheap half
  of the value and needs none of the hosting.
