// Deck Studio over MCP (2026-08-07).
//
// WHY THIS EXISTS. Claude Code already has everything here: it runs beside the
// repo, the agent and the Python tools, so an MCP adds nothing on this laptop.
// The value is elsewhere -- Claude on desktop, on the web, on a phone -- driving
// the sales workflow with no checkout: a customer asks for something, and the
// deck is composed, verified, published and recorded as sent from wherever you
// happen to be.
//
// WHAT IT IS NOT. Not "the API exposed as tools". The tools are named after the
// job (start a customer's deck, record that it was sent) rather than after
// endpoints, because a model driving one shaped tool correctly beats it
// orchestrating six thin ones and getting clearance or version handling subtly
// wrong on the fifth.
//
// THE BOUNDARY IS THE TOOL LIST. There is deliberately no tool for editing a
// master, archiving a library slide or touching the design system. That is
// mother work: it changes every deck built afterwards, and it needs an owner in
// the app. The absence is the enforcement -- plus lib/guard.mjs underneath, so
// the rule holds even if a tool is added carelessly later.
//
// PROTOCOL. Spec revision 2025-11-25 and its two predecessors, over Streamable
// HTTP, STATELESS: no Mcp-Session-Id is ever minted, because a session id issued
// by one serverless instance means nothing to the next one that answers. That is
// also exactly what the 2026-07-28 revision mandates, so this is pre-migrated
// rather than merely getting away with it.

import * as db from "./supabase.mjs";
import { requireLeaf } from "./guard.mjs";
import { clearanceForCustomer, patternForCustomer } from "./namescope.mjs";
import { collidingDecks } from "./collide.mjs";

export const SUPPORTED_VERSIONS = ["2025-03-26", "2025-06-18", "2025-11-25"];
const LATEST = "2025-11-25";

// --- helpers -----------------------------------------------------------------

const text = (s) => ({ content: [{ type: "text", text: s }], isError: false });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD")
  .replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);

// Titles are stored HTML-encoded ("Wavin R&amp;D", "Oppr &middot; ..."), because
// they are written into a document. The browser decodes them for display; a tool
// result is read by a model that would otherwise repeat the entities back into a
// customer-facing sentence, so they are decoded here too.
// This table is almost entirely non-ASCII, and an editor that rewrites the file
// in the wrong encoding turns every value into mojibake that still parses, still
// runs, and therefore ships. After touching it, check it by CODEPOINT rather
// than by eye -- a terminal that cannot print the character prints a question
// mark for both the correct byte and the corrupted one.
// `nbsp`/`thinsp` map to a plain space on purpose, so the whitespace collapse
// downstream can see them. `euro` earns its place the hard way: every price in
// the commercial slides is written `&euro;`, so without it a tool asked what a
// deck says answers "&euro;10.000" 58 times over.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", thinsp: " ",
  middot: "·", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  euro: "€", pound: "£", deg: "°", times: "×",
  minus: "−", ge: "≥", le: "≤", rarr: "→",
  eacute: "é", uuml: "ü", ouml: "ö", auml: "ä" };
const decode = (s) => String(s || "")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => (Object.hasOwn(ENT, n) ? ENT[n] : m));

// --- the tools ---------------------------------------------------------------
//
// `inputSchema` must be a JSON Schema object and must never be null. A
// no-argument tool still declares `{type:"object"}`.

