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
import { isOwner } from "./auth.mjs";
// The SAME bodies the browser routes call. Until 2026-08-19 these tools carried
// their own copies, and the header above claimed they "share the browser's
// handlers" while no such layer existed -- so the two doors had already drifted
// on the slug they derived, whether a note was truncated, how many colliding
// decks a refusal listed, and whether an owner was offered the force.
import * as customers from "./handlers/customers.mjs";
import * as sends from "./handlers/sends.mjs";
import * as drafts from "./handlers/drafts.mjs";
import * as build from "./mcpbuild.mjs";
// The tool set as DATA: name, schema, access, audit action and annotations in
// one table, so the dispatcher, the guard, the audit trail and the Settings
// page all derive from it instead of four hand-maintained copies. The Settings
// page was one of those copies, and already promised a page count no tool
// returned.
import { TOOL_SPECS, toolList, specFor, ACCESS } from "./mcptools.mjs";

export const SUPPORTED_VERSIONS = ["2025-03-26", "2025-06-18", "2025-11-25"];
const LATEST = "2025-11-25";

// --- helpers -----------------------------------------------------------------

const text = (s) => ({ content: [{ type: "text", text: s }], isError: false });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

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

export const TOOLS = toolList();

// --- tool implementations ----------------------------------------------------

async function customersList() {
  const rows = await customers.list();
  if (!rows.length) return text("No customers registered yet.");
  const lines = rows.map((c) =>
    `- ${c.name}  (slug: ${c.slug}, clearance: ${c.clearance}, ` +
    `${c.deck_count} deck${c.deck_count === 1 ? "" : "s"})`);
  return text(`${rows.length} customers:\n${lines.join("\n")}`);
}

async function customerCreate({ name, notes }, member) {
  const r = await customers.create({
    name, notes,
    // An owner over MCP gets the same escape hatch they have in the app. It
    // used to be browser-only, so an owner on a phone was told to "ask an
    // owner" -- which they were.
    force: false,
    canForce: isOwner(member),
  });

  if (r.ok && !r.created) {
    return text(`"${r.customer.name}" is already registered ` +
                `(slug: ${r.customer.slug}, clearance: ${r.customer.clearance}). Nothing changed.`);
  }
  if (r.ok) {
    return text(`Registered "${r.customer.name}" (slug: ${r.customer.slug}, ` +
                `clearance: ${r.customer.clearance}). Decks can now be filed under them ` +
                `and cleared to name them.`);
  }
  if (r.error === "name_would_break_decks") {
    const names = r.decks.map((d) => d.slug).join(", ");
    return fail(
      `Refusing to register "${String(name).trim()}". ${r.message} ` +
      `Affected: ${names}${r.count > r.decks.length ? `, and ${r.count - r.decks.length} more` : ""}. ` +
      (r.can_force
        ? `You are an owner, so you can force this from the app if it really is the company's name.`
        : `Use the fuller company name, or ask an owner to force it in the app.`));
  }
  return fail(r.message || "That name could not be used.");
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
  if (!deck) return fail(`No deck with slug "${slug}". Use decks_for_customer to see them.`);
  const r = await sends.record(deck.id, { version, recipient, note, sentAt: sent_at }, member);
  if (!r.ok) return fail(r.message || `Could not record that against "${slug}".`);
  const stale = r.stale
    ? ` Note: they hold v${r.version_n} but the deck is now at v${r.current_version_n}.` : "";
  return text(`Recorded: "${decode(deck.title)}" v${r.version_n} sent` +
              `${recipient ? ` to ${recipient}` : ""}.${stale}`);
}

