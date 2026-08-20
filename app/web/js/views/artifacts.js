// The unified artifact list (Deck Studio 2.0).
//
// Decks and social output used to be two lists over two stores, rendered by two
// view modules with two different action vocabularies — the reason a capability
// could exist for decks and be missing for carousels without anyone noticing.
// Since the artifact model merged, both are rows here, told apart by `kind`.
//
// The row answers "which one do I want?" without opening anything: how long it
// is, when it last changed and who changed it, what you wrote about it, and
// whether you starred it. Those four are the whole point of the list — a wall of
// near-identical titles is not a list, it is a lookup you have to do by hand.
//
// The action grammar is fixed and identical on every row:
//     Open · [Post text] · Download
// Edit is NOT here. It lives on the artifact's own page, one click in, because
// editing is a thing you do to an artifact you have already chosen, and putting
// it in the list made every row look like a fork in the road.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { offlinePanel } from "./deck.js";
import { summarize } from "../verify.js";
import { openPostEditor } from "../postedit.js";
import { mountNote } from "../note.js";
import { typeLabel, typeBlurb, typeRank, isCustomerDeck } from "../decktypes.js";
import { draftList, dropLocalDraft } from "../drafts.js";

const SOCIAL_KINDS = new Set(["carousel", "image", "article", "post"]);

const isDeck = (d) => !d.kind || d.kind === "deck";
const isSocial = (d) => SOCIAL_KINDS.has(d.kind);

// A social artifact's TAB is its kind — what the thing is. `category` is a
// finer label some artifacts carry ("job-description"), used for the group
// heading inside a tab, never as a tab of its own: it held two items and
// stranded every plain image outside the tabbar.
const catOf = (d) => d.kind;
const groupOf = (d) => d.category || d.kind;

// "Behind" sits next to the verify chip because it is the same kind of signal
// asking a different question: verify says "is this deck sound", behind says
// "is this deck current". A COUNT, not a dot, so the size of the job is visible
// without opening anything. Deck Studio 3, SPEC §4.
//
// It never means anything has changed. The published version and its PDF stay
// byte-identical until the update is accepted, which makes a new version.
function behindChip(d) {
  const n = (d.behind || []).length;
  if (!n) return "";
  const what = d.behind.map((b) => b.slide_id).join(", ");
  return `<span class="behind-chip" title="Newer in the library: ${esc(what)}. `
    + `Nothing published has changed.">${n} page${n === 1 ? "" : "s"} behind</span>`;
}

// Work left in the builder. Same shape as the behind chip because it answers the
// neighbouring question: behind asks "is this deck current with the library",
// this asks "did I leave something half-done on it".
function draftChip(d) {
  if (!d.has_draft) return "";
  return `<span class="behind-chip behind-chip--draft" title="A recipe is saved in the deck builder. `
    + `Nothing is published until you publish it.">unpublished changes</span>`;
}

const CAT_LABEL = {
  carousel: "Carousels",
  article: "Articles",
  image: "Images",
  post: "Posts",
  "job-description": "Job descriptions",
};

let publishLog = {};

async function ensurePublishLog() {
  try { publishLog = await api.getSocialStatus(); } catch { publishLog = {}; }
  return publishLog;
}

// --- the filter bar, shared by both areas ------------------------------------
//
// Kept in localStorage rather than the URL: it is how you like to look at the
// list, not where you are, so it should survive a reload and not be something
// you can accidentally send someone.
const prefs = {
  get starred() { return localStorage.getItem("oppr.onlyStarred") === "1"; },
  set starred(v) { localStorage.setItem("oppr.onlyStarred", v ? "1" : "0"); },
  get socialView() { return localStorage.getItem("oppr.socialView") === "flat" ? "flat" : "grouped"; },
  set socialView(v) { localStorage.setItem("oppr.socialView", v); },
  // Archived decks are shelved, not deleted, so there has to be a way back to
  // them. Off by default, because the whole point is that they are out of the way.
  get archived() { return localStorage.getItem("oppr.showArchived") === "1"; },
  set archived(v) { localStorage.setItem("oppr.showArchived", v ? "1" : "0"); },
};

let query = "";

