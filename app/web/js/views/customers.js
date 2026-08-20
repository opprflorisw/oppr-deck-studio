// Customers — the home of the customer-first app (Deck Studio v3). Companies and
// the decks shipped to each come from the BACKEND (state.backend), matched by
// customer_id. Registering a customer inserts a backend row directly; New deck
// opens the builder already bound to them.
//
// The deck rows here are `artifactRow` — the SAME row the Decks page draws
// (2026-08-20). They used to be a local, thinner copy: title, version and two
// buttons, while the Decks page showed the note, the star, the page count, the
// verify chip and the download. That is the disease that killed the deck
// builder's landing page, and it was alive here: which facts you could see
// about a deck depended on which door you came through.

import { $, el, esc, decodeEntities, toast, backdropClose } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { offlinePanel } from "./deck.js";
import { artifactRow } from "./artifacts.js";
import { openRecordSent } from "../recordsent.js";

const customers = () => state.backend.customers || [];
const decksFor = (custId) => (state.backend.decks || []).filter((d) => d.customer_id === custId);

function logoImg(c, cls = "cust-logo") {
  return c.logo_object
    ? `<img class="${cls}" src="/api/customers2/${esc(c.id)}/logo" alt="${esc(c.name)} logo">`
    : `<span class="${cls} cust-logo--none">${esc((c.name || "?").slice(0, 2).toUpperCase())}</span>`;
}

// ---- list -------------------------------------------------------------------
export function renderList() {
  if (!state.backend.ok) return offlinePanel("Customers");
  const list = customers();
  const wrap = el(`
    <div>
      <div class="subbar area-bar">
        <div class="area-title">${icon("building", 20)}<h1 class="page-title">Customers</h1></div>
        <button class="primary" id="new-cust" style="margin-left:auto">${ibtn("add", "New customer")}</button>
      </div>
      <p class="note">Your companies and the decks shipped to each. Register one here, then build its
        deck. The reusable company decks live under <a href="#/decks">Decks</a>.</p>
      <div id="cust-body"></div>
    </div>`);
  $("#new-cust", wrap).addEventListener("click", () => openNewCustomer());
  const body = $("#cust-body", wrap);
  if (!list.length) {
    body.innerHTML = `<div class="empty">
      <p>No customers yet.</p>
      <p class="note">Register one here. Its decks are copies of the company decks in
        <a href="#/decks">Decks</a>, made for them and cleared for their name.</p>
    </div>`;
    return wrap;
  }
  const grid = el(`<div class="cust-grid"></div>`);
  for (const c of list) grid.append(custCard(c));
  body.append(grid);
  return wrap;
}

function custCard(c) {
  const n = decksFor(c.id).length;
  const card = el(`
    <button class="cust-card" data-id="${esc(c.id)}">
      <div class="cust-card-top">${logoImg(c)}</div>
      <div class="cust-card-body">
        <h3>${esc(c.name)}</h3>
        <div class="cust-meta">
          <span class="count-pill ${n ? "" : "zero"}">${n}</span>
          <span class="note">deck${n === 1 ? "" : "s"}</span>
        </div>
      </div>
    </button>`);
  card.addEventListener("click", () => go("/customers/" + encodeURIComponent(c.slug)));
  return card;
}

// ---- detail -----------------------------------------------------------------
export function renderDetail(slug) {
  if (!state.backend.ok) return offlinePanel("Customers");
  const c = customers().find((x) => x.slug === slug);
  if (!c) return el(`<div class="loading">No such customer. <a href="#/customers">Back to customers</a></div>`);
  const list = decksFor(c.id);
  const wrap = el(`
    <div>
      <div class="detail-head">
        <button class="ghost" id="back">${ibtn("prev", "Customers")}</button>
      </div>
      <div class="cust-detail-head">
        ${logoImg(c)}
        <div class="cust-detail-id">
          <h1>${esc(c.name)}</h1>
          <div class="cust-meta"><span class="mono note">${esc(c.slug)}</span></div>
          ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ""}
        </div>
        <button class="ghost" id="add-deck" style="margin-left:auto">${ibtn("add", "New deck")}</button>
      </div>
      <div class="section-head"><h2>Decks</h2><span class="section-count">${list.length}</span></div>
      <div id="cust-decks"></div>
      <div class="section-head"><h2>Sent</h2><span class="section-count" id="sent-count">·</span></div>
      <div id="cust-sends"><p class="note">Loading…</p></div>
    </div>`);
  $("#back", wrap).addEventListener("click", () => go("/customers"));
  // A customer's first deck is built, not staged. This opens the builder's
  // create dialog already bound to this customer, so the deck it publishes is
  // filed here rather than needing a hand-off to the CLI.
  $("#add-deck", wrap).addEventListener("click", () => go("/build/new?for=" + encodeURIComponent(c.slug)));
  const decks = $("#cust-decks", wrap);
  if (!list.length) decks.innerHTML = `<p class="note">No decks yet. <b>New deck</b> opens the builder for ${esc(c.name)} — start from scratch, or from an existing deck and change it.</p>`;
  else for (const d of list) decks.append(customerDeckRow(d, c));
  loadSends(c, wrap);
  return wrap;
}