export const TOOLS = [
  {
    name: "customers_list",
    title: "List customers",
    description: "Every registered customer, with the clearance slug a deck must hold to name them and how many decks they have.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "customer_create",
    title: "Register a customer",
    description:
      "Register a new customer so decks can be filed under them and cleared to name them. " +
      "Refuses a name that would retroactively break published decks (for example a company " +
      "called 'Data'), reporting which decks it would break.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name as it is written on a slide, e.g. 'Rhyze'" },
        notes: { type: "string", description: "Optional free notes" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "customer_timeline",
    title: "Customer timeline",
    description:
      "What has been sent to a customer and when, newest first, including which version they " +
      "hold and whether the deck has changed since.",
    inputSchema: {
      type: "object",
      properties: { customer: { type: "string", description: "Customer slug" } },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  {
    name: "decks_for_customer",
    title: "Decks for a customer",
    description: "Every deck filed under a customer, with its type, current version and page count.",
    inputSchema: {
      type: "object",
      properties: { customer: { type: "string", description: "Customer slug" } },
      required: ["customer"],
      additionalProperties: false,
    },
  },
  {
    name: "company_decks_list",
    title: "List company decks",
    description:
      "The reusable company decks (masters), one per type: teaser, engagement, customer, " +
      "investor, product-showcase, management-outlook. These are what a customer deck is copied from.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "deck_read",
    title: "Read a deck",
    description:
      "A deck's details and the visible text of its current version, slide by slide. Use this " +
      "to see what a deck actually says before copying or sending it.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Deck slug" },
        version: { type: "integer", description: "Version number; defaults to current" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "deck_record_sent",
    title: "Record that a deck was sent",
    description:
      "Record that a deck went to a customer, pinned to the exact version they received, so " +
      "'what are they holding' and 'has it changed since' stay answerable.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Deck slug" },
        recipient: { type: "string", description: "Who it went to, e.g. 'Jan de Vries, CFO'" },
        note: { type: "string", description: "Optional context" },
        version: { type: "integer", description: "Version sent; defaults to current" },
        sent_at: { type: "string", description: "ISO date; defaults to now" },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "library_search",
    title: "Search the slide library",
    description:
      "Find library slides by title, chapter, goal or id, so a deck can be described in terms " +
      "of the slides that exist rather than invented ones.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for; omit to list everything" },
        chapter: { type: "string", description: "Restrict to one chapter" },
      },
      additionalProperties: false,
    },
  },
];

// --- tool implementations ----------------------------------------------------

async function customersList() {
  const [rows, decks] = await Promise.all([
    db.select("customers", { select: "id,slug,name,notes", order: "name.asc" }),
    db.select("decks", { select: "customer_id,archived" }),
  ]);
  const counts = new Map();
  for (const d of decks) {
    if (d.archived || !d.customer_id) continue;
    counts.set(d.customer_id, (counts.get(d.customer_id) || 0) + 1);
  }
  if (!rows.length) return text("No customers registered yet.");
  const lines = rows.map((c) =>
    `- ${decode(c.name)}  (slug: ${c.slug}, clearance: ${clearanceForCustomer(c) || c.slug}, ` +
    `${counts.get(c.id) || 0} deck${(counts.get(c.id) || 0) === 1 ? "" : "s"})`);
  return text(`${rows.length} customers:\n${lines.join("\n")}`);
}

async function customerCreate({ name, notes }, member) {
  const clean = String(name || "").trim();
  if (!clean) return fail("A name is required.");
  const slug = slugify(clean).slice(0, 60);
  if (!slug) return fail(`"${clean}" does not reduce to a usable slug.`);

  const existing = await db.select("customers", { slug: `eq.${slug}`, select: "*" });
  if (existing.length) {
    return text(`"${decode(existing[0].name)}" is already registered (slug: ${slug}).`);
  }

  // The same collision check the browser route runs, from the same module --
  // this was a copied body once, and the two had already drifted.
  const scope = clearanceForCustomer({ slug, name: clean });
  const hits = await collidingDecks(patternForCustomer({ slug, name: clean }), scope);
  if (hits.length) {
    const names = hits.slice(0, 8).map((h) => h.slug).join(", ");
    return fail(
      `Refusing to register "${clean}". Its name would become a gated term, and ` +
      `${hits.length} published deck${hits.length === 1 ? "" : "s"} already use those ` +
      `words without clearance for it: ${names}${hits.length > 8 ? ", ..." : ""}. ` +
      `Registering it would fail decks that are correct today. Use the fuller ` +
      `company name, or ask an owner to force it in the app.`);
  }

  const row = await db.insert("customers", { slug, name: clean, notes: String(notes || "") });
  return text(`Registered "${clean}" (slug: ${slug}, clearance: ${scope || slug}). ` +
              `Decks can now be filed under them and cleared to name them.`);
}

