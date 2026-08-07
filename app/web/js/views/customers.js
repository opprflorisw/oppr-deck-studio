// Customers — the home of the customer-first app (Deck Studio v3). Companies and
// the decks shipped to each come from the BACKEND (state.backend), matched by
// customer_id. Registering a customer inserts a backend row directly; building a
// deck for them still goes through the CLI (a brief staged to dump/_app/).

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { offlinePanel } from "./deck.js";

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
      <p class="note">Your companies and the decks shipped to each. Register one here, then build or personalize its deck. Reusable masters and social live under <a href="#/output/masters">Output</a>.</p>
      <div id="cust-body"></div>
    </div>`);
  $("#new-cust", wrap).addEventListener("click", () => go("/customers/new"));
  const body = $("#cust-body", wrap);
  if (!list.length) {
    body.innerHTML = `<div class="empty">
      <p>No customers yet.</p>
      <p class="note">Add one, or personalize a master for a customer from <a href="#/output/masters">Output → Masters</a>.</p>
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
    </div>`);
  $("#back", wrap).addEventListener("click", () => go("/customers"));
  // A customer's first deck is built, not staged. This opens the builder's
  // create dialog already bound to this customer, so the deck it publishes is
  // filed here rather than needing a hand-off to the CLI.
  $("#add-deck", wrap).addEventListener("click", () => go("/build/new?for=" + encodeURIComponent(c.slug)));
  const decks = $("#cust-decks", wrap);
  if (!list.length) decks.innerHTML = `<p class="note">No decks yet. <b>New deck</b> opens the builder for ${esc(c.name)} — start from scratch, or from an existing deck and change it.</p>`;
  else for (const d of list) decks.append(deckRow(d));
  return wrap;
}

function deckRow(d) {
  const row = el(`
    <div class="deck-row">
      <div class="head">
        <h3>${esc(decodeEntities(d.title))}</h3>
        <span class="tags mono">v${d.current_version_n}</span>
        ${d.status === "needs_cli" ? `<span class="pill-status draft">needs CLI</span>` : ""}
        <div class="spacer">
          <button class="ghost icon-only open" title="Open">${icon("open")}</button>
        </div>
      </div>
    </div>`);
  row.querySelector(".open").addEventListener("click", () => go("/deck/" + d.id));
  row.addEventListener("click", (e) => { if (!e.target.closest("button")) go("/deck/" + d.id); });
  return row;
}

// ---- new customer -----------------------------------------------------------
// Registering the company, and nothing else. Building its deck used to be a
// brief staged here for the CLI; the builder does that job now, so a customer's
// New deck goes to `#/build/new?for=<slug>` and this page is one thing again.
export function renderNew() {
  const d = { name: "", notes: "" };
  const wrap = el(`
    <div>
      <div class="detail-head">
        <button class="ghost" id="back">${ibtn("prev", "Customers")}</button>
        <h1>New customer</h1>
      </div>
      <p class="note">Register the company now. Its decks appear here once you build one,
        and its name becomes a clearance a deck can be cleared for.</p>
      <div class="panel" style="max-width:640px">
        <div class="field"><label>Company name</label><input id="c-name" placeholder="Acme Manufacturing"></div>
        <div class="field"><label>Notes (optional)</label><input id="c-notes" placeholder="industry, contact"></div>
        <div class="panel handoff-panel">
          <button class="primary" id="c-save">${ibtn("save", "Add customer")}</button>
        </div>
      </div>
    </div>`);
  $("#back", wrap).addEventListener("click", () => go("/customers"));
  $("#c-name", wrap).addEventListener("input", (e) => (d.name = e.target.value));
  $("#c-notes", wrap).addEventListener("input", (e) => (d.notes = e.target.value));

  $("#c-save", wrap).addEventListener("click", async () => {
    if (!d.name.trim()) { toast("Company name is required."); return; }
    try {
      const out = await api.createCustomer2({ name: d.name.trim(), notes: d.notes });
      await loadBackend(api);
      toast("Customer added.");
      go("/customers/" + encodeURIComponent(out.customer?.slug || ""));
    } catch (err) { toast(err.message || "could not save"); }
  });
  return wrap;
}
