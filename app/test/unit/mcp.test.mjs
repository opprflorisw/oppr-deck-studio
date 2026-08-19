// The MCP door: protocol shape, the read/write split, and what a failure says.
import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS, isWriteTool, negotiate, SUPPORTED_VERSIONS, INSTRUCTIONS,
         callTool } from "../../lib/mcp.mjs";

test("every declared tool has a schema a client can call it with", () => {
  assert.ok(TOOLS.length > 0);
  for (const t of TOOLS) {
    assert.ok(t.name, "a tool needs a name");
    assert.equal(typeof t.description, "string");
    assert.ok(t.description.length > 10, `${t.name} needs a real description`);
    assert.equal(t.inputSchema?.type, "object", `${t.name} inputSchema`);
  }
});

test("tool names are unique", () => {
  const seen = new Set();
  for (const t of TOOLS) {
    assert.ok(!seen.has(t.name), `duplicate tool ${t.name}`);
    seen.add(t.name);
  }
});

test("the write split is default-deny", () => {
  // isWriteTool is `!READ_TOOLS.has(name)`, so a tool added and forgotten is
  // treated as a write and refused to viewers. That is the safe direction and
  // this test exists so nobody "fixes" it into an allow-list of writes.
  assert.equal(isWriteTool("a_tool_that_does_not_exist"), true);
  assert.equal(isWriteTool("customers_list"), false);
  assert.equal(isWriteTool("deck_record_sent"), true);
  assert.equal(isWriteTool("customer_create"), true);
});

test("protocol negotiation echoes a supported version and falls back otherwise", () => {
  for (const v of SUPPORTED_VERSIONS) assert.equal(negotiate(v), v);
  assert.ok(SUPPORTED_VERSIONS.includes(negotiate("1999-01-01")));
});

test("the instructions state the boundary rather than implying it", () => {
  assert.match(INSTRUCTIONS, /library|master/i);
});

test("a backend failure does not leak the database into the transcript", async (t) => {
  // supabase.mjs throws with the raw PostgREST body attached. That text names
  // tables, columns and constraints, and a tool result is often quoted into a
  // chat the user keeps.
  const errs = [];
  const realWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { errs.push(String(s)); return true; };
  t.after(() => { process.stderr.write = realWrite; });

  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 400,
    text: async () => '{"code":"23505","details":"Key (slug)=(x) already exists.",' +
                      '"message":"duplicate key value violates unique constraint \\"customers_slug_key\\""}',
  });
  t.after(() => { globalThis.fetch = realFetch; });

  const r = await callTool("customers_list", {}, { id: "u", email: "e@oppr.ai", role: "editor" });
  const text = JSON.stringify(r);
  assert.ok(r.isError, "the caller is told it failed");
  for (const leak of ["customers_slug_key", "23505", "rest/v1", "Key (slug)"]) {
    assert.ok(!text.includes(leak), `leaked ${leak} into the tool result`);
  }
  // …and the detail is still recoverable by whoever runs the server.
  assert.ok(errs.join("").includes("customers_slug_key"), "detail must reach the server log");
});

test("an unknown tool is reported as unknown, not as a failure", async () => {
  const r = await callTool("no_such_tool", {}, { id: "u", role: "editor" });
  assert.equal(r.unknown, true);
});
