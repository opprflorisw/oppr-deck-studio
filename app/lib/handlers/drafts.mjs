// Composing a deck, before it is one.
//
// This is the half of the system that Deck Studio 5 moves out of the CLI. Until
// now, choosing which slides a deck is made of and filling in its variables
// happened either in the app's builder or in a Claude Code skill reading a
// markdown file. A colleague with neither had no way to make a deck at all.
//
// The draft is server-side and belongs to one person (see the deck_drafts
// migration), so the same working deck is visible from the builder and from
// Claude on a phone, and a half-composed deck survives a closed tab.
//
// WHAT THIS DELIBERATELY DOES NOT DO. It never invents a slide, never edits one,
// and never widens a clearance. An editor composes from what the library already
// holds; making a new slide is mother work and has no surface here at all.

import * as db from "../supabase.mjs";
import { safeSlug } from "../slug.mjs";
import { clearanceForCustomer } from "../namescope.mjs";

const decode = (s) =>
  String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&middot;/g, "·").replace(/&nbsp;/g, " ");

/** The pickable library, grouped by chapter, in reading order. */
export async function chapters() {
  const [chs, slides] = await Promise.all([
    db.selectAll("library_chapters", { select: "id,n,title,purpose,slides", order: "n.asc" }),
    db.selectAll("library_slides", {
      select: "slide_id,title,chapter,role,goal,entitlements,retired,archived",
    }),
  ]);
  const bySlide = new Map(slides.map((s) => [s.slide_id, s]));
  return chs.map((ch) => ({
    id: ch.id,
    n: ch.n,
    title: ch.title,
    purpose: ch.purpose || "",
    slides: (ch.slides || []).map((id) => {
      const s = bySlide.get(id);
      if (!s) return { slide_id: id, missing: true, pickable: false };
      return {
        slide_id: id,
        title: decode(s.title || id),
        goal: s.goal || "",
        role: s.role || "",
        entitlements: s.entitlements || [],
        // The two independent reasons a slide cannot be chosen: retired in the
        // repo (git-versioned) and archived in the app (demoted here).
        retired: Boolean(s.retired),
        archived: Boolean(s.archived),
        pickable: !s.retired && !s.archived,
      };
    }),
  }));
}

/** Clearance for a draft, derived — never taken from the caller. */
async function clearanceFor(customerId) {
  const allowed = ["public"];
  if (!customerId) return allowed;
  const [c] = await db.select("customers", { id: `eq.${customerId}`, select: "slug,name" });
  if (!c) return allowed;
  const scope = clearanceForCustomer(c);
  if (scope && !allowed.includes(scope)) allowed.push(scope);
  return allowed;
}

/** Which picked slides this draft is not cleared to carry, and why. */
export async function blocked(recipe, allowed) {
  const picked = Object.values(recipe || {}).flat();
  if (!picked.length) return [];
  const rows = await db.selectAll("library_slides", {
    select: "slide_id,entitlements,retired,archived",
  });
  const by = new Map(rows.map((r) => [r.slide_id, r]));
  const out = [];
  for (const id of picked) {
    const s = by.get(id);
    if (!s) { out.push({ slide_id: id, why: "no longer in the library" }); continue; }
    if (s.retired) { out.push({ slide_id: id, why: "retired" }); continue; }
    if (s.archived) { out.push({ slide_id: id, why: "archived so it cannot be picked" }); continue; }
    const need = (s.entitlements || []).filter((e) => e && e !== "public" && !allowed.includes(e));
    if (need.length) out.push({ slide_id: id, why: `needs ${need.join(", ")} clearance` });
  }
  return out;
}

export async function get(draftId, member) {
  const [row] = await db.select("deck_drafts", { id: `eq.${draftId}`, select: "*" });
  if (!row) return null;
  // A draft is the author's. Reading someone else's unfinished deck is not a
  // thing this system does; the deck list says only THAT one exists, and whose.
  if (row.user_id !== member.id) return { forbidden: true };
  return row;
}

export async function mine(member) {
  return db.selectAll("deck_drafts", {
    user_id: `eq.${member.id}`,
    select: "id,deck_id,title,slug,type,updated_at",
    order: "updated_at.desc",
  });
}

/**
 * Start a draft.
 *
 * `from` copies another deck's RECIPE -- its slides and their order -- not its
 * document. That is a copy and not a link: the deck copied from is untouched,
 * and this one still publishes as its own v1.
 *
 * Two things the copy does on the way in, both of which exist because of how a
 * customer's material leaks:
 *   - it drops any slide the new clearance does not cover, and says which;
 *   - it keeps the footer and cover meta of the NEW title, not the copied one.
 */
