// Publishing a snapshot, in JavaScript (Deck Studio cloud).
//
// `tools/publish-deck.py` is the CLI's publish and stays the reference. This is
// the same set of writes for the recipe path, so a deck composed in the hosted
// builder lands exactly as one composed on this laptop: the same rows, the same
// asset objects, the same lineage, the same recipe.
//
// Two rules this enforces rather than assumes:
//   - A NEW deck always publishes as v1, and refuses a slug that already exists.
//     Adding to an existing deck is versionOf, which is a different call.
//   - Assets dedup by content sha across versions of the same deck, so a deck
//     that keeps the same hero image does not store it once per version.
//
// Nothing here decides whether the deck is allowed to be published. Verify does,
// before this is ever called.

import * as db from "./supabase.mjs";
import { slugify } from "./assemble.mjs";

/** Upload the bundled assets this deck does not already have. */
async function uploadAssets(deckId, assets, existingBySha = {}) {
  const rows = [];
  for (const [fn, a] of Object.entries(assets)) {
    if (a.sha256 in existingBySha) continue;
    const obj = `decks/${deckId}/assets/${fn}`;
    await db.upload(obj, a.bytes, a.content_type);
    rows.push({
      deck_id: deckId, filename: fn, storage_object: obj,
      entitlement: a.entitlement, sha256: a.sha256,
    });
  }
  if (rows.length) await db.upsert("deck_assets", rows, "deck_id,filename");
  return rows.length;
}

async function uploadPdf(deckId, n, pdfBytes, pdfName) {
  if (!pdfBytes) return null;
  const obj = `decks/${deckId}/pdf/v${n}_${pdfName}`;
  await db.upload(obj, pdfBytes, "application/pdf");
  return obj;
}

/**
 * Add a version to an existing deck (publish-deck.py --version-of).
 *
 * Slug, client and clearance belong to the deck, not the version, so nothing
 * here can widen what the deck is allowed to carry.
 */
export async function publishVersion({ versionOf, html, assets, recipe, pdfBytes = null,
                                       pdfName = "", note = "", author = "app",
                                       verifyReport = null, pageCount = 0 }) {
  const rows = await db.select("decks", { slug: `eq.${versionOf}`, select: "id,current_version_n" });
  if (!rows.length) throw new Error(`no deck with slug '${versionOf}' to add a version to`);
  const deckId = rows[0].id;
  const n = rows[0].current_version_n + 1;

  const seen = {};
  for (const a of await db.select("deck_assets", { deck_id: `eq.${deckId}`, select: "filename,sha256" })) {
    seen[a.sha256] = a.filename;
  }
  await uploadAssets(deckId, assets, seen);
  const pdfObject = await uploadPdf(deckId, n, pdfBytes, pdfName);

  await db.insert("deck_versions", {
    deck_id: deckId, n, html, change_note: note || "republished", author,
    pdf_object: pdfObject, recipe, verify_report: verifyReport, page_count: pageCount,
  });
  await db.update("decks", { id: deckId }, { current_version_n: n, status: "ok", needs_cli_reason: "" });
  return { deck_id: deckId, slug: versionOf, version: n, pdf_object: pdfObject };
}

/**
 * Publish a brand-new deck as v1 (publish-deck.py, no --version-of).
 *
 * The slug is taken, never generated here: the builder chose it when the deck
 * was created and every version inherits it.
 */
export async function publishNewDeck({ slug, deck, html, assets, recipe, pdfBytes = null,
                                       pdfName = "", note = "", author = "app",
                                       type = "", client = "", customer = "",
                                       audienceKind = "", audienceLabel = "",
                                       derivedFrom = "", derivedFromVersion = null,
                                       master = false, verifyReport = null, pageCount = 0 }) {
  if ((await db.select("decks", { slug: `eq.${slug}`, select: "id" })).length) {
    throw new Error(`a deck with slug '${slug}' already exists. Open it and publish a new version instead.`);
  }

  const deckType = type || deck.type || "";
  const clientSlug = client || deck.client || "";

  let customerId = null;
  if (customer) {
    const rows = await db.select("customers", { slug: `eq.${customer}`, select: "id" });
    // The CLI can create a customer from customers/<slug>/ on disk. Hosted there
    // is no such folder, so an unknown customer is left unset rather than
    // invented: filing a deck under a customer that does not exist is worse than
    // filing it under none, and /ingest-dump is what creates one.
    if (rows.length) customerId = rows[0].id;
  }

  let derivedId = null, derivedN = null;
  if (derivedFrom) {
    const src = await db.select("decks", { slug: `eq.${derivedFrom}`, select: "id,current_version_n" });
    if (src.length) {
      derivedId = src[0].id;
      derivedN = derivedFromVersion || src[0].current_version_n;
    }
  }

  // One master per type: the tag moves, it is never held by two decks.
  if (master && deckType) {
    await db.update("decks", { type: deckType, is_master: "true" }, { is_master: false });
  }

  const row = await db.insert("decks", {
    slug, title: deck.title, type: deckType,
    is_master: Boolean(master),
    audience_kind: audienceKind || (customerId ? "customer" : "general"),
    customer_id: customerId,
    audience_label: audienceLabel,
    client_slug: clientSlug ? slugify(clientSlug) : "",
    allowed_entitlements: [...(deck.allowed_entitlements || ["public"])],
    current_version_n: 1,
    derived_from_deck_id: derivedId, derived_from_version_n: derivedN,
    created_by: author,
  });
  const deckId = row[0].id;

  await uploadAssets(deckId, assets);
  const pdfObject = await uploadPdf(deckId, 1, pdfBytes, pdfName);

  await db.insert("deck_versions", {
    deck_id: deckId, n: 1, html, change_note: note || "published from the deck builder",
    author, pdf_object: pdfObject, recipe, verify_report: verifyReport, page_count: pageCount,
  });

  return { deck_id: deckId, slug, version: 1, pdf_object: pdfObject };
}
