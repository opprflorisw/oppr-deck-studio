// Recording that a deck went out.
//
// A send is an EVENT, not a property, and it is pinned to (deck_id, version_n)
// because versions are immutable and the deck keeps moving. "Sent on the 7th"
// cannot answer what the customer is holding; comparing the sent version to
// current_version_n gives "they have v1, we are on v3" for free.
//
// That comparison is the reason this file exists. It was written three times —
// the browser timeline, the MCP timeline, and again inside the MCP send
// confirmation — so "are they behind" had three chances to mean three things.

import * as db from "../supabase.mjs";

// A recipient and a note are free text typed by a person in a hurry. The browser
// truncated them and the MCP did not, so a long note over MCP hit the column
// constraint and surfaced as a raw PostgREST error.
const RECIPIENT_MAX = 200;
const NOTE_MAX = 500;

/**
 * Record a send.
 *
 * `version` defaults to the deck's current version, and is bounds-checked:
 * without it, {"version_n": 99} is stored happily and then renders as v99 with
 * `stale = 99 < 3 = false`, so a deck reads as current against a version that
 * never existed.
 */
export async function record(deckId, { version = null, recipient = "", note = "", sentAt = null }, member) {
  const decks = await db.select("decks", {
    id: `eq.${deckId}`, select: "id,slug,title,current_version_n",
  });
  if (!decks.length) return { ok: false, error: "no_such_deck" };
  const deck = decks[0];

  let n = deck.current_version_n;
  if (version !== null && version !== undefined && version !== "") {
    n = Number(version);
    if (!Number.isInteger(n) || n < 1 || n > deck.current_version_n) {
      return {
        ok: false, error: "no_such_version",
        message: `"${deck.slug}" has versions 1 to ${deck.current_version_n}; ` +
                 `there is no v${version}.`,
      };
    }
  }
  if (!n) return { ok: false, error: "not_published", message: "This deck has no version yet." };

  const row = {
    deck_id: deckId, version_n: n,
    recipient: String(recipient || "").slice(0, RECIPIENT_MAX),
    note: String(note || "").slice(0, NOTE_MAX),
    sent_by: member?.id || null,
    sent_by_email: member?.email || "",
  };
  if (sentAt) {
    const t = new Date(sentAt);
    if (!Number.isNaN(t.getTime())) row.sent_at = t.toISOString();
  }
  await db.insert("deck_sends", row);

  return {
    ok: true,
    deck: { id: deck.id, slug: deck.slug, title: deck.title },
    version_n: n,
    current_version_n: deck.current_version_n,
    // The one place this is decided.
    stale: n < deck.current_version_n,
  };
}

/** Every send of one deck, newest first. */
export async function forDeck(deckId) {
  const decks = await db.select("decks", { id: `eq.${deckId}`, select: "current_version_n" });
  const current = decks[0]?.current_version_n ?? 0;
  const rows = await db.select("deck_sends", {
    deck_id: `eq.${deckId}`,
    select: "id,version_n,sent_at,sent_by_email,recipient,note",
    order: "sent_at.desc",
  });
  return rows.map((s) => ({ ...s, current_version_n: current, stale: s.version_n < current }));
}
