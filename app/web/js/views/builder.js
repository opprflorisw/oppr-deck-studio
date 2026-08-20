// The deck builder: a workspace BOUND TO A DECK.
//
// It is not a place you go to make things. It is a deck, opened. That single
// change is what fixes the flow:
//
//   #/build/new        a deck that does not exist yet, and publishes as v1
//   #/build/<deck-id>  an existing deck, publishing as its next version
//
// There is no `#/build` landing page any more (2026-08-20). It listed the same
// decks as the Decks page in a poorer form — no note, no star, no verify state,
// no page count — so the two disagreed about what a deck list looks like while
// claiming to be one. The Decks page is the list; you reach this workspace by
// opening a deck, or with New deck. `#/build` redirects there.
//
// **A version can only come from a deck.** There is no "new version of"
// dropdown any more, because that let you conjure v4 of the Management Outlook
// out of a blank form with a slide set that had nothing to do with v3. Now the
// route you came through decides: blank form means a new deck at v1, opened from
// a deck means the next version of that deck, and the slug, client and clearance
// are inherited and read-only. The escape hatch for "I want a variant, not a
// version" is Save as a new deck, in the publish dialog.
//
// The workspace is a SLIDE SORTER, not a list. The grid is the deck; you drag it
// into the order you will present. Chapters collapse into a rail whose only job
// is adding, because chapter order seeds a deck and then gets out of the way
// (SPEC §2, as amended).
//
// What has not moved: verify still blocks. Building shells out to the same
// compose -> assemble -> pdf -> verify -> publish the CLI runs. Entitlement is
// not a suggestion, which is why the rail greys out what this deck is not
// cleared for INSTEAD of letting you find out 40 seconds into a build.

import { $, $$, el, esc, toast, decodeEntities } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go, query } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { previewFrame, fetchFragment } from "../preview.js";
import { openDeckViewer, recipePages } from "./viewer.js";
import { openNewDeck } from "./builder-new.js";
import { DECK_TYPES, knownType } from "../decktypes.js";
import { localDrafts, writeLocalDrafts } from "../drafts.js";
import { openPublish } from "./builder-publish.js";

let model = null;   // { chapters, slidesById }
let work = null;    // the working deck (see blankWork)
let mountRef = null;

// ---------------------------------------------------------------- the model

const blankWork = () => ({
  deck: null,              // null = a new deck; otherwise {id, slug, title, type, client, version}
  localId: "",             // which localStorage draft this is, for a new deck
  slug: "", title: "", type: "", client: "",
  allowed_entitlements: ["public"],
  chapters: {},            // cid -> [slide_id]   (which chapter each pick came from)
  order: [],               // slide_id[]          (the deck as it will read)
  vars: { deck_footer: "", cover_meta: "", start_target: "a start date we agree together" },
  note: "",
});

const picked = (cid) => work.chapters[cid] || [];
const chapterOf = (sid) =>
  (model.chapters.find((c) => c.slides.some((s) => s.slide_id === sid)) || {}).id;
const slideOf = (sid) => model.slidesById.get(sid) || { slide_id: sid };

const thumbOf = (sid) => {
  const i = (state.index?.slides || []).find((x) => x.id === sid);
  return i && i.thumb ? `/repo/${i.thumb}` : "";
};

// What a slide needs that this deck is not cleared for. Empty = fine.
// Mirrors verifylib's per-image rule exactly (check-drift.py computes the set),
// so the picker and the gate can never disagree.
function missingClearance(s) {
  const allowed = new Set([...(work.allowed_entitlements || []), "public"]);
  return (s.entitlements || []).filter((e) => !allowed.has(e));
}

function pickableNow(s) {
  if (s.retired) return { ok: false, why: "retired in the repo" };
  if (s.archived) return { ok: false, why: "archived" };
  const miss = missingClearance(s);
  if (miss.length) return { ok: false, why: `needs ${miss.join(" + ")} clearance` };
  return { ok: true, why: "" };
}

// ---------------------------------------------------------------- persistence
//
// An unpublished deck's draft lives in `../drafts.js` because the Decks page
// lists them too, and neither page should have to import the other to do it.

let saveTimer = null;
// A draft is saved where it belongs: an existing deck's working recipe goes to
// the backend (so it survives a reload AND is not trapped in one browser); a
// deck that does not exist yet has nowhere in the backend to live, so it stays
// local until the first publish gives it a row.
function save({ now = false } = {}) {
  if (!work) return;
  if (!work.deck) {
    const all = localDrafts();
    all[work.localId] = { ...work, saved_at: new Date().toISOString() };
    writeLocalDrafts(all);
    return;
  }
  clearTimeout(saveTimer);
  const put = () => api.putDeckDraft(work.deck.id, draftPayload()).catch(() => {});
  if (now) return put();
  saveTimer = setTimeout(put, 900);
}

