// The mother/leaf boundary, in one place (2026-08-07).
//
// LEAF work affects one customer's artifact: create the customer, copy a master
// into their deck, edit its text, publish a version, record that it was sent.
// Any editor may do it, from the app or over MCP, because it is the daily job.
//
// MOTHER work affects every deck built from here on: editing a MASTER, archiving
// a library slide, reassigning `is_master`, rebuilding the index or the research
// brain. That needs an owner.
//
// It lives in its own module because there are now two front doors -- the browser
// and the MCP server -- and a rule implemented twice is a rule that will one day
// disagree with itself. Same function, both callers. The `allow_authenticated`
// policy found this same morning is what a second copy of an access rule looks
// like when it drifts: the intent was written down in three places and the
// database did something else entirely.

import * as db from "./supabase.mjs";
import { isOwner } from "./auth.mjs";

// Fields that are structural ON A MASTER. Title, pdf_core and type rewrite the
// filename contract (`oppr_<type>.pdf`); archived shelves the thing every
// customer deck is copied from. Note, star and post_text are findability
// metadata -- a caption is not a version -- and stay open to editors everywhere.
export const MASTER_STRUCTURAL_FIELDS = new Set([
  "title", "pdf_core", "type", "archived", "archive_note",
]);

/**
 * Refuse a write to a master by anyone but an owner.
 * @returns an error body to send, or null when the write may proceed.
 *
 * Routes that take a deck id cannot be classified by path alone: publishing a
 * version is ordinary leaf work on a customer deck and a system change on a
 * master. Only the row knows, so the check happens once the row is known.
 *
 * `fields` narrows it to a PATCH's structural keys.
 */
export async function requireLeaf(deckId, member, what, fields = null) {
  if (isOwner(member)) return null;
  let rows;
  try {
    rows = await db.select("decks", { id: `eq.${deckId}`, select: "id,is_master,title,type" });
  } catch {
    return null;            // let the route's own lookup produce the real error
  }
  const deck = rows[0];
  if (!deck || !deck.is_master) return null;

  let action = what;
  if (fields) {
    const structural = Object.keys(fields).filter((k) => MASTER_STRUCTURAL_FIELDS.has(k));
    if (!structural.length) return null;
    action = `${what} (${structural.join(", ")})`;
  }
  return {
    error: "owner_only",
    message: `"${deck.title}" is the ${deck.type || "company"} master. Only an owner can ${action} it, ` +
             `because every deck made from it afterwards inherits the change. ` +
             `Use "Save as a new deck" to make your own version instead.`,
  };
}

// Paths where the path ALONE decides it is mother work, so no row lookup is
// needed. Kept beside requireLeaf so both halves of the boundary are read
// together rather than found separately.
export const MOTHER_ROUTES = [
  [/^\/api\/decks\/[^/]+\/master$/, "reassign which deck is the master for a type"],
  [/^\/api\/library\/slides\/[^/]+\/archive$/, "archive a library slide"],
  [/^\/api\/refresh$/, "rebuild the library index"],
  [/^\/api\/research\/rebuild$/, "rebuild the research brain"],
  [/^\/api\/research\/sync$/, "sync research to Storage"],
  [/^\/api\/import-graphics$/, "import graphics into the image library"],
];

export function motherRouteFor(p) {
  const hit = MOTHER_ROUTES.find(([rx]) => rx.test(p));
  return hit ? hit[1] : "";
}