// The text filter reads the note too. That is the reason the note exists: a
// deck you can only find by its title is a deck you have to remember the title
// of.
function matches(d) {
  if (d.archived && !prefs.archived) return false;
  if (prefs.starred && !d.starred) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return [d.title, d.slug, d.note, d.type, d.kind, d.audience_label]
    .some((s) => String(s || "").toLowerCase().includes(q));
}

function filterBar(box, rerender, extra = "") {
  const bar = el(`
    <div class="listbar">
      <label class="listbar-search">
        ${icon("search", 15)}
        <input type="search" placeholder="Filter by title or note…" value="${esc(query)}">
      </label>
      <button class="chipbtn ${prefs.starred ? "on" : ""}" data-act="star">
        ${icon("star", 15)}<span>Starred only</span>
      </button>
      ${extra}
      <span class="spacer"></span>
      <span class="listbar-count note"></span>
    </div>`);

  const input = $("input", bar);
  input.addEventListener("input", () => {
    query = input.value.trim();
    rerender({ keepFocus: true });
  });
  $("[data-act='star']", bar).addEventListener("click", () => {
    prefs.starred = !prefs.starred;
    rerender({});
  });
  box.append(bar);
  return bar;
}

// The star filter is remembered across areas, so an empty Social list can be the
// star you set on Decks ten minutes ago. Say which filter is hiding things, and
// hand back the switch that turns it off.
function emptyFilter(total) {
  const box = el(`<div class="empty"><p>Nothing matches.</p>
    <p class="note">${prefs.starred
      ? `<b>Starred only</b> is on${query ? " and the filter is set" : ""}. ${total} here in total.`
      : `Clear the filter to see all ${total}.`}</p>
    ${prefs.starred ? `<button class="ghost" id="unstar">Show everything</button>` : ""}</div>`);
  $("#unstar", box)?.addEventListener("click", () => { prefs.starred = false; go(location.hash.slice(1)); });
  return box;
}