const draftPayload = () => ({
  chapters: work.chapters, order: work.order, vars: work.vars,
  title: work.title, type: work.type, note: work.note,
  allowed_entitlements: work.allowed_entitlements,
});

// ---------------------------------------------------------------- editing

function addPick(cid, sid) {
  work.chapters[cid] = [...picked(cid).filter((s) => s !== sid), sid];
  if (work.order.includes(sid)) return;
  // Drop it beside its chapter-mates so a fresh pick reads sensibly, and at the
  // end when the chapter is new to this deck. After that the order is yours.
  const ciOf = (s) => model.chapters.findIndex((c) => (work.chapters[c.id] || []).includes(s));
  const myCi = model.chapters.findIndex((c) => c.id === cid);
  let at = work.order.length;
  for (let i = work.order.length - 1; i >= 0; i--) {
    const oc = ciOf(work.order[i]);
    if (oc < 0) continue;
    if (oc <= myCi) { at = i + 1; break; }
    at = i;
  }
  work.order.splice(at, 0, sid);
}

function removePick(sid) {
  const cid = chapterOf(sid);
  if (cid) {
    const next = picked(cid).filter((s) => s !== sid);
    if (next.length) work.chapters[cid] = next;
    else delete work.chapters[cid];       // an empty chapter IS a skipped chapter
  }
  work.order = work.order.filter((s) => s !== sid);
}

function toggle(cid, sid) {
  const s = slideOf(sid);
  const can = pickableNow(s);
  if (!can.ok && !work.order.includes(sid)) { toast(`Cannot use this slide: ${can.why}.`); return; }
  if (picked(cid).includes(sid)) removePick(sid); else addPick(cid, sid);
  save(); paint();
}

// Move by one, or to an absolute index (which is what a drag does).
function move(sid, delta) {
  const i = work.order.indexOf(sid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= work.order.length) return false;
  work.order.splice(j, 0, work.order.splice(i, 1)[0]);
  save();
  return true;
}

function moveTo(sid, index) {
  const i = work.order.indexOf(sid);
  if (i < 0) return false;
  const to = Math.max(0, Math.min(work.order.length - 1, index));
  if (to === i) return false;
  work.order.splice(to, 0, work.order.splice(i, 1)[0]);
  save();
  return true;
}

// ---------------------------------------------------------------- preview

function closeModal() {
  $("#b-modal")?.remove();
  document.removeEventListener("keydown", onEsc);
}
function onEsc(e) { if (e.key === "Escape") closeModal(); }

function openSlidePreview(sid) {
  const s = slideOf(sid);
  const idx = (state.index?.slides || []).find((x) => x.id === sid) || {};
  const miss = missingClearance(s);
  const inDeck = work.order.includes(sid);
  closeModal();
  const m = el(`
    <div class="b-modal" id="b-modal">
      <div class="b-modal-in" role="dialog" aria-label="${esc(sid)}">
        <header>
          <code>${esc(sid)}</code>
          <span class="tmuted">${esc(idx.role || s.role || "")}</span>
          ${s.retired ? `<span class="bs-flag">retired</span>` : ""}
          ${s.archived ? `<span class="bs-flag">archived</span>` : ""}
          ${miss.length ? `<span class="bs-flag bs-flag--stop">needs ${esc(miss.join(" + "))}</span>` : ""}
          <span class="sp"></span>
          <button class="btn sm" id="b-modal-toggle">${inDeck ? "Remove from deck" : "Add to deck"}</button>
          <button class="ghost sm" id="b-modal-x">Close</button>
        </header>
        <div class="b-modal-body"><div id="b-prev"></div>
          <div class="b-modal-meta">
            ${s.goal ? `<p><b>What it is for</b><br>${esc(s.goal)}</p>` : ""}
            ${idx.notes ? `<p><b>Notes</b><br>${esc(idx.notes)}</p>` : ""}
            ${s.entitlements?.length
              ? `<p><b>Clearance</b> ${s.entitlements.map((e) => `<code>${esc(e)}</code>`).join(" ")}</p>`
              : `<p><b>Clearance</b> <code>public</code></p>`}
            ${idx.used_in?.length ? `<p><b>Used in</b> ${idx.used_in.map((u) => `<code>${esc(u)}</code>`).join(" ")}</p>` : ""}
            ${s.retired ? "" : `<p><button class="ghost sm" id="b-modal-arch">${
              s.archived ? "Restore to the picker" : "Archive so it cannot be picked"}</button></p>`}
          </div>
        </div>
      </div>
    </div>`);
  document.body.append(m);
  $("#b-prev", m).append(previewFrame(fetchFragment(sid), 640));
  $("#b-modal-x", m).addEventListener("click", closeModal);
  $("#b-modal-toggle", m).addEventListener("click", () => {
    const cid = chapterOf(sid);
    if (cid) toggle(cid, sid);
    closeModal();
  });
  $("#b-modal-arch", m)?.addEventListener("click", () => { archive(sid, !s.archived); closeModal(); });
  m.addEventListener("click", (e) => { if (e.target === m) closeModal(); });
  document.addEventListener("keydown", onEsc);
}

