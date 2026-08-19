// Which published decks would a new customer name break? (2026-08-07)
//
// Registering a customer creates a GATED TERM: namescope derives `\b<name>\b`,
// and from then on any deck containing those words fails verify unless cleared
// for that customer. Right for "Rhyze", a disaster for "Data" -- which would
// retroactively fail 16 of 20 published decks that were correct when they were
// built and that nobody has touched since.
//
// This lives in its own module because BOTH front doors ask the question -- the
// browser at POST /api/customers2 and the MCP `customer_create` tool -- and the
// first version of this shipped as two copies that had already drifted (one
// returned slugs, the other rows; one capped at 8, the other at 12). Two copies
// of the rule that decides whether a name is safe is precisely the shape of the
// bug this repo keeps relearning.

import * as db from "./supabase.mjs";
import { selectAll } from "./supabase.mjs";
import { wouldNewlyFail } from "./verify.mjs";

// Paging lives in supabase.mjs now: a silent short read is the worst possible
// failure for a guard -- it reports "clean" because it never saw the deck it
// would have broken -- and every other list in the app had the same exposure.

/**
 * Published decks that would START failing under `pattern`/`scope`.
 * @returns [{ id, slug, title }] — empty means the name is safe to register.
 *
 * Only CURRENT versions of live decks are considered: an older version is
 * history nobody will rebuild, and an archived deck is out of the index.
 *
 * `archived` is filtered in JS rather than with PostgREST's `is.false`, which
 * matches only a literal false and silently drops rows where the column is
 * NULL. A deck with a NULL `archived` would then be invisible to the guard and
 * would start failing verify right after the name was accepted.
 */
export async function collidingDecks(pattern, scope) {
  if (!pattern) return [];

  const decks = (await selectAll("decks", {
    select: "id,slug,title,current_version_n,archived",
  })).filter((d) => !d.archived && d.current_version_n);
  if (!decks.length) return [];

  const wantN = new Map(decks.map((d) => [d.id, d.current_version_n]));

  // Two passes on purpose: `html` is the expensive column (a snapshot inlines
  // its stylesheet), so the (deck, n) bookkeeping happens on cheap rows and only
  // the documents actually needed are pulled with their body.
  const stubs = await selectAll("deck_versions", { select: "id,deck_id,n" });
  const wanted = stubs.filter((v) => wantN.get(v.deck_id) === v.n).map((v) => v.id);
  if (!wanted.length) return [];

  const byId = new Map(decks.map((d) => [d.id, d]));
  const hits = [];
  // Chunked so the `in.(...)` filter cannot outgrow a practical URL length.
  for (let i = 0; i < wanted.length; i += 40) {
    const docs = await db.select("deck_versions", {
      select: "deck_id,html", id: `in.(${wanted.slice(i, i + 40).join(",")})`,
    });
    for (const v of docs) {
      if (!wouldNewlyFail(v.html, pattern, scope)) continue;
      const d = byId.get(v.deck_id);
      if (d) hits.push({ id: d.id, slug: d.slug, title: d.title });
    }
  }
  return hits;
}
