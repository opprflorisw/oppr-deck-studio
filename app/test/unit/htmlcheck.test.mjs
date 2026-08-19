// The save gate: what an in-place edit may and may not change.
//
// This is the boundary between "the app changes and ships" and "the CLI
// creates", and it is the one boundary enforced server-side on every save, so
// it gets the matrix treatment: for each rule, one save that must pass and one
// that must not.
import test from "node:test";
import assert from "node:assert/strict";
import { validateSave, fingerprint, externalRef } from "../../lib/htmlcheck.mjs";

const DOC = `<!DOCTYPE html>
<html><head>
<style>/* brand css — an em dash lives here legitimately */</style>
<script type="application/json" id="deck-meta">{"schema":1,"title":"T"}</script>
</head><body>
<section class="slide cover" data-slide-id="cover" data-role="cover">
  <h1>Find what the machines cannot see</h1>
  <p class="meta"><span data-slot="cover-meta">Teaser · August 2026</span></p>
  <img src="assets/hero.jpg" alt="Operator on the plant floor">
  <a href="#next">Next</a>
</section>
</body></html>`;

const ASSETS = new Set(["assets/hero.jpg", "assets/other.jpg"]);
const ok = (next) => validateSave(DOC, next, ASSETS);

test("accepts an edit that only changes text", () => {
  const next = DOC.replace("Find what the machines cannot see", "Find the improvements");
  assert.equal(ok(next).ok, true);
});

test("accepts a style attribute appearing, changing and disappearing", () => {
  const a = DOC.replace("<h1>", '<h1 style="margin-top:12px">');
  assert.equal(ok(a).ok, true, "adding style");
  const b = a.replace("margin-top:12px", "margin-top:24px");
  assert.equal(validateSave(a, b, ASSETS).ok, true, "changing style");
  assert.equal(validateSave(a, DOC, ASSETS).ok, true, "removing style");
});

test("accepts swapping to another asset the deck owns", () => {
  assert.equal(ok(DOC.replace("assets/hero.jpg", "assets/other.jpg")).ok, true);
});

test("accepts reformatting: same tags, different whitespace", () => {
  const next = DOC.replace(/\n/g, "\n  ");
  assert.equal(ok(next).ok, true);
  assert.equal(fingerprint(DOC), fingerprint(next), "fingerprint is whitespace-stable");
});

for (const [what, next, code] of [
  ["an empty document", "   ", "empty"],
  ["an em dash in prose", DOC.replace("cannot see", "cannot see — really"), "em-dash"],
  ["an unfilled placeholder", DOC.replace("Teaser", "{{deck_footer}}"), "unfilled"],
  ["a new element", DOC.replace("</section>", "<p>extra</p></section>"), "structural"],
  ["a removed element", DOC.replace(/<a href="#next">Next<\/a>/, ""), "structural"],
  ["a changed class", DOC.replace('class="slide cover"', 'class="slide closer"'), "structural"],
  ["a changed data-slot", DOC.replace('data-slot="cover-meta"', 'data-slot="client"'), "structural"],
  ["a new attribute", DOC.replace("<h1>", '<h1 onclick="x()">'), "structural"],
  ["a foreign script", DOC.replace("</body>", "<script>alert(1)</script></body>"), "script"],
  ["an unknown asset", DOC.replace("assets/hero.jpg", "assets/nope.jpg"), "unknown-asset"],
  ["a remote image", DOC.replace("assets/hero.jpg", "https://evil.example/px.gif"), "external-src"],
  ["a protocol-relative image", DOC.replace("assets/hero.jpg", "//evil.example/px.gif"), "external-src"],
  ["a swapped link", DOC.replace('href="#next"', 'href="https://phish.example"'), "external-href"],
  ["a remote background in a style attribute",
   DOC.replace("<h1>", '<h1 style="background:url(https://evil.example/x.png)">'), "style-url"],
]) {
  test(`rejects ${what}`, () => {
    const r = ok(next);
    assert.equal(r.ok, false, `expected a refusal for ${what}`);
    assert.equal(r.code, code);
  });
}

test("em dashes inside inert blocks stay legal", () => {
  // The inlined brand CSS carries em dashes in comments and the deck-meta holds
  // the title. Scanning the raw document would refuse every save.
  assert.equal(ok(DOC).ok, true);
  assert.equal(externalRef(DOC), null);
});

test("a data: image is local", () => {
  const next = DOC.replace("assets/hero.jpg", "data:image/gif;base64,R0lGOD");
  // structural fingerprint is unchanged (src presence only), and data: is local
  assert.equal(externalRef(next), null);
});

test("mailto and tel are local", () => {
  assert.equal(externalRef('<a href="mailto:floris@oppr.ai">m</a>'), null);
  assert.equal(externalRef('<a href="tel:+31600000000">t</a>'), null);
});
