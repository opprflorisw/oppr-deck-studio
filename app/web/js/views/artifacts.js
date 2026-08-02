// The unified artifact list (Deck Studio 2.0).
//
// Decks and social output used to be two lists over two stores, rendered by two
// view modules with two different action vocabularies — the reason a capability
// could exist for decks and be missing for carousels without anyone noticing.
// Since the artifact model merged, both are rows here, told apart by `kind`.
//
// The action grammar is fixed and identical on every row, in this order:
//     Open · Edit · Download · Status
// Edit is a first-class button, never hidden behind a detail page. That is the
// direct fix for the failure that opened this map: the editor existed for
// months and was never found.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { offlinePanel } from "./deck.js";
import { summarize } from "../verify.js";

const SOCIAL_KINDS = new Set(["carousel", "image", "article", "post"]);

const isDeck = (d) => !d.kind || d.kind === "deck";
const isSocial = (d) => SOCIAL_KINDS.has(d.kind);

let publishLog = {};

async function ensurePublishLog() {
  try { publishLog = await api.getSocialStatus(); } catch { publishLog = {}; }
}

// ---- Decks area -------------------------------------------------------------

export function renderDecks() {
  if (!state.backend.ok) return offlinePanel("Decks");
  const box = el(`<div></div>`);
  const all = (state.backend.decks || []).filter(isDeck);
  const masters = all.filter((d) => d.is_master);
  const company = all.filter((d) => !d.is_master && d.audience_kind !== "customer");
  const customer = all.filter((d) => !d.is_master && d.audience_kind === "customer");

  if (!all.length) {
    box.append(el(`<div class="empty"><p>No decks yet.</p>
      <p class="note">Decks are created in the CLI. Build one, publish it, and it appears here ready to edit.</p>
      <div class="prompt-box"><code>/deckbuilder</code></div></div>`));
    return box;
  }

  section(box, "Masters", masters,
    "The reusable master per deck type. Personalize one for a customer from its page.");
  section(box, "Company decks", company,
    "Decks that belong to no single customer: teasers, investor updates, event one-offs.");
  // Customer decks are listed under Customers, but showing the count here stops
  // them from feeling lost — the previous nav shipped a class of invisible deck.
  if (customer.length) {
    box.append(el(`<div class="section-head"><h2>Customer decks</h2><span class="section-count">${customer.length}</span></div>`));
    box.append(el(`<p class="note">Listed under <a href="#/customers">Customers</a>, with the customer they were made for.</p>`));
    for (const d of customer) box.append(artifactRow(d));
  }
  return box;
}

// ---- Social area ------------------------------------------------------------

export function renderSocial(category) {
  if (!state.backend.ok) return offlinePanel("Social output");
  const box = el(`<div></div>`);
  let list = (state.backend.decks || []).filter(isSocial);
  if (category && category !== "all") {
    list = list.filter((d) => (d.category || d.kind) === category
      || (category === "post" && d.kind === "article"));
  }

  box.append(el(`<p class="note">Everything published to a channel. Social is public by definition:
    an artifact carrying customer-cleared imagery fails verification on purpose.</p>`));

  if (!list.length) {
    box.append(el(`<div class="empty"><p>Nothing here yet.</p>
      <p class="note">Carousels, images and articles are built in the CLI, then edited and shipped here.</p>
      <div class="prompt-box"><code>/deckbuilder</code></div></div>`));
    return box;
  }
  ensurePublishLog().then(() => {
    $$(".pub-slot", box).forEach((slot) => {
      const entry = publishLog[slot.dataset.slug];
      if (entry?.status === "posted") slot.innerHTML = `<span class="pill-status posted">posted</span>`;
      else slot.innerHTML = `<span class="pill-status draft">not posted</span>`;
    });
  });
  for (const d of list) box.append(artifactRow(d));
  return box;
}

function section(box, title, list, note) {
  if (!list.length) return;
  box.append(el(`<div class="section-head"><h2>${esc(title)}</h2><span class="section-count">${list.length}</span></div>`));
  if (note) box.append(el(`<p class="note">${note}</p>`));
  for (const d of list) box.append(artifactRow(d));
}

// ---- the row ----------------------------------------------------------------

export function artifactRow(d) {
  const v = summarize(d.verify_report);
  const kindBadge = isDeck(d) ? esc(d.type || "deck") : esc(d.kind);
  const row = el(`
    <div class="deck-row artifact-row">
      <div class="head">
        ${d.thumb
          ? `<img class="deck-thumb" src="${esc(d.thumb)}" alt="" loading="lazy" title="Page 1">`
          : `<span class="deck-thumb deck-thumb--none">${icon(isDeck(d) ? "monitor" : "cards", 16)}</span>`}
        <h3>${esc(decodeEntities(d.title))}</h3>
        ${d.is_master ? `<span class="badge badge--master">MASTER</span>` : ""}
        <span class="badge">${kindBadge}</span>
        <span class="tags mono">v${d.current_version_n}</span>
        ${isSocial(d) ? `<span class="pub-slot" data-slug="${esc(d.slug)}"></span>` : ""}
        ${d.status === "needs_cli" ? `<span class="pill-status draft" title="${esc(d.needs_cli_reason || "")}">needs CLI</span>` : ""}
        <span class="verify-chip verify-chip--${v.tone}" title="${esc(v.text)}">${esc(v.text)}</span>
        ${d.pdf_current ? "" : `<span class="tags" title="Downloading prints it first, so you always get the current version">PDF not printed</span>`}
        <div class="spacer row-actions">
          <button class="ghost sm act-open">${ibtn("preview", "Open")}</button>
          <button class="ghost sm act-edit">${ibtn("compose", "Edit")}</button>
          <button class="ghost sm act-dl">${ibtn("download", "PDF")}</button>
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

  $(".act-open", row).addEventListener("click", (e) => { e.stopPropagation(); go("/deck/" + d.id); });
  $(".act-edit", row).addEventListener("click", (e) => { e.stopPropagation(); go(`/deck/${d.id}/edit`); });
  $(".act-dl", row).addEventListener("click", async (e) => {
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