// Re-rendering the list on every keystroke would drop focus out of the search
// box, so the caller re-mounts and this puts the caret back where it was.
function restoreFocus(box) {
  const input = $(".listbar-search input", box);
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

// ---- Decks area -------------------------------------------------------------

export function renderDecks() {
  if (!state.backend.ok) return offlinePanel("Decks");
  const box = el(`<div></div>`);
  const paint = ({ keepFocus } = {}) => {
    box.innerHTML = "";
    // New deck lives here, on the list of decks. It used to be the top of a
    // second page whose only other content was a worse copy of this list.
    box.append(el(`<div class="listactions">
      <a class="btn" href="#/build/new">${ibtn("newfile", "New deck")}</a>
      <span class="tmuted">A new deck publishes as <b>v1</b>. Every later version comes
        from opening a deck and changing its slides.</span>
    </div>`));
    const nArchived = (state.backend.decks || []).filter((d) => d.archived && isDeck(d)).length;
    filterBar(box, paint, nArchived
      ? `<button class="chipbtn ${prefs.archived ? "on" : ""}" data-act="archived"
                 title="Archived decks are shelved, never deleted: every version and PDF survives">
           ${icon("history", 15)}<span>Archived (${nArchived})</span></button>`
      : "");
    $("[data-act='archived']", box)?.addEventListener("click", () => {
      prefs.archived = !prefs.archived;
      paint({});
    });
    decksBody(box);
    if (keepFocus) restoreFocus(box);
  };
  paint({});
  return box;
}

function decksBody(box) {
  const all = (state.backend.decks || []).filter(isDeck);
  if (!all.length) {
    draftSection(box);
    box.append(el(`<div class="empty"><p>No decks published yet.</p>
      <p class="note"><b>New deck</b> composes one from the slide library, or ask Claude to
      make one from your phone (Settings &rarr; Connect Claude). It appears here ready to
      edit and send.</p>
      <div class="empty-actions"><a class="primary" href="#/build/new">New deck</a></div></div>`));
    return;
  }
  const shown = all.filter(matches);
  $(".listbar-count", box).textContent = `${shown.length} of ${all.length}`;
  draftSection(box);
  if (!shown.length) {
    box.append(emptyFilter(all.length));
    return;
  }

  // Two kinds of deck, not three. "Masters" and "Company decks" described how a
  // deck was tagged rather than what it is, and in practice the company decks
  // ARE the masters: one reusable deck per type, and everything else is a copy
  // made for a named customer.
  const company = shown.filter((d) => !isCustomerDeck(d));
  const customer = shown.filter((d) => isCustomerDeck(d));

  // Within company decks: registry order, then starred, then title. The type is
  // the organising fact here, so it leads.
  company.sort((a, b) =>
    typeRank(a.type) - typeRank(b.type) ||
    Number(b.is_master) - Number(a.is_master) ||
    Number(b.starred) - Number(a.starred) ||
    String(a.title).localeCompare(String(b.title)));
  // Within customer decks: by customer, so a customer's decks sit together.
  customer.sort((a, b) =>
    String(a.client_slug || a.audience_label || "").localeCompare(String(b.client_slug || b.audience_label || "")) ||
    Number(b.starred) - Number(a.starred) ||
    String(a.title).localeCompare(String(b.title)));

  section(box, "Company decks", company,
    "One reusable deck per type. These are the ones you copy from.", { byType: true });
  section(box, "Customer decks", customer,
    `Copies made for one named customer, and listed under <a href="#/customers">Customers</a> too.`,
    { byCustomer: true });

  if (!company.length && !customer.length) box.append(emptyFilter(all.length));
}

// ---- Social area ------------------------------------------------------------

export function renderSocial(category) {
  if (!state.backend.ok) return offlinePanel("Social output");
  const box = el(`<div></div>`);
  const paint = ({ keepFocus } = {}) => {
    box.innerHTML = "";
    // The view switch only means anything on All; a single-category tab is
    // already one group, so offering to group it would be a lie.
    const viewSwitch = (!category || category === "all") ? `
      <span class="listbar-sep"></span>
      <div class="segbtn" role="group" aria-label="View">
        <button data-view="grouped" class="${prefs.socialView === "grouped" ? "on" : ""}">${icon("sections", 14)}<span>By type</span></button>
        <button data-view="flat" class="${prefs.socialView === "flat" ? "on" : ""}">${icon("table", 14)}<span>Flat list</span></button>
      </div>` : "";
    const bar = filterBar(box, paint, viewSwitch);
    $$("[data-view]", bar).forEach((b) => b.addEventListener("click", () => {
      prefs.socialView = b.dataset.view;
      paint({});
    }));
    socialBody(box, category);
    if (keepFocus) restoreFocus(box);
  };
  paint({});
  return box;
}

function socialBody(box, category) {
  // A `<slug>-hero` image is a FACET of its article — the visual that ships
  // with the post — not a publication of its own. It renders inside the
  // article's page; listing it here made one LinkedIn post read as two rows
  // with the same copy.
  let all = (state.backend.decks || []).filter(isSocial)
    .filter((d) => d.page_format !== "hero-1200x627");
  if (category && category !== "all") all = all.filter((d) => catOf(d) === category);

  box.append(el(`<p class="note">Everything published to a channel. Social is public by definition:
    an artifact carrying customer-cleared imagery fails verification on purpose.</p>`));

  if (!all.length) {
    box.append(el(`<div class="empty"><p>Nothing here yet.</p>
      <p class="note">Carousels, images and articles are built by an owner, then edited and shipped here.</p></div>`));
    return;
  }

  const shown = all.filter(matches).sort((a, b) => Number(b.starred) - Number(a.starred));
  $(".listbar-count", box).textContent = `${shown.length} of ${all.length}`;
  if (!shown.length) {
    box.append(emptyFilter(all.length));
    return;
  }

  const isAll = !category || category === "all";
  const grouped = isAll && prefs.socialView === "grouped";
  // Inside one kind's tab, sub-groups still earn their heading when there is
  // more than one: that is where "Job descriptions" belongs.
  const subKeys = isAll ? [] : [...new Set(shown.map(groupOf))];

  if (grouped) {
    // Group order follows the tabbar so the two ways of narrowing the same list
    // agree with each other.
    const order = ["carousel", "article", "image", "post"];
    const keys = [...new Set(shown.map(catOf))]
      .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    for (const key of keys) section(box, CAT_LABEL[key] || key, shown.filter((d) => catOf(d) === key));
  } else if (subKeys.length > 1) {
    for (const key of subKeys.sort()) {
      section(box, CAT_LABEL[key] || key, shown.filter((d) => groupOf(d) === key));
    }
  } else {
    for (const d of shown) box.append(artifactRow(d));
  }

  // The publish log is a separate table, so the posted column fills in a beat
  // later rather than holding the whole list back on one extra request.
  ensurePublishLog().then(() => {
    $$(".pub-slot", box).forEach((slot) => paintPosted(slot, publishLog[slot.dataset.slug]));
  });
}

// Decks that exist only in this browser: composed, never published, so they have
// no row in the backend to be listed from. They sit at the top of the deck list
// because that is where you look for a deck you were working on. They used to be
// the one thing the deck builder's own page showed that this page did not, which
// is why that page could go once they moved here.
//
// A local draft is never someone else's: it lives in this browser's storage. If
// you started it somewhere else it is not here, and the deck list below is.
function draftSection(box) {
  const drafts = draftList();
  if (!drafts.length) return;
  box.append(el(`<div class="section-head"><h2>Not published yet</h2>
    <span class="section-count">${drafts.length}</span></div>`));
  box.append(el(`<p class="note">Started in this browser and never published. Nothing else
    can see them until they have a v1.</p>`));

  for (const [id, d] of drafts) {
    const n = (d.order || []).length;
    // The same row shell as a published deck, because it is the same thing at an
    // earlier moment. A second visual language for "a deck you have not finished"
    // is what made the builder's own list feel like a different app.
    const row = el(`
      <div class="deck-row artifact-row">
        <div class="head">
          <span class="star-btn" style="visibility:hidden">${icon("star", 16)}</span>
          <span class="deck-thumb deck-thumb--none">${icon("compose", 16)}</span>
          <div class="row-id">
            <div class="row-title">
              <h3>${esc(decodeEntities(d.title || "Untitled"))}</h3>
              ${d.type ? `<span class="badge">${esc(typeLabel(d.type))}</span>` : ""}
              ${d.client ? `<span class="tags tags--customer">${icon("building", 12)}${esc(d.client)}</span>` : ""}
              <span class="pill-status draft">not published</span>
            </div>
            <div class="row-meta note">
              <span>${n} slide${n === 1 ? "" : "s"} picked</span>
              <span class="dot">&middot;</span>
              <span class="mono">${esc(d.slug || "no filename")}</span>
              <span class="dot">&middot;</span>
              <span>saved ${esc(String(d.saved_at || "").slice(0, 10))}</span>
            </div>
          </div>
          <div class="row-right"><div class="row-actions">
            <a class="ghost sm" href="#/build/draft/${esc(id)}">${ibtn("compose", "Continue")}</a>
            <button class="ghost sm" data-drop title="Discard this draft">${ibtn("trash", "Discard")}</button>
          </div></div>
        </div>
      </div>`);
    $("[data-drop]", row).addEventListener("click", () => {
      dropLocalDraft(id);
      go(location.hash.slice(1) || "/decks");
      row.remove();
    });
    box.append(row);
  }
}

function section(box, title, list, note, { byType = false, byCustomer = false } = {}) {
  if (!list.length) return;
  box.append(el(`<div class="section-head"><h2>${esc(title)}</h2><span class="section-count">${list.length}</span></div>`));
  if (note) box.append(el(`<p class="note">${note}</p>`));

  // A sub-heading whenever the grouping key changes, so the list reads as
  // "one deck per type" rather than as a pile that happens to be sorted.
  let last = null;
  for (const d of list) {
    const key = byType ? (d.type || "") : byCustomer ? (d.client_slug || d.audience_label || "") : null;
    if (key !== null && key !== last) {
      last = key;
      box.append(el(byType
        ? `<div class="type-head"><h3>${esc(typeLabel(d.type))}</h3>
             <span class="note">${esc(typeBlurb(d.type))}</span></div>`
        : `<div class="type-head"><h3>${esc(customerName(d))}</h3>
             ${d.client_slug ? `<a class="note" href="#/customers/${esc(d.client_slug)}">open the customer</a>` : ""}</div>`));
    }
    box.append(artifactRow(d));
  }
}

// The customer a deck was made for, in the words a person would use.
function customerName(d) {
  const slug = d.client_slug || "";
  const c = (state.backend.customers || []).find((x) => x.slug === slug);
  return c?.name || d.audience_label || slug || "No customer set";
}

// ---- the posted column ------------------------------------------------------
//
// One state, one place on every row: an empty grey box until it has gone out,
// a filled green check once it has. It reads down the column, which is the only
// way "what have I not posted yet" is answerable at a glance.
function paintPosted(slot, entry) {
  const posted = entry?.status === "posted";
  const date = posted && entry.posted_date ? entry.posted_date : "";
  slot.classList.toggle("is-posted", posted);
  slot.innerHTML = `
    <button class="postedbox ${posted ? "on" : ""}" title="${posted ? "Posted — click to unmark" : "Not posted — click to mark posted"}">
      ${icon(posted ? "checkboxOn" : "checkbox", 16)}
      <span>${posted ? (date ? `Posted ${esc(date)}` : "Posted") : "Not posted"}</span>
    </button>`;
  $("button", slot).addEventListener("click", async (e) => {
    e.stopPropagation();
    const slug = slot.dataset.slug;
    const now = !posted;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const payload = {
        status: now ? "posted" : "draft",
        posted_date: now ? (entry?.posted_date || new Date().toISOString().slice(0, 10)) : "",
        url: entry?.url || "",
      };
      const r = await api.putSocialStatus(slug, payload);
      publishLog[slug] = r.entry;
      paintPosted(slot, r.entry);
    } catch (err) {
      toast(err.message || "could not update");
      btn.disabled = false;
    }
  });
}