async function deckBySlug(slug) {
  const rows = await db.select("decks", { slug: `eq.${slug}`, select: "*" });
  return rows[0] || null;
}

async function decksForCustomer({ customer }) {
  const cs = await db.select("customers", { slug: `eq.${customer}`, select: "id,slug,name" });
  if (!cs.length) return fail(`No customer with slug "${customer}". Use customers_list to see them.`);
  const decks = await db.select("decks", {
    select: "slug,title,type,kind,current_version_n,archived,is_master",
    customer_id: `eq.${cs[0].id}`, order: "updated_at.desc",
  });
  const live = decks.filter((d) => !d.archived);
  if (!live.length) return text(`${decode(cs[0].name)} has no decks yet.`);
  const lines = live.map((d) => `- ${decode(d.title)}  (slug: ${d.slug}, type: ${d.type || "-"}, v${d.current_version_n})`);
  return text(`${live.length} deck${live.length === 1 ? "" : "s"} for ${decode(cs[0].name)}:\n${lines.join("\n")}`);
}

async function companyDecksList() {
  const rows = await db.select("decks", {
    select: "slug,title,type,current_version_n,archived,is_master",
    is_master: "is.true", order: "type.asc",
  });
  const live = rows.filter((d) => !d.archived);
  if (!live.length) return text("No company decks (masters) yet.");
  return text(`${live.length} company decks:\n` + live.map((d) =>
    `- ${d.type || "(no type)"}: ${decode(d.title)}  (slug: ${d.slug}, v${d.current_version_n})`).join("\n"));
}

// Visible text, slide by slide. Reuses the shape verify.mjs reads rather than a
// second parser: a per-slide split on <section>, tags stripped.
function slideTexts(html) {
  const out = [];
  for (const m of String(html).matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)) {
    const raw = m[1]
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]*>/g, " ");
    // Decode AFTER the tags are gone, never before: decoding first would turn an
    // escaped "&lt;section&gt;" into markup this function then treats as real.
    // Slide bodies need this for the same reason titles do -- they are the sales
    // copy that gets quoted back, and "Product Showcase &middot; July" is not a
    // sentence anyone should paste in front of a customer.
    const body = decode(raw).replace(/\s+/g, " ").trim();
    if (body) out.push(body);
  }
  return out;
}

// How much of a deck a single read may return.
//
// MEASURED 2026-08-11, after this tool failed at its own job. The cap here was
// 600 characters PER SLIDE, applied silently: reading `product-showcase` cut 14
// of its 20 slides mid-sentence, and nothing in the output said so, so the
// caller read "and never the reaso" as if that were the slide. A tool whose
// whole purpose is "see what a deck actually says" must not quietly say
// something else.
//
// The budget is generous because the data is small: the largest published
// version in this backend is 16k characters of visible text, roughly 4k tokens.
// So the normal case is the whole deck, and the caps exist only so one runaway
// artifact cannot swallow a context window. Whatever is dropped is NAMED.
const MAX_TOTAL_CHARS = 60_000;
const MAX_SLIDE_CHARS = 6_000;

function renderPages(pages) {
  const total = pages.reduce((n, p) => n + p.length, 0);
  const out = [];
  let spent = 0;
  for (let i = 0; i < pages.length; i++) {
    let body = pages[i];
    let mark = "";
    if (body.length > MAX_SLIDE_CHARS) {
      mark = `  [... slide ${i + 1} cut at ${MAX_SLIDE_CHARS} of ${body.length} characters]`;
      body = body.slice(0, MAX_SLIDE_CHARS);
    }
    if (spent + body.length > MAX_TOTAL_CHARS) {
      out.push(`\n[... slides ${i + 1}-${pages.length} omitted: this version holds ${total} ` +
               `characters of text, over the ${MAX_TOTAL_CHARS}-character budget for one read]`);
      break;
    }
    spent += body.length;
    out.push(`\n[${String(i + 1).padStart(2, "0")}] ${body}${mark}`);
  }
  return out.join("");
}

