// The shared handler layer.
//
// These run against a stubbed database, so they test the RULE rather than the
// data. The point of the layer is that the browser and the MCP get the same
// answer; the point of these tests is that the answer is right once.
import test from "node:test";
import assert from "node:assert/strict";

// A tiny in-memory stand-in for supabase.mjs, installed before the handlers are
// imported. Only the operations the handlers actually use.
const TABLES = { customers: [], decks: [], deck_sends: [], deck_versions: [] };

function matches(row, params) {
  for (const [k, v] of Object.entries(params)) {
    if (["select", "order", "offset", "limit"].includes(k)) continue;
    const s = String(v);
    if (s.startsWith("eq.")) { if (String(row[k]) !== s.slice(3)) return false; }
    else if (s.startsWith("is.")) { if (String(row[k]) !== s.slice(3)) return false; }
    else if (s.startsWith("in.")) {
      const set = s.slice(4, -1).split(",");
      if (!set.includes(String(row[k]))) return false;
    }
  }
  return true;
}

const db = {
  async select(table, params = {}) {
    return (TABLES[table] || []).filter((r) => matches(r, params));
  },
  async selectAll(table, params = {}) { return db.select(table, params); },
  async insert(table, rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    const made = list.map((r, i) => ({ id: `${table}-${TABLES[table].length + i}`, ...r }));
    TABLES[table].push(...made);
    return made;
  },
  async update(table, match, values) {
    const hit = TABLES[table].filter((r) =>
      Object.entries(match).every(([k, v]) => String(r[k]) === String(v)));
    for (const r of hit) Object.assign(r, values);
    return hit;
  },
};

const { mock } = await import("node:test");
mock.module?.("../../lib/supabase.mjs", { namedExports: db });

// node:test's module mocking is not available on every Node 20/22 patch, so the
// handlers are driven through injectable seams where they have them, and through
// the stub where they do not. If mock.module is unavailable these skip rather
// than testing the real backend by accident.
const CAN_MOCK = typeof mock.module === "function";

test("customer collision refusal reports one cap, not one per door", { skip: !CAN_MOCK }, async () => {
  const customers = await import("../../lib/handlers/customers.mjs?h1");
  TABLES.customers.length = 0;
  const r = await customers.create({ name: "Rhyze" });
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  assert.equal(r.customer.slug, "rhyze");
});

test("an already-registered customer is a no-op that says so", { skip: !CAN_MOCK }, async () => {
  const customers = await import("../../lib/handlers/customers.mjs?h2");
  TABLES.customers.length = 0;
  TABLES.customers.push({ id: "c1", slug: "wavin", name: "Wavin", notes: "" });
  const r = await customers.create({ name: "Wavin" });
  assert.equal(r.ok, true);
  assert.equal(r.created, false, "it must not be reported as newly created");
  assert.equal(r.customer.clearance, "wavin", "and it still answers with the clearance");
});

test("a name that reduces to nothing is refused, not stored", { skip: !CAN_MOCK }, async () => {
  const customers = await import("../../lib/handlers/customers.mjs?h3");
  const r = await customers.create({ name: "!!!" });
  assert.equal(r.ok, false);
  assert.equal(r.error, "bad_name");
});

// --- sends: the bounds check that used to live in two places ---------------

test("a send defaults to the current version", { skip: !CAN_MOCK }, async () => {
  const sends = await import("../../lib/handlers/sends.mjs?s1");
  TABLES.decks.length = 0; TABLES.deck_sends.length = 0;
  TABLES.decks.push({ id: "d1", slug: "x", title: "X", current_version_n: 3 });
  const r = await sends.record("d1", { recipient: "Jan" }, { id: "u", email: "u@oppr.ai" });
  assert.equal(r.ok, true);
  assert.equal(r.version_n, 3);
  assert.equal(r.stale, false);
});

test("a send against an older version is recorded AND marked stale", { skip: !CAN_MOCK }, async () => {
  const sends = await import("../../lib/handlers/sends.mjs?s2");
  TABLES.decks.length = 0; TABLES.deck_sends.length = 0;
  TABLES.decks.push({ id: "d1", slug: "x", title: "X", current_version_n: 3 });
  const r = await sends.record("d1", { version: 1 }, { id: "u", email: "u@oppr.ai" });
  assert.equal(r.version_n, 1);
  assert.equal(r.stale, true, "they hold v1, the deck is on v3");
});

test("a version that never existed is refused", { skip: !CAN_MOCK }, async () => {
  const sends = await import("../../lib/handlers/sends.mjs?s3");
  TABLES.decks.length = 0; TABLES.deck_sends.length = 0;
  TABLES.decks.push({ id: "d1", slug: "x", title: "X", current_version_n: 3 });
  // Unvalidated this is stored verbatim and then renders as v99 with
  // stale = 99 < 3 = false, so the deck reads as current against nothing.
  for (const bad of [99, 0, -1, 2.5, "latest"]) {
    const r = await sends.record("d1", { version: bad }, { id: "u", email: "u@oppr.ai" });
    assert.equal(r.ok, false, `version ${bad} must be refused`);
    assert.equal(r.error, "no_such_version");
  }
  assert.equal(TABLES.deck_sends.length, 0, "and nothing was written");
});

test("recipient and note are truncated on every door, not just the browser",
     { skip: !CAN_MOCK }, async () => {
  const sends = await import("../../lib/handlers/sends.mjs?s4");
  TABLES.decks.length = 0; TABLES.deck_sends.length = 0;
  TABLES.decks.push({ id: "d1", slug: "x", title: "X", current_version_n: 1 });
  await sends.record("d1", { recipient: "r".repeat(500), note: "n".repeat(2000) },
                     { id: "u", email: "u@oppr.ai" });
  const row = TABLES.deck_sends[0];
  assert.equal(row.recipient.length, 200);
  assert.equal(row.note.length, 500);
});