// The deck, full screen, in its own order, with its OWN footer and page numbers
// — and reorderable while you look at it, because the moment you notice a slide
// is in the wrong place is the moment you should be able to move it.
function openDeckPreview() {
  if (!work.order.length) { toast("Nothing picked yet."); return; }
  const vars = () => ({
    deck_footer: work.vars.deck_footer || work.title,
    cover_meta: work.vars.cover_meta || "",
    start_target: work.vars.start_target || "",
    deck_title: work.title,
  });
  openDeckViewer(recipePages(work.order, vars()), {
    title: `${work.title || work.slug || "Untitled"} — preview`,
    onMove: (i, d) => {
      const sid = work.order[i];
      if (!move(sid, d)) return null;
      paint();
      return { pages: recipePages(work.order, vars()), index: work.order.indexOf(sid) };
    },
  });
}

// ---------------------------------------------------------------- the sorter

function sorterCard(sid, i) {
  const s = slideOf(sid);
  const ch = model.chapters.find((c) => c.id === chapterOf(sid));
  const t = thumbOf(sid);
  const miss = missingClearance(s);
  const stale = work.behindSet?.has(sid);
  return `
    <div class="scard ${miss.length ? "is-stop" : ""} ${stale ? "is-stale" : ""}"
         draggable="true" data-sid="${esc(sid)}" data-i="${i}">
      <span class="scard-n">${String(i + 1).padStart(2, "0")}</span>
      <button class="scard-img" data-prev="${esc(sid)}" title="Preview this slide">
        ${t ? `<img src="${esc(t)}" alt="" loading="lazy">` : `<span class="bthumb-none">${icon("cards", 18)}</span>`}
      </button>
      <div class="scard-b">
        <code>${esc(sid)}</code>
        <span class="tmuted">${esc(ch ? ch.title : "")}</span>
        ${miss.length ? `<span class="bs-flag bs-flag--stop">needs ${esc(miss.join(" + "))}</span>` : ""}
        ${stale ? `<span class="bs-flag bs-flag--new">library moved on</span>` : ""}
      </div>
      <div class="scard-act">
        <button class="ghost sm" data-mv="${esc(sid)}" data-d="-1" ${i === 0 ? "disabled" : ""}
                title="Move earlier">&uarr;</button>
        <button class="ghost sm" data-mv="${esc(sid)}" data-d="1"
                ${i === work.order.length - 1 ? "disabled" : ""} title="Move later">&darr;</button>
        <button class="ghost sm" data-rm="${esc(sid)}" title="Remove from this deck">&times;</button>
      </div>
    </div>`;
}

function paintSorter() {
  const host = $("#b-sorter");
  if (!host) return;
  if (!work.order.length) {
    host.innerHTML = `<div class="b-empty">
      <p><b>No slides yet.</b></p>
      <p class="tmuted">Add them from the chapters on the left. Chapter order only
        seeds the deck: once a slide is here you can drag it anywhere.</p>
    </div>`;
    return;
  }
  host.innerHTML = work.order.map(sorterCard).join("");
}

// Drag to reorder. Delegated on the grid so a repaint never orphans a listener.
function wireDrag(host) {
  let dragSid = "";
  host.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".scard");
    if (!card) return;
    dragSid = card.dataset.sid;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    // Firefox will not start a drag without payload.
    try { e.dataTransfer.setData("text/plain", dragSid); } catch { /* ignore */ }
  });
  host.addEventListener("dragend", () => {
    dragSid = "";
    $$(".scard", host).forEach((c) => c.classList.remove("dragging", "over-before", "over-after"));
  });
  host.addEventListener("dragover", (e) => {
    if (!dragSid) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const card = e.target.closest(".scard");
    $$(".scard", host).forEach((c) => c.classList.remove("over-before", "over-after"));
    if (!card || card.dataset.sid === dragSid) return;
    const r = card.getBoundingClientRect();
    card.classList.add(e.clientX < r.left + r.width / 2 ? "over-before" : "over-after");
  });
  host.addEventListener("drop", (e) => {
    if (!dragSid) return;
    e.preventDefault();
    const card = e.target.closest(".scard");
    $$(".scard", host).forEach((c) => c.classList.remove("over-before", "over-after"));
    if (!card || card.dataset.sid === dragSid) return;
    const r = card.getBoundingClientRect();
    const before = e.clientX < r.left + r.width / 2;
    let target = work.order.indexOf(card.dataset.sid);
    const from = work.order.indexOf(dragSid);
    if (!before) target += 1;
    if (from < target) target -= 1;        // the moved card leaves a hole behind it
    if (moveTo(dragSid, target)) paint();
  });
}