async function deckRead({ slug, version }) {
  const deck = await deckBySlug(slug);
  if (!deck) return fail(`No deck with slug "${slug}".`);
  const n = Number(version) || deck.current_version_n;
  const vs = await db.select("deck_versions", {
    deck_id: `eq.${deck.id}`, n: `eq.${n}`, select: "n,html,page_count,change_note,created_at,verify_report",
  });
  if (!vs.length) return fail(`Deck "${slug}" has no version ${n}.`);
  const v = vs[0];
  const pages = slideTexts(v.html);
  const head =
    `${decode(deck.title)}\n` +
    `slug: ${deck.slug} · type: ${deck.type || "-"} · ${deck.is_master ? "COMPANY DECK (master)" : "customer deck"}\n` +
    `version ${v.n} of ${deck.current_version_n} · ${v.page_count || pages.length} pages · ` +
    `cleared for: ${(deck.allowed_entitlements || ["public"]).join(", ")}\n` +
    (v.change_note ? `note: ${v.change_note}\n` : "");
  return text(head + renderPages(pages));
}

async function deckRecordSent({ slug, recipient, note, version, sent_at }, member) {
  const deck = await deckBySlug(slug);
  if (!deck) return fail(`No deck with slug "${slug}".`);
  const n = Number(version) || deck.current_version_n;
  if (!n) return fail(`Deck "${slug}" has no published version to send.`);
  // A version that does not exist would render as "v99" on the timeline and
  // compute stale=false, so the deck would read as up to date against nothing.
  if (!Number.isInteger(n) || n < 1 || n > deck.current_version_n) {
    return fail(`Deck "${slug}" has no version ${version}. It is at v${deck.current_version_n}.`);
  }
  await db.insert("deck_sends", {
    deck_id: deck.id,
    version_n: n,
    sent_at: sent_at ? new Date(sent_at).toISOString() : new Date().toISOString(),
    sent_by: member?.id || null,
    sent_by_email: member?.email || "",
    recipient: String(recipient || ""),
    note: String(note || ""),
  });
  const stale = n < deck.current_version_n
    ? ` Note: they hold v${n} but the deck is now at v${deck.current_version_n}.` : "";
  return text(`Recorded: "${decode(deck.title)}" v${n} sent${recipient ? ` to ${recipient}` : ""}.${stale}`);
}

async function customerTimeline({ customer }) {
  const cs = await db.select("customers", { slug: `eq.${customer}`, select: "id,slug,name" });
  if (!cs.length) return fail(`No customer with slug "${customer}".`);
  const decks = await db.select("decks", {
    select: "id,slug,title,type,current_version_n", customer_id: `eq.${cs[0].id}`,
  });
  if (!decks.length) return text(`${decode(cs[0].name)} has no decks yet, so nothing has been sent.`);
  const byId = new Map(decks.map((d) => [d.id, d]));
  const sends = await db.select("deck_sends", {
    deck_id: `in.(${decks.map((d) => d.id).join(",")})`, order: "sent_at.desc",
  });
  if (!sends.length) return text(`Nothing recorded as sent to ${decode(cs[0].name)} yet.`);
  const lines = sends.map((s) => {
    const d = byId.get(s.deck_id);
    const stale = d && s.version_n < d.current_version_n ? `  (now at v${d.current_version_n})` : "";
    return `- ${String(s.sent_at).slice(0, 10)}  ${decode(d?.title) || "?"}  v${s.version_n}` +
           `${s.recipient ? ` -> ${s.recipient}` : ""}${stale}`;
  });
  return text(`Sent to ${decode(cs[0].name)}:\n${lines.join("\n")}`);
}