// ---- the row ----------------------------------------------------------------

export function artifactRow(d) {
  // A chip marks an EXCEPTION (2026-08-20). Every artifact that had never been
  // printed wore "not verified yet" and every healthy one wore "verified", so
  // the column was a chip on ~every row: a signal everything carries is
  // wallpaper, and the two rows that genuinely need a look were the hardest to
  // spot. Only fails and warnings get a chip now; "verified" and "not verified
  // yet" are the normal states and say nothing worth the ink.
  const v = summarize(d.verify_report);
  const showVerify = v.tone === "fail" || v.tone === "warn";
  // The type in words, not its slug: "How we work together" is what the deck is;
  // "engagement" is only what the folder is called.
  const kindBadge = isDeck(d) ? esc(typeLabel(d.type)) : esc(groupOf(d));
  const social = isSocial(d);
  const pages = d.page_count
    ? `${d.page_count} ${d.page_count === 1 ? "page" : "pages"}`
    : "no pages counted";
  const when = (d.updated_at_version || d.updated_at || "").slice(0, 10);
  const who = d.updated_by || d.created_by || "";
  // The download an artifact actually ships as: a deck and a carousel are PDFs
  // (a carousel PDF is what LinkedIn takes for a document post), an image is a
  // PNG, and an article is neither -- its long form is copied as text on its
  // own page, and the seven-page print of a reading document is nobody's
  // deliverable.
  const dl = isDeck(d) || d.kind === "carousel" ? "pdf" : d.kind === "image" ? "png" : "";

  const row = el(`
    <div class="deck-row artifact-row ${d.starred ? "is-starred" : ""}">
      <div class="head">
        <button class="star-btn ${d.starred ? "on" : ""}" title="${d.starred ? "Starred — click to remove" : "Star this so it sorts first"}"
                aria-pressed="${d.starred ? "true" : "false"}">${icon("star", 16)}</button>
        ${d.thumb
          ? `<img class="deck-thumb" src="${esc(d.thumb)}" alt="" loading="lazy" title="Page 1">`
          : `<span class="deck-thumb deck-thumb--none">${icon(isDeck(d) ? "monitor" : "cards", 16)}</span>`}
        <div class="row-id">
          <div class="row-title">
            <h3>${esc(decodeEntities(d.title))}</h3>
            ${d.is_master ? `<span class="badge badge--master">MASTER</span>` : ""}
            <span class="badge">${kindBadge}</span>
            ${isDeck(d) && isCustomerDeck(d)
              ? `<span class="tags tags--customer" title="Made for this customer">${icon("building", 12)}${esc(customerName(d))}</span>`
              : ""}
            <span class="tags mono">v${d.current_version_n}</span>
            ${d.archived ? `<span class="pill-status draft">archived</span>` : ""}
            ${d.status === "needs_cli" ? `<span class="pill-status draft" title="${esc(d.needs_cli_reason || "")}">needs CLI</span>` : ""}
            ${showVerify ? `<span class="verify-chip verify-chip--${v.tone}" title="${esc(v.text)}">${esc(v.text)}</span>` : ""}
            ${behindChip(d)}
            ${draftChip(d)}
          </div>
          <div class="row-meta note">
            <span>${esc(pages)}</span>
            <span class="dot">·</span>
            <span>${when ? `updated ${esc(when)}` : "never updated"}${who ? ` by ${esc(who)}` : ""}</span>
          </div>
          <div class="row-note"></div>
        </div>
        <div class="row-right">
          ${social ? `<span class="pub-slot" data-slug="${esc(d.slug)}"><span class="postedbox loading-slot">…</span></span>` : ""}
          <div class="row-actions">
            <button class="ghost sm act-open">${ibtn("preview", "Open")}</button>
            ${social ? `<button class="ghost sm act-post">${ibtn("text", "Post text")}</button>` : ""}
            ${dl === "pdf" ? `<button class="ghost sm act-dl">${ibtn("download", "PDF")}</button>` : ""}
            ${dl === "png" ? `<a class="ghost sm" href="${esc(api.deckPngUrl(d.id, d.current_version_n))}"
                                download onclick="event.stopPropagation()">${ibtn("download", "PNG")}</a>` : ""}
          </div>
        </div>
      </div>
    </div>`);

  // A thumbnail can legitimately be unavailable (a version that was never
  // printed has no PDF to render page 1 from). Swap in the placeholder rather
  // than leaving a broken image in the row.
  const thumbImg = $(".deck-thumb", row);
  if (thumbImg?.tagName === "IMG") {
    thumbImg.addEventListener("error", () => {
      thumbImg.replaceWith(el(`<span class="deck-thumb deck-thumb--none" title="No page image yet — print the PDF to get one">${icon(isDeck(d) ? "monitor" : "cards", 16)}</span>`));
    });
  }

  mountNote(row, d);

  $(".star-btn", row).addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const next = !d.starred;
    // Flip first, reconcile after: a star is a one-bit opinion and should feel
    // instant. A failure puts it back and says so.
    d.starred = next;
    btn.classList.toggle("on", next);
    btn.setAttribute("aria-pressed", String(next));
    row.classList.toggle("is-starred", next);
    try { await api.patchDeck(d.id, { starred: next }); }
    catch (err) {
      d.starred = !next;
      btn.classList.toggle("on", !next);
      row.classList.toggle("is-starred", !next);
      toast(err.message || "could not save the star");
    }
  });

  $(".act-open", row).addEventListener("click", (e) => { e.stopPropagation(); go("/deck/" + d.id); });
  $(".act-post", row)?.addEventListener("click", async (e) => {
    e.stopPropagation();
    openPostEditor(d, d.post_text || "", (text) => { d.post_text = text; });
  });
  // Optional: an article row has no download button at all.
  $(".act-dl", row)?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.disabled = true;
    const was = btn.innerHTML;
    btn.innerHTML = ibtn("refresh", "Printing…");
    try {
      const name = await api.downloadDeckPdf(d.id, d.current_version_n);
      toast(`Downloaded ${name}`);
    } catch (err) {
      if (err.status === 409) {
        toast("Verification failed — open it to see what needs fixing.");
        go("/deck/" + d.id);
      } else toast(err.message || "could not download");
    } finally {
      btn.disabled = false; btn.innerHTML = was;
    }
  });
  row.addEventListener("click", () => go("/deck/" + d.id));
  return row;
}
