// The tool set as a contract.
//
// Declaring tools as data is what lets the dispatcher, the guard, the audit
// trail and the Settings page derive from one table. These tests hold that
// table to the properties the rest of the system assumes about it.
import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_SPECS, toolList, specFor, isWriteTool, ACCESS } from "../../lib/mcptools.mjs";

test("every tool declares a name, a description and a schema", () => {
  for (const t of TOOL_SPECS) {
    assert.ok(t.name, "a tool needs a name");
    assert.ok(/^[a-z][a-z0-9_]*$/.test(t.name), `${t.name} is not a usable tool name`);
    assert.ok(t.description && t.description.length > 20, `${t.name} needs a real description`);
    assert.equal(t.inputSchema?.type, "object", `${t.name} inputSchema`);
    assert.equal(t.inputSchema.additionalProperties, false,
                 `${t.name} must refuse arguments it does not declare`);
  }
});

test("every tool declares an access level, and only the two that exist", () => {
  for (const t of TOOL_SPECS) {
    assert.ok([ACCESS.READ, ACCESS.LEAF].includes(t.access),
              `${t.name} has access "${t.access}"`);
  }
});

test("there is no mother-work tool, and the absence is the boundary", () => {
  // Editing a master, archiving a library slide, reassigning is_master,
  // rebuilding an index: none of these may EVER appear here. They change every
  // deck built afterwards, and they belong to an owner in the app.
  const forbidden = /(master|archive|retire|library_(write|edit|archive)|index|rebuild|promote)/i;
  const offenders = TOOL_SPECS
    .filter((t) => t.access !== ACCESS.READ && forbidden.test(t.name))
    .map((t) => t.name);
  assert.deepEqual(offenders, [],
    "a write tool whose name suggests mother work: if it really is leaf work, " +
    "rename it; if it is not, it does not belong in this file");
});

test("the write split is default-deny by inversion", () => {
  // A tool added and forgotten must be treated as a write and refused to
  // viewers, never handed to them.
  assert.equal(isWriteTool("a_tool_nobody_declared"), true);
  assert.equal(isWriteTool("customers_list"), false);
  assert.equal(isWriteTool("deck_publish"), true);
  assert.equal(isWriteTool("deck_start"), true);
});

test("annotations are derived from access, so they cannot disagree with it", () => {
  for (const t of toolList()) {
    const spec = specFor(t.name);
    assert.equal(t.annotations.readOnlyHint, spec.access === ACCESS.READ, t.name);
    // Nothing here deletes: a version is immutable, a send is an event, a draft
    // is the caller's own.
    assert.equal(t.annotations.destructiveHint, false, t.name);
  }
});

test("the client list carries exactly the declared tools", () => {
  const listed = toolList().map((t) => t.name).sort();
  const declared = TOOL_SPECS.map((t) => t.name).sort();
  assert.deepEqual(listed, declared);
});

test("the loop a colleague needs is complete", () => {
  // The module header has always said the job is "start a customer's deck,
  // record that it was sent". Until 2026-08-19 there was no tool that started a
  // deck, so the stated purpose was half-implemented. This asserts the loop.
  const names = new Set(TOOL_SPECS.map((t) => t.name));
  for (const step of ["customers_list", "customer_create", "deck_start", "deck_slides",
                      "deck_vars", "deck_check", "deck_publish", "deck_pdf",
                      "deck_record_sent", "customer_timeline"]) {
    assert.ok(names.has(step), `the build loop is missing ${step}`);
  }
});

test("publishing requires an explicit confirmation in its schema", () => {
  // The approval gate the removed skills enforced in markdown is now a
  // parameter the server checks.
  const publish = specFor("deck_publish");
  assert.ok(publish.inputSchema.properties.confirm, "deck_publish must take confirm");
  assert.match(publish.description, /confirm/i);
});

test("write tools that change something declare an audit action", () => {
  // Not every write needs one -- deck_slides edits a draft nobody else can see --
  // but anything touching a customer, a deck or a send must be attributable.
  for (const name of ["customer_create", "deck_publish", "deck_record_sent", "deck_pdf"]) {
    assert.ok(specFor(name).audit, `${name} must record an audit action`);
  }
});