async function librarySearch({ query, chapter }) {
  const rows = await db.select("library_slides", {
    select: "slide_id,title,chapter,role,goal,entitlements,archived,retired", order: "chapter.asc",
  });
  const q = String(query || "").toLowerCase().trim();
  const live = rows.filter((s) => !s.archived && !s.retired)
    .filter((s) => !chapter || String(s.chapter || "").toLowerCase() === String(chapter).toLowerCase())
    .filter((s) => !q || [s.slide_id, s.title, s.chapter, s.goal].join(" ").toLowerCase().includes(q));
  if (!live.length) return text("No slides match.");
  // Same rule as deck_read: a cap may exist, but it may not be silent. "27
  // slides:" followed by 27 lines and "60 slides:" followed by 60 lines look
  // identical to a caller who cannot count what it never saw.
  const shown = live.slice(0, 60);
  const cut = live.length - shown.length
    ? `\n[... ${live.length - shown.length} more match; narrow with query or chapter]` : "";
  return text(`${live.length} slides:\n` + shown.map((s) =>
    `- ${s.slide_id}  [${s.chapter || "-"}]  ${decode(s.title) || ""}${s.goal ? ` - ${s.goal}` : ""}`).join("\n") + cut);
}

/**
 * Tools that CHANGE something. Everything else is a read.
 *
 * The browser's write gate lives in server.mjs behind `req.method !== "GET"`,
 * which says nothing useful here: every MCP call is a POST, reads included. So
 * the distinction has to be named, and it is named here rather than inferred,
 * because "it looked like a read" is how a viewer ends up registering customers.
 * A tool added to IMPL without being classified is treated as a write by
 * `isWriteTool`, so the failure mode of forgetting is refusal, not exposure.
 */
export const WRITE_TOOLS = new Set(["customer_create", "deck_record_sent"]);
const READ_TOOLS = new Set([
  "customers_list", "customer_timeline", "decks_for_customer",
  "company_decks_list", "deck_read", "library_search",
]);
export const isWriteTool = (name) => !READ_TOOLS.has(name);

const IMPL = {
  customers_list: customersList,
  customer_create: customerCreate,
  customer_timeline: customerTimeline,
  decks_for_customer: decksForCustomer,
  company_decks_list: companyDecksList,
  deck_read: deckRead,
  deck_record_sent: deckRecordSent,
  library_search: librarySearch,
};

/** Run one tool. Business failures come back as isError results the model can
 *  read and correct; only auth failures are HTTP-level, and those never reach
 *  here. */
export async function callTool(name, args, member) {
  const fn = IMPL[name];
  if (!fn) return { unknown: true };
  try {
    return await fn(args || {}, member);
  } catch (e) {
    // A tool result is handed to a model and often quoted into a chat the user
    // keeps. supabase.mjs throws with the raw PostgREST body attached, which
    // names tables, columns, constraints and hints -- shipping the shape of the
    // database into a transcript to explain a failure the reader cannot act on
    // anyway. The detail goes to the server log; the caller gets a sentence.
    const detail = String(e?.message || e);
    process.stderr.write(`[mcp] ${name} failed: ${detail}\n`);
    return fail(`${name} could not be completed: ${safeReason(detail)}`);
  }
}

// Known failure classes, in words a person can act on. Anything unrecognised is
// reported as a failure without repeating the backend's text.
function safeReason(detail) {
  if (/\b(400|409)\b/.test(detail) && /duplicate|unique/i.test(detail)) {
    return "something with that name already exists";
  }
  if (/value too long|too long for type/i.test(detail)) return "one of the values was too long";
  if (/\b(401|403)\b/.test(detail)) return "the backend refused that request";
  if (/\b5\d\d\b/.test(detail) || /fetch failed|ECONN|ETIMEDOUT/i.test(detail)) {
    return "the backend is unavailable — try again in a moment";
  }
  return "the backend rejected it. The details are in the server log";
}

/** Negotiate the protocol version: echo the client's when we support it, else
 *  answer with our newest and let the client decide whether it can continue. */
export const negotiate = (asked) => (SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST);

export const serverInfo = { name: "oppr-deck-studio", title: "Oppr Deck Studio", version: "1.0.0" };

export const INSTRUCTIONS =
  "Deck Studio holds Oppr's sales decks. A customer's decks are copies of company " +
  "decks (masters), personalised and published as immutable versions. Typical flow: " +
  "customers_list to find the customer, decks_for_customer to see what they already have, " +
  "deck_read to see what a deck says, and deck_record_sent once it has gone out. " +
  "Editing a company deck or the slide library is deliberately not possible here: that " +
  "changes every future deck and is done by an owner in the app.";