// ---------------------------------------------------------------- the rail

function railSlide(c, s) {
  const on = picked(c.id).includes(s.slide_id);
  const can = pickableNow(s);
  const t = thumbOf(s.slide_id);
  return `
    <div class="rslide ${on ? "on" : ""} ${can.ok ? "" : "blocked"}">
      <button class="rpick" data-ch="${esc(c.id)}" data-slide="${esc(s.slide_id)}"
              ${can.ok || on ? "" : "disabled"}
              title="${can.ok ? "Add or remove this slide" : esc(`Not available: ${can.why}`)}">
        ${icon(on ? "checkboxOn" : "checkbox", 15)}
      </button>
      <button class="rthumb" data-prev="${esc(s.slide_id)}" title="Preview this slide">
        ${t ? `<img src="${esc(t)}" alt="" loading="lazy">` : `<span class="bthumb-none">${icon("cards", 13)}</span>`}
      </button>
      <div class="rbody">
        <code>${esc(s.slide_id)}</code>
        ${can.ok ? "" : `<span class="bs-flag ${s.retired || s.archived ? "" : "bs-flag--stop"}">${esc(can.why)}</span>`}
        ${s.goal ? `<p class="rgoal">${esc(s.goal)}</p>` : ""}
      </div>
    </div>`;
}

function railChapter(c) {
  const n = picked(c.id).length;
  // `openChapters` is the only truth. It is SEEDED with the chapters this deck
  // already draws from, so opening the workspace shows you the deck's own
  // chapters expanded — but a chapter you collapse stays collapsed, which it
  // could not if having picks forced it open.
  const open = work.openChapters.has(c.id);
  return `
    <section class="rchap ${n ? "" : "skipped"} ${open ? "open" : ""}" data-ch="${esc(c.id)}">
      <button class="rchap-h" data-toggle="${esc(c.id)}" aria-expanded="${open}">
        <span class="rchap-x">${icon(open ? "chevronDown" : "chevronRight", 13)}</span>
        <span class="rchap-n">${esc(c.n || "")}</span>
        <span class="rchap-t">${esc(c.title)}</span>
        <span class="rchap-c">${n ? `${n}/${c.slides.length}` : `0/${c.slides.length}`}</span>
      </button>
      ${open ? `<div class="rchap-b">
        ${c.purpose ? `<p class="rchap-p">${esc(c.purpose)}</p>` : ""}
        ${c.slides.map((s) => railSlide(c, s)).join("")}
      </div>` : ""}
    </section>`;
}

function paintRail() {
  const host = $("#b-rail");
  if (!host) return;
  host.innerHTML = model.chapters.map(railChapter).join("");
}

// ---------------------------------------------------------------- painting

function paint() {
  paintRail();
  paintSorter();
  const n = work.order.length;
  const t = $("#b-count");
  if (t) t.textContent = `${n} slide${n === 1 ? "" : "s"}`;
  const cs = $("#b-chaps");
  if (cs) cs.textContent = `${Object.keys(work.chapters).length} of ${model.chapters.length} chapters`;
  const dirty = $("#b-dirty");
  if (dirty) dirty.hidden = !isDirty();
}

// Has the working recipe diverged from what is published? For a new deck the
// answer is always yes; there is nothing published to diverge from.
function isDirty() {
  if (!work.deck) return work.order.length > 0;
  return JSON.stringify(work.order) !== JSON.stringify(work.publishedOrder || []);
}

// ---------------------------------------------------------------- actions

async function archive(sid, to) {
  try {
    await api.archiveSlide(sid, to);
    const s = model.slidesById.get(sid);
    if (s) s.archived = to;
    // Demoting something already in the deck would silently change the deck.
    if (to && work.order.includes(sid)) removePick(sid);
    save(); paint();
    toast(to ? `${sid} archived. It cannot be picked now.` : `${sid} is pickable again.`);
  } catch (e) { toast(`Could not change that: ${e.message}`); }
}

