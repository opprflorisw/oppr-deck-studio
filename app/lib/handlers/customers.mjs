// Customers, as data.
//
// One body per question, returning plain objects. server.mjs renders them as
// JSON; mcp.mjs renders them as prose. Neither owns the rule.
//
// This layer exists because the two doors had already drifted in five places at
// once: the slug they derived, whether a send's note was truncated, how many
// colliding decks a refusal listed (8 or 12), whether an owner was offered the
// force, and three separate copies of the "are they behind" arithmetic. Every
// one of those was a body copied rather than called. lib/collide.mjs was carved
// out for exactly this reason after the same thing happened once before; this
// finishes the job.
//
// Nothing here talks to req/res, renders a sentence, or decides who may call it.
// The route and the tool do that.

import * as db from "../supabase.mjs";
import { clearanceForCustomer, patternForCustomer } from "../namescope.mjs";
import { collidingDecks } from "../collide.mjs";
import { safeSlug } from "../slug.mjs";
import { selectAll } from "../supabase.mjs";

const decode = (s) =>
  String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ");

/** Every customer, with its derived clearance and how many live decks it has. */
export async function list() {
  const [rows, decks] = await Promise.all([
    selectAll("customers", { select: "id,slug,name,notes", order: "name.asc" }),
    // Paged: a silent short read here would under-count a customer's decks, and
    // PostgREST truncates at its max-rows without saying so.
    selectAll("decks", { select: "customer_id,archived" }),
  ]);
  const counts = new Map();
  for (const d of decks) {
    if (d.archived || !d.customer_id) continue;
    counts.set(d.customer_id, (counts.get(d.customer_id) || 0) + 1);
  }
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: decode(c.name),
    notes: c.notes || "",
    clearance: clearanceForCustomer(c) || c.slug,
    deck_count: counts.get(c.id) || 0,
  }));
}

export async function bySlug(slug) {
  const rows = await db.select("customers", { slug: `eq.${slug}`, select: "*" });
  return rows[0] || null;
}

/**
 * Register a customer.
 *
 * Registering a customer CREATES A GATED TERM: from then on, verify refuses any
 * deck that names them without clearance. That is right for "Rhyze" and a
 * disaster for an ordinary word — measured, not guessed: "Data" would have
 * broken 16 of 20 published decks, and a customer briefly named "test" failed
 * all nine articles at once because `\btest\b` is ordinary English.
 *
 * So the derived pattern is dry-run against every published version BEFORE the
 * row is written, and the prediction uses the gate's own code (wouldNewlyFail),
 * because a guard that predicts the gate with different code will one day
 * predict wrongly.
 *
 * Returns one of:
 *   {ok:true, created:true, customer}
 *   {ok:true, created:false, customer}          — already registered
 *   {ok:false, error:"bad_name"|"name_would_break_decks", ...}
 */
export async function create({ name, notes = "", force = false, canForce = false }) {
  const clean = String(name || "").trim();
  if (!clean) return { ok: false, error: "bad_name", message: "A name is required." };

  const slug = safeSlug(clean, 60);
  if (!slug) {
    return { ok: false, error: "bad_name",
             message: `"${clean}" does not reduce to a usable slug.` };
  }

  const existing = await bySlug(slug);
  if (existing) {
    return { ok: true, created: false,
             customer: { ...existing, name: decode(existing.name),
                         clearance: clearanceForCustomer(existing) || existing.slug } };
  }

  const scope = clearanceForCustomer({ slug, name: clean });
  const pattern = patternForCustomer({ slug, name: clean });
  if (pattern && !force) {
    const clashes = await collidingDecks(pattern, scope);
    if (clashes.length) {
      return {
        ok: false,
        error: "name_would_break_decks",
        pattern,
        count: clashes.length,
        // One cap, not one per door. The browser listed 12 and the MCP 8.
        decks: clashes.slice(0, 12).map((d) => ({ slug: d.slug, title: decode(d.title) })),
        can_force: canForce,
        message:
          `"${clean}" would become a gated term, and ${clashes.length} published ` +
          `deck${clashes.length === 1 ? "" : "s"} already use those words without ` +
          `clearance for it. Registering it would fail decks that are correct today.`,
      };
    }
  }

  const [row] = await db.insert("customers", { slug, name: clean, notes: String(notes || "") });
  return {
    ok: true, created: true, forced: Boolean(force && pattern),
    customer: { ...row, name: decode(row.name), clearance: scope || slug },
  };
}

/**
 * What a customer is holding: every send, newest first, with whether the deck
 * has moved on since.
 *
 * `stale` is computed HERE, once. It was computed in three places — the browser
 * route, the MCP timeline, and again inside the MCP send confirmation — which is
 * three chances for "they have v1, we are on v3" to mean three things.
 */
export async function timeline(slug) {
  const customer = await bySlug(slug);
  if (!customer) return null;

  const decks = await selectAll("decks", {
    customer_id: `eq.${customer.id}`,
    select: "id,slug,title,current_version_n",
  });
  if (!decks.length) return { customer, sends: [] };

  const byId = new Map(decks.map((d) => [d.id, d]));
  const sends = await selectAll("deck_sends", {
    deck_id: `in.(${decks.map((d) => d.id).join(",")})`,
    select: "deck_id,version_n,sent_at,sent_by_email,recipient,note",
    order: "sent_at.desc",
  });

  return {
    customer: { ...customer, name: decode(customer.name) },
    sends: sends.map((s) => {
      const deck = byId.get(s.deck_id);
      return {
        deck_slug: deck?.slug || "",
        deck_title: decode(deck?.title || ""),
        version_n: s.version_n,
        current_version_n: deck?.current_version_n ?? s.version_n,
        stale: Boolean(deck && s.version_n < deck.current_version_n),
        sent_at: s.sent_at,
        sent_by: s.sent_by_email || "",
        recipient: s.recipient || "",
        note: s.note || "",
      };
    }),
  };
}

/** Append to a customer's notes. Leaf work: what you learned in a meeting. */
export async function appendNote(slug, line) {
  const customer = await bySlug(slug);
  if (!customer) return null;
  const add = String(line || "").trim().slice(0, 1000);
  if (!add) return { ok: false, error: "empty" };
  const stamp = new Date().toISOString().slice(0, 10);
  const notes = `${customer.notes || ""}${customer.notes ? "\n" : ""}${stamp} — ${add}`.slice(0, 20000);
  await db.update("customers", { id: customer.id }, { notes });
  return { ok: true, notes };
}