// The shared artifact row, plus the one action that belongs to this page rather
// than to the deck: recording that it went out. Everything else on the row (the
// star, the note, Open, Download) is the same control as on the Decks page and
// writes to the same place.
function customerDeckRow(d, c) {
  const row = artifactRow(d);
  const sent = el(`<button class="ghost sm act-sent" title="Record that this went out">${
    ibtn("open", "Record sent")}</button>`);
  sent.addEventListener("click", (e) => {
    e.stopPropagation();
    openRecordSent(d, () => go("/customers/" + encodeURIComponent(c.slug)));
  });
  $(".row-actions", row)?.prepend(sent);
  return row;
}

// The sales timeline: what went to this customer, when, and which version they
// hold. Fetched rather than derived from state.backend because a send is an
// event, not a property of the deck row, and there can be many per deck.
async function loadSends(c, wrap) {
  const box = $("#cust-sends", wrap);
  const count = $("#sent-count", wrap);
  let sends = [];
  try {
    ({ sends } = await api.getCustomerSends(c.slug));
  } catch (e) {
    box.innerHTML = `<p class="note">Could not load the send history. ${esc(e.message)}</p>`;
    return;
  }
  count.textContent = sends.length;
  if (!sends.length) {
    box.innerHTML = `<p class="note">Nothing recorded as sent yet. Use <b>Record sent</b> on a deck once it has gone out, so you can tell later which version they are holding.</p>`;
    return;
  }
  box.innerHTML = "";
  for (const s of sends) {
    box.append(el(`
      <div class="deck-row">
        <div class="head">
          <h3>${esc(decodeEntities(s.deck_title))}</h3>
          <span class="tags mono">v${s.version_n}</span>
          ${s.stale ? `<span class="pill-status draft" title="The deck has moved on since this went out">now v${s.current_version_n}</span>` : ""}
          <div class="spacer">
            <span class="note mono">${esc(String(s.sent_at).slice(0, 10))}</span>
          </div>
        </div>
        ${s.recipient || s.note
          ? `<p class="note">${esc(s.recipient || "")}${s.note ? ` — ${esc(s.note)}` : ""}</p>` : ""}
      </div>`));
  }
}

// ---- new customer -----------------------------------------------------------
// A dialog, not a page (2026-08-20). Registering a company is two fields, and a
// new deck — which asks more — has always been a dialog over the list. Two
// grammars for "how does a new thing start" is one more thing to learn for no
// gain, and the dialog is the better half: you never leave the list you were
// looking at.
export function openNewCustomer(onDone) {
  const m = el(`
    <div class="modal">
      <div class="modal-box">
        <header><b>New customer</b>
          <div class="spacer"></div>
          <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
        <div class="modal-body">
          <p class="note">Register the company now. Its decks appear on its page once you build
            one, and its name becomes a clearance a deck can be cleared for.</p>
          <div class="field"><label for="c-name">Company name</label>
            <input id="c-name" type="text" placeholder="Acme Manufacturing" maxlength="120"></div>
          <div class="field"><label for="c-notes">Notes (optional)</label>
            <input id="c-notes" type="text" placeholder="industry, contact" maxlength="500"></div>
          <div class="modal-actions">
            <button class="primary" id="c-save">${ibtn("save", "Add customer")}</button>
          </div>
        </div>
      </div>
    </div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  $("#c-save", m).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const name = $("#c-name", m).value.trim();
    if (!name) { toast("Company name is required."); return; }
    btn.disabled = true;
    try {
      const out = await api.createCustomer2({ name, notes: $("#c-notes", m).value.trim() });
      await loadBackend(api);
      close();
      toast("Customer added.");
      onDone ? onDone(out.customer) : go("/customers/" + encodeURIComponent(out.customer?.slug || ""));
    } catch (err) {
      // Registering a name creates a GATED TERM, and the server refuses one that
      // would newly fail published decks. That refusal names them, so it is
      // shown rather than flattened to "could not save".
      toast(err.message || "could not save");
      btn.disabled = false;
    }
  });

  document.body.append(m);
  setTimeout(() => $("#c-name", m).focus(), 30);
}