async function loadTypePicks() {
  if (!work.type) { toast("Choose a type under Deck details first."); return; }
  const t = (state.backend.decks || []).find((d) => d.type === work.type && d.is_master);
  if (!t) { toast(`No master for ${work.type} to copy picks from.`); return; }
  try {
    const r = await api.getDeckRecipe(t.id);
    if (!r.recipe?.chapters) { toast("That master has no recipe yet."); return; }
    applyRecipe(r.recipe);
    save(); paint();
    toast(`Loaded the ${work.type} master's picks. Change anything you like.`);
  } catch (e) { toast(`Could not load: ${e.message}`); }
}

// A published recipe is chapters-and-slides; the working shape adds the flat
// order. Anything the recipe recorded an explicit order for wins; the rest falls
// back to chapter order, which is what a pre-order recipe implies anyway.
function applyRecipe(recipe) {
  work.chapters = {}; work.order = [];
  for (const c of recipe.chapters || []) {
    if (!c.id) continue;
    work.chapters[c.id] = (c.slides || []).map((s) => s.slide_id || s);
  }
  const seeded = (recipe.chapters || []).flatMap((c) => (c.slides || []).map((s) => s.slide_id || s));
  const explicit = (recipe.order || []).filter((s) => seeded.includes(s));
  work.order = [...explicit, ...seeded.filter((s) => !explicit.includes(s))];
}

// ---------------------------------------------------------------- starting one

// `#/build/new` — the create dialog, opened over whatever the router already
// mounted (the Decks page). A separate route so the act of starting a deck is
// linkable and survives a reload, rather than existing only as a button press.
//
// `?for=<customer>` is how the Customers page starts a deck: the customer is
// bound before composing, so the deck it publishes is filed under them rather
// than needing to be re-homed afterwards.
export function openCreateDialog() {
  const forSlug = query().get("for") || "";
  const forCustomer = forSlug
    ? (state.backend.customers || []).find((c) => c.slug === forSlug) || null
    : null;
  if (forSlug && !forCustomer) toast(`No customer '${forSlug}'. Starting an unbound deck.`);
  openNewDeck((meta) => startNewDeck(meta), { forCustomer });
}

async function startNewDeck(meta) {
  const { base_deck_id: baseId, ...fixed } = meta;
  const id = `d${Date.now().toString(36)}`;
  const w = { ...blankWork(), ...fixed, localId: id };
  w.vars.deck_footer = fixed.title.replace(/^oppr\s*[·.\-]\s*/i, "");
  w.vars.cover_meta = fixed.title.replace(/^oppr\s*[·.\-]\s*/i, "");

  if (baseId) {
    try {
      const [r] = await Promise.all([api.getDeckRecipe(baseId), ensureModel()]);
      if (!r.recipe?.chapters?.length) {
        toast("That deck has no recipe to copy. Starting empty.");
      } else {
        // Seed through the working shape, then drop anything this deck is not
        // cleared for. A base deck may be cleared for a customer this one is
        // not, and carrying those slides across would either leak that customer
        // into someone else's deck or fail verify a minute into the first build.
        // Dropping them here is the same rule the picker enforces, applied at
        // the one moment the slides arrive without passing through the picker.
        work = w;
        applyRecipe(r.recipe);
        w.vars = { ...w.vars, ...(r.recipe.vars || {}) };
        // The footer and cover meta name the DECK, so they follow the new title,
        // not the copied one. Everything else in vars is content and carries over.
        w.vars.deck_footer = fixed.title.replace(/^oppr\s*[·.\-]\s*/i, "");
        w.vars.cover_meta = fixed.title.replace(/^oppr\s*[·.\-]\s*/i, "");
        const dropped = dropUncleared(w);
        toast(dropped
          ? `Copied ${w.order.length} slides; left out ${dropped} this deck is not cleared for.`
          : `Copied ${w.order.length} slides. Change anything you like.`);
      }
    } catch (e) {
      toast(`Could not copy that deck: ${e.message}. Starting empty.`);
    }
  }

  const all = localDrafts();
  all[id] = { ...w, saved_at: new Date().toISOString() };
  writeLocalDrafts(all);
  go(`/build/draft/${id}`);
}

// The library model, loaded on demand. The chooser does not need it, but copying
// a deck does: without it the entitlement filter below has nothing to check
// against and uncleared slides would ride into the deck unnoticed, to be caught
// a minute later by verify instead of now.
async function ensureModel() {
  if (model) return model;
  const data = await api.getLibraryChapters();
  model = {
    chapters: data.chapters || [],
    slidesById: new Map((data.chapters || []).flatMap((c) => c.slides).map((s) => [s.slide_id, s])),
  };
  return model;
}