async function customerTimeline({ customer }) {
  const t = await customers.timeline(customer);
  if (!t) return fail(`No customer with slug "${customer}". Use customers_list to see them.`);
  if (!t.sends.length) return text(`Nothing recorded as sent to ${t.customer.name} yet.`);
  const lines = t.sends.map((s) =>
    `- ${String(s.sent_at).slice(0, 10)}  ${s.deck_title || "?"}  v${s.version_n}` +
    `${s.recipient ? ` -> ${s.recipient}` : ""}` +
    `${s.stale ? `  (now at v${s.current_version_n})` : ""}`);
  return text(`Sent to ${t.customer.name}:\n${lines.join("\n")}`);
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
export { isWriteTool } from "./mcptools.mjs";

// --- the tools added for the build loop --------------------------------------

async function customerNote({ customer, note }) {
  const r = await customers.appendNote(customer, note);
  if (!r) return fail(`No customer with slug "${customer}". Use customers_list to see them.`);
  if (!r.ok) return fail("A note needs some text.");
  return text(`Noted against ${customer}.`);
}

async function decksSearch({ query, kind }) {
  const q = String(query || "").toLowerCase().trim();
  const rows = await db.selectAll("decks", {
    select: "slug,title,type,kind,note,archived,is_master,current_version_n,customer_id",
    order: "updated_at.desc",
  });
  const custs = new Map((await db.selectAll("customers", { select: "id,name" }))
    .map((c) => [c.id, decode(c.name)]));
  const live = rows.filter((d) => !d.archived && (!kind || d.kind === kind));
  const hit = q
    ? live.filter((d) => [d.slug, decode(d.title), d.type, d.note, custs.get(d.customer_id) || ""]
        .join(" ").toLowerCase().includes(q))
    : live;
  if (!hit.length) return text(q ? `Nothing matches "${query}".` : "No artifacts yet.");
  const shown = hit.slice(0, 40);
  const lines = shown.map((d) =>
    `- ${decode(d.title)}  (slug: ${d.slug}, ${d.kind}${d.type ? `/${d.type}` : ""}, ` +
    `v${d.current_version_n}${d.is_master ? ", company deck" : ""}` +
    `${custs.get(d.customer_id) ? `, ${custs.get(d.customer_id)}` : ""})`);
  const more = hit.length > shown.length ? `\n[... ${hit.length - shown.length} more match]` : "";
  return text(`${hit.length} match:\n${lines.join("\n")}${more}`);
}

async function deckStatus({ slug }) {
  const deck = await deckBySlug(slug);
  if (!deck) return fail(`No deck with slug "${slug}". Use decks_search to find it.`);
  const [v] = await db.select("deck_versions", {
    deck_id: `eq.${deck.id}`, n: `eq.${deck.current_version_n}`,
    select: "n,page_count,pdf_object,verify_report,created_at",
  });
  if (!v) return fail(`"${slug}" has no published version.`);

  const fails = v.verify_report?.fails || [];
  const warns = v.verify_report?.warns || [];
  const lines = [
    `${decode(deck.title)}  (v${v.n}, ${v.page_count} pages)`,
    `  brand gate: ${fails.length ? `${fails.length} FAILURE(S) — this is not safe to send` : "passes"}`,
  ];
  for (const f of fails) lines.push(`      ${f}`);
  if (warns.length) lines.push(`  warnings: ${warns.length}`);
  lines.push(`  PDF: ${v.pdf_object ? "printed" : "not printed yet (deck_pdf will print it)"}`);

  // Has the library moved on under it?
  const recipeRows = await db.select("deck_versions", {
    deck_id: `eq.${deck.id}`, n: `eq.${deck.current_version_n}`, select: "recipe",
  });
  const recipe = recipeRows[0]?.recipe;
  if (recipe?.chapters) {
    const lib = new Map((await db.selectAll("library_slides", { select: "slide_id,content_hash" }))
      .map((r) => [r.slide_id, r.content_hash]));
    const behind = [];
    for (const ch of recipe.chapters) {
      for (const sl of ch.slides || []) {
        const now = lib.get(sl.slide_id);
        if (now === undefined) behind.push(`${sl.slide_id} (no longer in the library)`);
        else if (now !== sl.content_hash) behind.push(`${sl.slide_id} (changed since)`);
      }
    }
    lines.push(behind.length
      ? `  library: ${behind.length} page(s) behind — ${behind.join(", ")}`
      : `  library: up to date`);
  } else {
    lines.push(`  library: published before recipes, so drift cannot be answered`);
  }

  const sent = await sends.forDeck(deck.id);
  if (sent.length) {
    lines.push(`  sent ${sent.length} time(s); latest: v${sent[0].version_n}` +
               `${sent[0].recipient ? ` to ${sent[0].recipient}` : ""}` +
               `${sent[0].stale ? " — they are behind" : ""}`);
  } else {
    lines.push(`  not recorded as sent to anyone`);
  }
  return text(lines.join("\n"));
}

async function libraryChapters() {
  const chs = await drafts.chapters();
  const lines = [];
  for (const ch of chs) {
    const pick = ch.slides.filter((s) => s.pickable);
    lines.push(`${ch.n} ${ch.title}  [${ch.id}]  — ${ch.purpose || ""}`);
    for (const s of pick) {
      lines.push(`     ${s.slide_id.padEnd(24)} ${s.goal || s.title}` +
                 `${s.entitlements?.length ? `  (needs ${s.entitlements.join(", ")})` : ""}`);
    }
    if (!pick.length) lines.push(`     (nothing pickable)`);
  }
  return text(`The library, in reading order. Pick from each chapter; skipping a chapter ` +
              `drops every slide under it.\n\n${lines.join("\n")}`);
}

async function slideRead({ slide_id }) {
  const [row] = await db.select("library_slides", {
    slide_id: `eq.${slide_id}`,
    select: "slide_id,title,chapter,role,goal,entitlements,retired,archived",
  });
  if (!row) return fail(`No slide "${slide_id}". Use library_search or library_chapters.`);
  const files = await import("./repofiles.mjs");
  const rf = new files.RepoFiles();
  let body = "";
  try {
    const html = await rf.text(`library/slides/${slide_id}/slide.html`);
    body = String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]*>/g, " ");
    body = decode(body).replace(/\s+/g, " ").trim().slice(0, 4000);
  } catch { body = "(the slide's text is not readable from here)"; }

  return text(
    `${slide_id}  [${row.chapter || "no chapter"}]\n` +
    `  ${decode(row.title || "")}\n` +
    `  for: ${row.goal || "-"}\n` +
    `  role: ${row.role || "-"}` +
    `${row.entitlements?.length ? `\n  needs clearance: ${row.entitlements.join(", ")}` : ""}` +
    `${row.retired ? "\n  RETIRED — cannot be picked" : ""}` +
    `${row.archived ? "\n  ARCHIVED — cannot be picked" : ""}\n\n${body}`);
}

