// Publishing, against the real backend.
//
// These exercise the two RPCs that make a publish atomic. They create and then
// remove their own decks, and every deck they touch is prefixed `zz-test-` so a
// failed run is obvious and sweepable.
//
//   npm run test:integration     (needs SUPABASE_URL + SUPABASE_SECRET_KEY)
import test from "node:test";
import assert from "node:assert/strict";
import * as db from "../../lib/supabase.mjs";
import { supabaseConfigured } from "../../lib/env.mjs";

const SKIP = !supabaseConfigured();
const doc = (s) => `<!DOCTYPE html><html><head></head><body><section>${s}</section></body></html>`;

async function sweep() {
  for (const d of await db.select("decks", { slug: "like.zz-test-*", select: "id" })) {
    await db.del("decks", { id: d.id });
  }
}

test("publish_version allocates, writes and moves the pointer as one act", { skip: SKIP }, async (t) => {
  t.after(sweep);
  await sweep();

  const [made] = await db.rpc("create_deck_with_v1", {
    p_slug: "zz-test-atomic", p_title: "Atomic", p_type: "teaser",
    p_html: doc("v1"), p_fields: { allowed_entitlements: ["public"] },
    p_change_note: "first", p_author: "test",
  });
  assert.equal(made.slug, "zz-test-atomic");
  assert.equal(made.n, 1);

  const n2 = await db.rpc("publish_version", {
    p_deck_id: made.deck_id, p_html: doc("v2"), p_change_note: "second", p_author: "test",
  });
  assert.equal(n2, 2);

  const [deck] = await db.select("decks", { id: `eq.${made.deck_id}`, select: "current_version_n" });
  assert.equal(deck.current_version_n, 2, "the pointer follows the version it names");

  // The invariant the RPC exists to hold.
  const vs = await db.select("deck_versions", { deck_id: `eq.${made.deck_id}`, select: "n" });
  assert.ok(vs.some((v) => v.n === deck.current_version_n),
            "current_version_n must name a version that exists");
});

test("a second deck asking for a taken slug gets the next one, not an error",
     { skip: SKIP }, async (t) => {
  t.after(sweep);
  await sweep();

  const a = (await db.rpc("create_deck_with_v1", {
    p_slug: "zz-test-slug", p_title: "A", p_type: "teaser", p_html: doc("a"),
    p_fields: {}, p_author: "test",
  }))[0];
  const b = (await db.rpc("create_deck_with_v1", {
    p_slug: "zz-test-slug", p_title: "B", p_type: "teaser", p_html: doc("b"),
    p_fields: {}, p_author: "test",
  }))[0];

  assert.equal(a.slug, "zz-test-slug");
  assert.equal(b.slug, "zz-test-slug-2", "allocated inside the transaction, not guessed before it");
  assert.notEqual(a.deck_id, b.deck_id);
});

test("concurrent publishes of one deck produce consecutive versions, never a collision",
     { skip: SKIP }, async (t) => {
  t.after(sweep);
  await sweep();

  const [made] = await db.rpc("create_deck_with_v1", {
    p_slug: "zz-test-race", p_title: "Race", p_type: "teaser", p_html: doc("v1"),
    p_fields: {}, p_author: "test",
  });

  // Five at once. Read-then-write would have several of these compute the same
  // n and lose all but one to the unique index.
  const ns = await Promise.all(Array.from({ length: 5 }, (_, i) =>
    db.rpc("publish_version", {
      p_deck_id: made.deck_id, p_html: doc(`concurrent ${i}`),
      p_change_note: `c${i}`, p_author: "test",
    })));

  assert.deepEqual([...ns].sort((x, y) => x - y), [2, 3, 4, 5, 6],
                   "every call got its own number");
  const [deck] = await db.select("decks", { id: `eq.${made.deck_id}`, select: "current_version_n" });
  assert.equal(deck.current_version_n, 6);
});

test("the page_count trigger counts the document, so nobody has to pass it",
     { skip: SKIP }, async (t) => {
  t.after(sweep);
  await sweep();

  const [made] = await db.rpc("create_deck_with_v1", {
    p_slug: "zz-test-pages", p_title: "Pages", p_type: "teaser",
    p_html: `<html><body><section>1</section><section>2</section><section>3</section></body></html>`,
    p_fields: {}, p_author: "test",
  });
  const [v] = await db.select("deck_versions",
    { deck_id: `eq.${made.deck_id}`, n: "eq.1", select: "page_count" });
  assert.equal(v.page_count, 3);
});

test("no published deck points at a version that does not exist", { skip: SKIP }, async () => {
  // The whole corpus, not a fixture: this is the invariant the non-atomic
  // publish could break, so it is worth asserting against reality.
  const decks = await db.select("decks", { select: "id,slug,current_version_n" });
  const versions = await db.select("deck_versions", { select: "deck_id,n" });
  const have = new Set(versions.map((v) => `${v.deck_id}:${v.n}`));
  const orphans = decks
    .filter((d) => d.current_version_n > 0 && !have.has(`${d.id}:${d.current_version_n}`))
    .map((d) => `${d.slug} points at v${d.current_version_n}`);
  assert.deepEqual(orphans, []);
});

test("update() refuses an already-prefixed match value", async () => {
  // Not integration -- no network is reached, the guard throws first. Kept here
  // because it is about the same class of silent write failure.
  await assert.rejects(
    () => db.update("decks", { id: "eq.abc" }, { note: "x" }),
    /match values are raw/);
});