// Remove picks the deck's clearance does not cover. With no model it drops
// nothing and the picker greys them out instead, which is a softer failure than
// guessing.
function dropUncleared(w) {
  if (!model) return 0;
  const allowed = new Set([...(w.allowed_entitlements || []), "public"]);
  const bad = w.order.filter((sid) => {
    const s = model.slidesById.get(sid);
    return s && (s.entitlements || []).some((e) => !allowed.has(e));
  });
  if (!bad.length) return 0;
  const drop = new Set(bad);
  w.order = w.order.filter((s) => !drop.has(s));
  for (const cid of Object.keys(w.chapters)) {
    const kept = w.chapters[cid].filter((s) => !drop.has(s));
    if (kept.length) w.chapters[cid] = kept;
    else delete w.chapters[cid];
  }
  return bad.length;
}

// ---------------------------------------------------------------- the workspace

export async function renderWorkspace(mount, { deckId = "", localId = "" } = {}) {
  mountRef = mount;
  const wrap = el(`<div class="wrap"><p class="tmuted">Loading&hellip;</p></div>`);
  mount(wrap);

  let data;
  try { data = await api.getLibraryChapters(); }
  catch (e) {
    wrap.innerHTML = `<p class="warn-text">Could not load the library: ${esc(e.message)}</p>`;
    return;
  }
  model = {
    chapters: data.chapters || [],
    slidesById: new Map((data.chapters || []).flatMap((c) => c.slides).map((s) => [s.slide_id, s])),
  };

  work = blankWork();
  work.openChapters = new Set();

  if (deckId) {
    let d;
    try { d = await api.getDeckRecipe(deckId); }
    catch (e) {
      wrap.innerHTML = `<p class="warn-text">Could not open that deck: ${esc(e.message)}</p>`;
      return;
    }
    const listed = (state.backend.decks || []).find((x) => x.id === deckId) || {};
    work.deck = { id: d.id, slug: d.slug, title: d.title, type: d.type,
                  client: d.client, version: d.version, is_master: d.is_master };
    work.slug = d.slug;
    work.title = decodeEntities(d.title || "");
    work.type = d.type || "";
    work.client = d.client || "";
    // Clearance is inherited, never re-picked: a "new version" that could widen
    // it would be a way around the entitlement gate rather than a version.
    work.allowed_entitlements = [...new Set(["public", ...(d.client ? [d.client] : [])])];
    if (d.recipe) {
      applyRecipe(d.recipe);
      // The footer and cover meta are part of the deck, not of the picker. A
      // rebuild that dropped them would blank them silently: verify does not
      // complain about an empty footer, only a missing one.
      work.vars = { ...work.vars, ...(d.recipe.vars || {}) };
      if (Array.isArray(d.recipe.allowed_entitlements)) {
        work.allowed_entitlements = [...new Set(["public", ...d.recipe.allowed_entitlements])];
      }
    }
    const publishedFooter = work.vars.deck_footer;
    work.publishedOrder = [...work.order];
    // Which pages the library has moved on from since this version was published.
    work.behindSet = new Set((listed.behind || []).map((b) => b.slide_id));
    // An unpublished draft wins over the published picks: it is what you were
    // last doing, and the published version is one click away in the timeline.
    if (d.draft) {
      applyRecipe({ chapters: Object.entries(d.draft.chapters || {})
        .map(([id, slides]) => ({ id, slides })), order: d.draft.order });
      work.vars = { ...work.vars, ...(d.draft.vars || {}) };
      work.title = d.draft.title || work.title;
      work.type = d.draft.type || work.type;
      work.note = d.draft.note || "";
      work.hadDraft = true;
    }
    // Entities are how these were stored, but a person editing a field should
    // see "A · B", not "A &middot; B". The pipeline is UTF-8 end to end, so the
    // literal character round-trips through assemble and verify unchanged.
    for (const k of ["deck_footer", "cover_meta"]) {
      if (work.vars[k]) work.vars[k] = decodeEntities(work.vars[k]);
    }
    // Last, so it survives the draft merge: a footer is on every content slide,
    // and an empty one prints an empty band that verify accepts without a word.
    // There is no case where blank is what someone meant, so fall back to what
    // this deck last published, and only then to its title.
    if (!work.vars.deck_footer) work.vars.deck_footer = publishedFooter || work.title;
  } else if (localId) {
    const stored = localDrafts()[localId];
    if (!stored) { toast("That draft is gone."); return go("/decks"); }
    work = { ...blankWork(), ...stored, openChapters: new Set() };
    work.localId = localId;
    work.deck = null;
  } else {
    return go("/decks");
  }

  // Open the chapters this deck already draws from; leave the rest collapsed so
  // the rail is a short list you scan, not eleven expanded sections.
  work.openChapters = new Set(Object.keys(work.chapters));
  if (!work.openChapters.size && model.chapters[0]) work.openChapters.add(model.chapters[0].id);

  wrap.innerHTML = shell();
  wireWorkspace(wrap);
  paint();
}