export async function start({ customer = "", from = "", title = "", type = "", slug = "" }, member) {
  let customerId = null, customerName = "", customerSlug = "";
  if (customer) {
    const [c] = await db.select("customers", { slug: `eq.${customer}`, select: "id,slug,name" });
    if (!c) return { ok: false, error: "no_such_customer",
                     message: `No customer "${customer}". Register them first.` };
    customerId = c.id; customerName = decode(c.name); customerSlug = c.slug;
  }

  const allowed = await clearanceFor(customerId);
  const deckType = type || (customerId ? "customer" : "teaser");

  // Default: start from the master of this type. That is what a master is for.
  let source = from;
  if (!source) {
    const [m] = await db.select("decks", {
      type: `eq.${deckType}`, is_master: "is.true", select: "slug",
    });
    source = m?.slug || "empty";
  }

  let recipe = {}, order = [], vars = {}, dropped = [];
  if (source && source !== "empty") {
    const [src] = await db.select("decks", { slug: `eq.${source}`, select: "id,current_version_n,title" });
    if (!src) return { ok: false, error: "no_such_deck", message: `No deck "${source}" to start from.` };
    const [v] = await db.select("deck_versions", {
      deck_id: `eq.${src.id}`, n: `eq.${src.current_version_n}`, select: "recipe",
    });
    if (!v?.recipe?.chapters) {
      return { ok: false, error: "no_recipe",
               message: `"${source}" was published before recipes, so its slides cannot be copied. ` +
                        `Start from another deck, or from an empty one.` };
    }
    for (const ch of v.recipe.chapters) recipe[ch.id] = (ch.slides || []).map((s) => s.slide_id);
    order = v.recipe.order || [];
    vars = { ...(v.recipe.vars || {}) };

    // Drop what this deck is not cleared for, rather than carrying it into a
    // build that will fail -- or worse, into a deck for a different customer.
    const bad = await blocked(recipe, allowed);
    if (bad.length) {
      const drop = new Set(bad.map((b) => b.slide_id));
      for (const [cid, ids] of Object.entries(recipe)) {
        recipe[cid] = ids.filter((id) => !drop.has(id));
        if (!recipe[cid].length) delete recipe[cid];
      }
      order = order.filter((id) => !drop.has(id));
      dropped = bad;
    }
  }

  const finalTitle = title || (customerName
    ? `Oppr · Operator Intelligence · ${customerName}`
    : `Oppr · Operator Intelligence`);
  const date = new Date().toISOString().slice(0, 10);
  const finalSlug = safeSlug(slug || `${date}_${customerSlug || deckType}`, 80);

  // The footer and cover meta belong to THIS deck, not the one copied from.
  vars.deck_footer = vars.deck_footer && !from ? vars.deck_footer
    : (customerName ? `Prepared for ${customerName}` : finalTitle.replace(/^Oppr · /, ""));
  vars.cover_meta = `${deckType.replace(/(^|-)(\w)/g, (_, a, b) => (a ? " " : "") + b.toUpperCase())} · ` +
    `${new Date().toLocaleString("en", { month: "long", year: "numeric" })} · Confidential · oppr.ai`;

  const [row] = await db.insert("deck_drafts", {
    deck_id: null, user_id: member.id,
    title: finalTitle, slug: finalSlug, type: deckType, customer_id: customerId,
    recipe, vars, slots: {},
  });

  return {
    ok: true, draft: row, allowed, dropped,
    started_from: source === "empty" ? null : source,
  };
}

/** Open an existing deck for editing: its published recipe becomes your draft. */
export async function open(deckSlug, member) {
  const [deck] = await db.select("decks", { slug: `eq.${deckSlug}`, select: "*" });
  if (!deck) return { ok: false, error: "no_such_deck", message: `No deck "${deckSlug}".` };

  const existing = await db.select("deck_drafts", {
    deck_id: `eq.${deck.id}`, user_id: `eq.${member.id}`, select: "*",
  });
  if (existing.length) return { ok: true, draft: existing[0], resumed: true, deck };

  const [v] = await db.select("deck_versions", {
    deck_id: `eq.${deck.id}`, n: `eq.${deck.current_version_n}`, select: "recipe",
  });
  if (!v?.recipe?.chapters) {
    return { ok: false, error: "no_recipe",
             message: `"${deckSlug}" was published before recipes, so its slides cannot be reopened. ` +
                      `Its text can still be edited in the app.` };
  }
  const recipe = {};
  for (const ch of v.recipe.chapters) recipe[ch.id] = (ch.slides || []).map((s) => s.slide_id);

  const [row] = await db.insert("deck_drafts", {
    deck_id: deck.id, user_id: member.id,
    title: deck.title, slug: deck.slug, type: deck.type, customer_id: deck.customer_id,
    recipe, vars: v.recipe.vars || {}, slots: {},
  });
  return { ok: true, draft: row, resumed: false, deck };
}