const IMPL = {
  // reads
  whoami: build.whoami,
  customers_list: customersList,
  customer_timeline: customerTimeline,
  decks_for_customer: decksForCustomer,
  company_decks_list: companyDecksList,
  decks_search: decksSearch,
  deck_read: deckRead,
  deck_status: deckStatus,
  library_search: librarySearch,
  library_chapters: libraryChapters,
  slide_read: slideRead,
  // writes, all leaf
  customer_create: customerCreate,
  customer_note: customerNote,
  deck_start: build.deckStart,
  deck_open: build.deckOpen,
  deck_slides: build.deckSlides,
  deck_vars: build.deckVars,
  deck_check: build.deckCheck,
  deck_publish: build.deckPublish,
  deck_pdf: build.deckPdf,
  deck_record_sent: deckRecordSent,
};

// Every tool a client can see must have a body, and every body must be declared.
// Checked at load rather than at call time, so a mismatch is a startup failure
// instead of a 500 the first time somebody uses the tool that was forgotten.
for (const spec of TOOL_SPECS) {
  if (!IMPL[spec.name]) throw new Error(`mcp: tool "${spec.name}" is declared with no implementation`);
}
for (const name of Object.keys(IMPL)) {
  if (!specFor(name)) throw new Error(`mcp: "${name}" is implemented but not declared in mcptools.mjs`);
}

/**
 * Which deck a call is aimed at, if any.
 *
 * This is what lets the dispatcher run requireLeaf without each tool
 * remembering to. mcp.mjs has imported requireLeaf since August and never called
 * it, while its own header, CLAUDE.md and app/README.md all described a second
 * layer of defence underneath the tool list. There was no second layer. There is
 * one now, and it is here rather than in twenty tool bodies, because a guarantee
 * that depends on every future author remembering is not a guarantee.
 */
async function deckIdFor(args) {
  if (args?.slug) {
    const rows = await db.select("decks", { slug: `eq.${args.slug}`, select: "id" });
    return rows[0]?.id || null;
  }
  if (args?.draft) {
    const rows = await db.select("deck_drafts", { id: `eq.${args.draft}`, select: "deck_id" });
    return rows[0]?.deck_id || null;
  }
  return null;
}

/** Run one tool. Business failures come back as isError results the model can
 *  read and correct; only auth failures are HTTP-level, and those never reach
 *  here. */
export async function callTool(name, args, member) {
  const fn = IMPL[name];
  if (!fn) return { unknown: true };
  const spec = specFor(name);
  try {
    // THE SECOND LAYER, finally wired.
    //
    // The tool list is the boundary: there is no tool that edits a master or the
    // library, and that absence is the enforcement. Underneath it, guard.mjs was
    // supposed to catch a write aimed at a master anyway -- this module has
    // imported requireLeaf since August, CLAUDE.md and app/README.md both
    // described the layer, and no tool ever called it.
    //
    // It is called HERE rather than in twenty tool bodies, because a guarantee
    // that depends on every future author remembering is not a guarantee. Any
    // write naming a deck (by slug, or through a draft bound to one) is checked
    // against that deck's row: leaf work passes, a master is refused to anyone
    // but an owner, and a database error fails closed.
    if (spec && spec.access !== ACCESS.READ) {
      const deckId = await deckIdFor(args);
      if (deckId) {
        const bar = await requireLeaf(deckId, member, `change`, null);
        if (bar) return fail(bar.message || "That is a company deck; only an owner can change it.");
      }
    }
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
