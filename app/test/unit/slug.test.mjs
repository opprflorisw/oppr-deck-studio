// One slug per name, whichever door you came through.
//
// There were five implementations of this. Four agreed; the MCP one did not —
// it normalised to NFKD and never trimmed leading or trailing hyphens. So a
// company registered from Claude on a phone and the same company registered in
// the browser got different slugs, and a slug is an identity. This table is the
// contract, and tools/deckstudio.py is held to the same one.
import test from "node:test";
import assert from "node:assert/strict";
import { slugify, isSlug, safeSlug, SLUG_RE } from "../../lib/slug.mjs";

// [input, expected] — every row is a case one of the old copies got wrong, or a
// real customer name already in the backend.
const CASES = [
  ["Wavin", "wavin"],
  ["  Wavin  ", "wavin"],
  ["HoSt Bioenergy", "host-bioenergy"],
  ["Derek's Factory", "dereks-factory"],
  ["Attero B.V.", "attero-bv"],
  ["Rhyze", "rhyze"],
  // the ones the copies disagreed on
  ["Café", "cafe"],                 // NFKD keeps the letter; the other copy dropped it
  ["Ölmühle", "olmuhle"],
  ["Rhyze -", "rhyze"],             // trailing separator trimmed
  ["- Rhyze", "rhyze"],
  ["a--b", "a-b"],                  // runs collapse
  ["a_b", "a-b"],
  ["ACME/Corp", "acmecorp"],
  ["2026 Q1", "2026-q1"],
  ["", ""],
];

for (const [input, want] of CASES) {
  test(`slugify(${JSON.stringify(input)}) is ${JSON.stringify(want)}`, () => {
    assert.equal(slugify(input), want);
  });
}

test("slugify is idempotent", () => {
  for (const [input] of CASES) {
    const once = slugify(input);
    assert.equal(slugify(once), once, `${JSON.stringify(input)} changed on a second pass`);
  }
});

test("slugify never returns something SLUG_RE would refuse", () => {
  for (const [input] of CASES) {
    const out = slugify(input);
    if (out) assert.ok(SLUG_RE.test(out), `${JSON.stringify(out)} from ${JSON.stringify(input)}`);
  }
});

test("isSlug accepts stored slugs and refuses the shapes that break a query", () => {
  for (const ok of ["wavin", "host-bioenergy", "2026-08-19_teaser", "a1"]) {
    assert.equal(isSlug(ok), true, ok);
  }
  for (const bad of ["", "-lead", "Upper", "has space", "sla/sh", "eq.wavin",
                     "a".repeat(101), null, undefined, 7]) {
    assert.equal(isSlug(bad), false, JSON.stringify(bad));
  }
});

test("safeSlug truncates without leaving a trailing hyphen", () => {
  assert.equal(safeSlug("a very long company name indeed", 12), "a-very-long");
  assert.equal(safeSlug("!!!"), "", "nothing usable is empty, not a broken slug");
});