/** Add, remove and reorder slides. */
export async function setSlides(draftId, { add = [], remove = [], order = null }, member) {
  const draft = await get(draftId, member);
  if (!draft) return { ok: false, error: "no_such_draft" };
  if (draft.forbidden) return { ok: false, error: "not_yours" };

  const recipe = { ...(draft.recipe || {}) };
  const allowed = await clearanceFor(draft.customer_id);

  if (add.length) {
    const rows = await db.selectAll("library_slides", {
      select: "slide_id,chapter,retired,archived,entitlements",
    });
    const by = new Map(rows.map((r) => [r.slide_id, r]));
    const refused = [];
    for (const id of add) {
      const s = by.get(id);
      if (!s) { refused.push({ slide_id: id, why: "no such slide" }); continue; }
      if (s.retired || s.archived) {
        refused.push({ slide_id: id, why: s.retired ? "retired" : "archived so it cannot be picked" });
        continue;
      }
      const need = (s.entitlements || []).filter((e) => e && e !== "public" && !allowed.includes(e));
      if (need.length) {
        refused.push({ slide_id: id, why: `needs ${need.join(", ")} clearance, this deck has ${allowed.join(", ")}` });
        continue;
      }
      const cid = s.chapter || "ch-open";
      recipe[cid] = [...new Set([...(recipe[cid] || []), id])];
    }
    if (refused.length && refused.length === add.length) {
      return { ok: false, error: "not_pickable", refused };
    }
    if (refused.length) {
      await save(draftId, { recipe }, member);
      return { ok: true, draft: await get(draftId, member), refused };
    }
  }

  for (const id of remove) {
    for (const cid of Object.keys(recipe)) {
      recipe[cid] = (recipe[cid] || []).filter((s) => s !== id);
      // An empty chapter IS a skipped chapter: skipping one drops every slide
      // under it, so leaving the key behind would mean something different.
      if (!recipe[cid].length) delete recipe[cid];
    }
  }

  const patch = { recipe };
  if (order) patch.vars = draft.vars;   // order lives beside the recipe
  await db.update("deck_drafts", { id: draftId },
    { recipe, ...(order ? { slots: { ...(draft.slots || {}), _order: order } } : {}) });
  return { ok: true, draft: await get(draftId, member) };
}

export async function save(draftId, patch, member) {
  const draft = await get(draftId, member);
  if (!draft) return { ok: false, error: "no_such_draft" };
  if (draft.forbidden) return { ok: false, error: "not_yours" };
  const allowedKeys = ["title", "type", "recipe", "vars", "slots"];
  const clean = {};
  for (const k of allowedKeys) if (k in patch) clean[k] = patch[k];
  if (!Object.keys(clean).length) return { ok: true, draft };
  await db.update("deck_drafts", { id: draftId }, clean);
  return { ok: true, draft: await get(draftId, member) };
}

export async function remove(draftId, member) {
  const draft = await get(draftId, member);
  if (!draft || draft.forbidden) return { ok: false };
  await db.del("deck_drafts", { id: draftId });
  return { ok: true };
}

/** The draft as a recipe the build pipeline understands. */
export async function toRecipe(draft) {
  const allowed = await clearanceFor(draft.customer_id);
  const [customer] = draft.customer_id
    ? await db.select("customers", { id: `eq.${draft.customer_id}`, select: "slug" })
    : [null];
  const order = draft.slots?._order || [];
  return {
    slug: draft.slug,
    title: draft.title,
    type: draft.type,
    chapters: draft.recipe || {},
    order,
    vars: { ...(draft.vars || {}), ...(draft.slots?._order ? {} : {}) },
    client: customer?.slug || "",
    customer: customer?.slug || "",
    allowed_entitlements: allowed,
  };
}
