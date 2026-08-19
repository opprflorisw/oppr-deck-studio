// The brand gate. One fixture per page_format, and for every universal rule a
// clean case and a poisoned one — because a gate is only worth what it refuses.
import test from "node:test";
import assert from "node:assert/strict";
import { verifySnapshot, PAGE_FORMATS, wouldNewlyFail } from "../../lib/verify.mjs";

const CUSTOMERS = [{ slug: "wavin", name: "Wavin" }, { slug: "rhyze", name: "Rhyze" }];

function meta(over = {}) {
  return {
    schema: 1, title: "T", type: "teaser", client: "",
    page_format: "deck-16x9",
    allowed_entitlements: ["public"],
    slides: [{ id: "cover", role: "cover", hash: "a" },
             { id: "body", role: "idea", hash: "b" }],
    assets: { "hero.jpg": { source: "brand/img/hero.jpg", entitlement: "public" } },
    published: "2026-08-19", tool: "test",
    ...over,
  };
}

// Two sections: a cover (no footer) and a content slide (footer with data-total).
function doc(m, body = null) {
  const total = (m.slides || []).length;
  const dflt = `
<section class="slide cover" data-slide-id="cover" data-role="cover">
  <h1>Operator intelligence</h1>
  <img src="assets/hero.jpg" alt="plant floor">
</section>
<section class="slide" data-slide-id="body" data-role="idea">
  <h2>One improvement, multiplied</h2>
  <p>Payback in about 0,5 years at € 25.000.</p>
  <footer class="slide-foot"><span class="wm">oppr</span><span>Teaser</span><span class="pageno" data-total="${total}"></span></footer>
</section>`;
  return `<!DOCTYPE html><html><head>
<style>/* brand — em dash lives here */</style>
<script type="application/json" id="deck-meta">${JSON.stringify(m)}</script>
</head><body>${body === null ? dflt : body}</body></html>`;
}

test("a clean deck passes with no fails", async () => {
  const r = await verifySnapshot({ html: doc(meta()), customers: CUSTOMERS });
  assert.deepEqual(r.fails, [], r.fails.join(" | "));
});

test("no unconditional warning is emitted", async () => {
  // A warning present on EVERY report is a warning nobody reads, which is the
  // cost the hand-tuned name-scope patterns exist to avoid paying.
  // "blank-page-skipped" used to fire on every single report; it is gone.
  // The PDF-skipped warn that remains is conditional and true: this call passed
  // no PDF, and a real build does.
  const r = await verifySnapshot({ html: doc(meta()), customers: CUSTOMERS });
  assert.ok(!r.entries.some((e) => e.code === "blank-page-skipped"),
            "blank-page-skipped must not be emitted");
  assert.deepEqual(r.warns.filter((w) => !/no PDF in snapshot/.test(w)), []);
});

test("em dash in visible prose FAILs", async () => {
  const html = doc(meta()).replace("multiplied", "multiplied — really");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "em-dash" && e.level === "fail"));
});

test("unfilled placeholder FAILs", async () => {
  const html = doc(meta()).replace("Teaser</span>", "{{deck_footer}}</span>");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "unfilled"));
});

test("a customer name the deck is not cleared for FAILs", async () => {
  const html = doc(meta()).replace("One improvement", "What Wavin found");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "name-leak"), JSON.stringify(r.entries));
});

test("the same name passes once the deck is cleared for it", async () => {
  const html = doc(meta({ allowed_entitlements: ["public", "wavin"] }))
    .replace("One improvement", "What Wavin found");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.equal(r.fails.length, 0, r.fails.join(" | "));
});

test("an image beyond the deck's clearance FAILs", async () => {
  const m = meta({ assets: { "hero.jpg": { source: "brand/img/h.jpg", entitlement: "wavin" } } });
  const r = await verifySnapshot({ html: doc(m), customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "image-entitlement"));
});

test("an image missing from the bundle FAILs", async () => {
  const html = doc(meta()).replace("assets/hero.jpg", "assets/ghost.jpg");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "image-missing"));
});

test("footer discipline is enforced by role", async () => {
  // a cover carrying a footer is as wrong as a content slide missing one
  const html = doc(meta()).replace(
    '<img src="assets/hero.jpg" alt="plant floor">',
    '<img src="assets/hero.jpg" alt="plant floor"><footer class="slide-foot">x</footer>');
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "footer"));
});

test("data-total must agree with the slide count", async () => {
  const html = doc(meta()).replace('data-total="2"', 'data-total="9"');
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "data-total"));
});

test("section count must agree with the slide count", async () => {
  const m = meta({ slides: [{ id: "cover", role: "cover", hash: "a" }] });
  const r = await verifySnapshot({ html: doc(m), customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "section-count"));
});

test("Anglo number formatting WARNs but does not fail", async () => {
  const html = doc(meta()).replace("€ 25.000", "€ 25,000");
  const r = await verifySnapshot({ html, customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "euro-format" && e.level === "warn"));
  assert.deepEqual(r.fails, []);
});

// --- page_format: the rules that vary -------------------------------------

test("a carousel is NOT held to deck structural rules", async () => {
  // 4:5 pages carry no footer and no data-total; checking them as a deck is the
  // bug that made every JS-built artifact a 16:9 deck until 2026-08-19.
  const m = meta({
    page_format: "linkedin-4x5", type: "carousel",
    slides: [{ id: "p1", role: "", hash: "a" }],
    assets: {},
  });
  const body = '<section class="lpage" data-slide-id="p1" data-role=""><h2>Hook</h2></section>';
  const r = await verifySnapshot({ html: doc(m, body), customers: CUSTOMERS });
  assert.ok(!r.entries.some((e) => e.code === "footer"), "no footer rule for a carousel");
  assert.ok(!r.entries.some((e) => e.code === "data-total"), "no data-total rule for a carousel");
});

test("a missing page_format WARNs rather than silently deciding", async () => {
  const m = meta(); delete m.page_format;
  const r = await verifySnapshot({ html: doc(m), customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "no-page-format" && e.level === "warn"));
});

test("an unknown page_format FAILs", async () => {
  const r = await verifySnapshot({ html: doc(meta({ page_format: "a4-portrait" })), customers: CUSTOMERS });
  assert.ok(r.entries.some((e) => e.code === "bad-page-format"));
});

test("every declared format has a rule set", () => {
  for (const [name, f] of Object.entries(PAGE_FORMATS)) {
    assert.equal(typeof f.structural, "boolean", `${name}.structural`);
    assert.equal(typeof f.paged, "boolean", `${name}.paged`);
  }
  // An article is a column of prose, not a canvas: it legitimately prints
  // across several sheets, so asserting one section == one page FAILed all nine.
  assert.equal(PAGE_FORMATS.none.paged, false);
  assert.equal(PAGE_FORMATS["deck-16x9"].paged, true);
});

// --- the customer-name collision guard ------------------------------------

test("wouldNewlyFail sees a name only when the deck is not cleared for it", () => {
  const html = doc(meta()).replace("One improvement", "What Acme found");
  assert.equal(wouldNewlyFail(html, "\\bacme\\b", "acme"), true);
  const cleared = doc(meta({ allowed_entitlements: ["public", "acme"] }))
    .replace("One improvement", "What Acme found");
  assert.equal(wouldNewlyFail(cleared, "\\bacme\\b", "acme"), false);
});