function shell() {
  const d = work.deck;
  const clearance = work.allowed_entitlements.filter((e) => e !== "public");
  return `
    <div class="bhead">
      <div class="bhead-top">
        <button class="ghost sm" id="b-back">${ibtn("prev", "Decks")}</button>
        <h2 id="b-headtitle">${esc(work.title || work.slug || "Untitled")}</h2>
        <span class="bhead-act">
          <button class="ghost" id="b-preview">${ibtn("preview", "Preview")}</button>
          <button class="ghost" id="b-check">${ibtn("info", "Check")}</button>
          <button class="btn" id="b-publish">${
            d ? `Publish as v${d.version + 1}` : "Publish as v1"}</button>
        </span>
      </div>
      <div class="bhead-meta">
        ${d ? `<span class="tags">v${esc(d.version)} published</span>`
            : `<span class="pill-status draft">not published</span>`}
        <span class="tags" id="b-count">0 slides</span>
        <span class="tmuted" id="b-chaps"></span>
        ${work.client ? `<span class="tags">${esc(work.client)}</span>` : ""}
        <span class="tags" title="Which customers' material this deck may carry">
          cleared: ${clearance.length ? esc(clearance.join(", ")) : "public only"}</span>
        <span class="pill-status draft" id="b-dirty" hidden>unpublished changes</span>
      </div>
    </div>

    <details class="bdetails" id="b-details">
      <summary>${icon("settings", 14)} Deck details</summary>
      <div class="bdetails-b">
        <label class="wide">Title <input id="b-title" value="${esc(work.title)}"></label>
        <label class="wide narrow-control">Type
          <select id="b-type">
            ${DECK_TYPES.map((t) => `<option value="${esc(t.id)}" ${t.id === work.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")}
            ${knownType(work.type) || !work.type ? "" :
              `<option value="${esc(work.type)}" selected>${esc(work.type)}</option>`}
          </select></label>
        <label class="wide">Footer <input id="b-footer" value="${esc(work.vars.deck_footer)}"></label>
        <label class="wide">Cover meta <input id="b-cover" value="${esc(work.vars.cover_meta)}"></label>
        <p class="note wide">Slug <code>${esc(work.slug)}</code>, client
          <code>${esc(work.client || "none")}</code> and clearance are fixed for the
          life of the deck: every version inherits them, so a version can never
          quietly widen what this deck is allowed to carry.</p>
        <p class="wide"><button class="chipbtn" id="b-loadtype">${
          icon("bulb", 14)} Load this type's master picks</button>
          <button class="chipbtn" id="b-clear">Clear all slides</button></p>
      </div>
    </details>

    ${work.hadDraft ? `<div class="bnotice">${icon("info", 15)}
      You have unpublished changes here from an earlier session. Publish them, or
      <button class="linkbtn" id="b-revert">go back to what is published</button>.
    </div>` : ""}

    <div class="bwork">
      <aside class="brail">
        <div class="brail-h">
          <b>Add slides</b>
          <span class="tmuted">chapter by chapter</span>
        </div>
        <div id="b-rail"></div>
        ${newSlidePanel()}
      </aside>
      <div class="bstage">
        <div class="bstage-h">
          <b>The deck</b>
          <span class="tmuted">drag to reorder &middot; click a page to preview it</span>
        </div>
        <div id="b-sorter" class="sgrid"></div>
      </div>
    </div>`;
}

function newSlidePanel() {
  return `
    <details class="bnew">
      <summary>${icon("compose", 14)} Need a slide that does not exist?</summary>
      <p>A new slide is a CLI job: it must compose only from documented
        design-system blocks, and the app never writes <code>library/</code>.
        Claude writes it with you and files it in the chapter you name.</p>
      <label>Chapter
        <select id="b-newch">
          ${model.chapters.map((c) => `<option value="${esc(c.id)}">${esc(c.n)} ${esc(c.title)}</option>`).join("")}
        </select></label>
      <label>What should it do?
        <input id="b-newwhat" placeholder="e.g. answer the 'we already have a MES' objection"></label>
      <button class="chipbtn" id="b-newcopy">Copy the prompt for Claude</button>
      <pre class="prompt" id="b-newprompt"></pre>
    </details>`;
}

// ---------------------------------------------------------------- wiring

function wireWorkspace(wrap) {
  $("#b-back", wrap).addEventListener("click", () => { save({ now: true }); go("/decks"); });
  $("#b-preview", wrap).addEventListener("click", openDeckPreview);
  $("#b-check", wrap).addEventListener("click", () => {
    if (!guard()) return;
    openPublish(work, { dryRun: true });
  });
  $("#b-publish", wrap).addEventListener("click", () => {
    if (!guard()) return;
    openPublish(work, { dryRun: false, onDone: onPublished });
  });

  const bind = (sel, apply) => $(sel, wrap)?.addEventListener("input", (e) => {
    apply(e.target.value); save();
  });
  bind("#b-title", (v) => { work.title = v; $("#b-headtitle", wrap).textContent = v || work.slug; });
  bind("#b-footer", (v) => { work.vars.deck_footer = v; });
  bind("#b-cover", (v) => { work.vars.cover_meta = v; });
  $("#b-type", wrap)?.addEventListener("change", (e) => { work.type = e.target.value; save(); });
  $("#b-loadtype", wrap)?.addEventListener("click", loadTypePicks);
  $("#b-clear", wrap)?.addEventListener("click", () => {
    work.chapters = {}; work.order = []; save(); paint();
  });
  $("#b-revert", wrap)?.addEventListener("click", async () => {
    if (!work.deck) return;
    try {
      await api.clearDeckDraft(work.deck.id);
      toast("Draft discarded. Showing what is published.");
      renderWorkspace(mountRef, { deckId: work.deck.id });
    } catch (e) { toast(e.message || "could not discard"); }
  });

  const rail = $("#b-rail", wrap);
  rail.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (t) {
      const cid = t.dataset.toggle;
      if (work.openChapters.has(cid)) work.openChapters.delete(cid);
      else work.openChapters.add(cid);
      return paintRail();
    }
    const p = e.target.closest("[data-slide]");
    if (p && !p.disabled) return toggle(p.dataset.ch, p.dataset.slide);
    const v = e.target.closest("[data-prev]");
    if (v) return openSlidePreview(v.dataset.prev);
  });

  const sorter = $("#b-sorter", wrap);
  sorter.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mv]");
    if (m && !m.disabled) { if (move(m.dataset.mv, Number(m.dataset.d))) paint(); return; }
    const r = e.target.closest("[data-rm]");
    if (r) { removePick(r.dataset.rm); save(); return paint(); }
    const v = e.target.closest("[data-prev]");
    if (v) return openSlidePreview(v.dataset.prev);
  });
  wireDrag(sorter);

  wireNewSlidePrompt(wrap);
}

// Everything that must hold before the pipeline is worth starting. The
// clearance check in particular: verify WOULD catch it, 40 seconds later, after
// a print. Catching it here costs nothing and says the same thing.
function guard() {
  if (!work.order.length) { toast("Pick at least one slide."); return false; }
  if (!work.title.trim()) { toast("Give it a title under Deck details."); return false; }
  const stops = work.order.map(slideOf).filter((s) => missingClearance(s).length);
  if (stops.length) {
    toast(`${stops.length} slide(s) need clearance this deck does not have. Verify would fail.`);
    return false;
  }
  return true;
}

async function onPublished() {
  // The draft has become a version, so it must stop shadowing it.
  if (work.deck) { try { await api.clearDeckDraft(work.deck.id); } catch { /* not fatal */ } }
  else if (work.localId) {
    const all = localDrafts();
    delete all[work.localId];
    writeLocalDrafts(all);
  }
  await loadBackend(api);
}

function wireNewSlidePrompt(wrap) {
  const build = () => {
    const cid = $("#b-newch", wrap).value;
    const c = model.chapters.find((x) => x.id === cid) || {};
    const what = $("#b-newwhat", wrap).value.trim() || "(say what the slide should do)";
    return `/edit-canonical

Add a new library slide.

Purpose: ${what}
Chapter: ${cid} (${c.title}) — "${c.purpose || ""}"
Slides already in that chapter: ${(c.slides || []).map((s) => s.slide_id).join(", ") || "(none)"}

Please:
1. Compose it only from documented blocks in library/design-system/. If it needs a
   pattern that is not there, add the specimen and its CSS to showcase.css first.
2. Write library/slides/<id>/slide.html + meta.yaml, including chapter: ${cid} and
   the intent fields goal / why / with.
3. Add the id to library/chapters.yaml under ${cid}, in the position that reads best.
4. Run: .\\tools\\build-slide-catalog.ps1
5. Run: npm test                          (the docs and chapter gates)
6. Run: npm run studio -- sync-library    (so the hosted builder sees it)`;
  };
  const repaint = () => { $("#b-newprompt", wrap).textContent = build(); };
  $("#b-newch", wrap).addEventListener("change", repaint);
  $("#b-newwhat", wrap).addEventListener("input", repaint);
  repaint();
  $("#b-newcopy", wrap).addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(build());
      toast("Prompt copied. Paste it into Claude Code.");
    } catch { toast("Could not copy — select the prompt below instead."); }
  });
}
