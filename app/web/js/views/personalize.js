// Personalize a master into a derived deck (Deck Studio v3, §6.4). Reads the
// master's current version, lists its data-slot spots as a small form, then
// builds the personalized HTML client-side (setting each slot's text) and posts
// it. The server checks the result is structurally identical to the master and
// files the new deck under the chosen customer / event with lineage recorded.

import { $, $$, el, esc, toast , backdropClose } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";

const SLOT_LABELS = {
  client: "Client name",
  "prepared-for": "Prepared for",
  "cover-meta": "Cover meta line",
  "footer-meta": "Footer meta line",
};

export async function openPersonalize(deck) {
  let html;
  try { html = await api.getDeckVersionHtml(deck.id, deck.current_version_n); }
  catch { toast("Could not load the master."); return; }

  const doc = new DOMParser().parseFromString(html, "text/html");
  // distinct slot -> first current text
  const slots = {};
  for (const node of doc.querySelectorAll("[data-slot]")) {
    const key = node.getAttribute("data-slot");
    if (key === "client-logo") continue; // logo swap is done later in the editor
    if (!(key in slots)) slots[key] = node.textContent.trim();
  }

  const customerOpts = (state.backend.customers || [])
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");

  const m = el(`
    <div class="modal">
      <div class="modal-box">
        <header><b>Personalize ${esc(deck.title)}</b><button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
        <div class="modal-body">
          <div class="field"><label>Audience</label>
            <select id="aud-kind">
              <option value="customer">A customer</option>
              <option value="event">An event</option>
              <option value="person">A person</option>
            </select>
          </div>
          <div class="field" id="cust-field"><label>Customer</label>
            <select id="aud-cust">${customerOpts || `<option value="">(no customers yet)</option>`}</select>
          </div>
          <div class="field" id="label-field" style="display:none"><label>Label</label>
            <input id="aud-label" placeholder="Career fair keynote">
          </div>
          <div class="field"><label>Deck title</label><input id="p-title" value="${esc(deck.title)}"></div>
          <div class="section-head"><h3>Personalization</h3></div>
          <div id="slot-fields"></div>
        </div>
        <footer>
          <button class="ghost close2">Cancel</button>
          <button class="primary" id="create">${ibtn("clone", "Create deck")}</button>
        </footer>
      </div>
    </div>`);

  const slotBox = $("#slot-fields", m);
  if (!Object.keys(slots).length) {
    slotBox.innerHTML = `<p class="note">This master marks no personalization slots. The new deck starts as a copy you can fine-tune in the editor.</p>`;
  }
  const inputs = {};
  for (const [key, val] of Object.entries(slots)) {
    const f = el(`<div class="field"><label>${esc(SLOT_LABELS[key] || key)}</label><input value="${esc(val)}"></div>`);
    inputs[key] = $("input", f);
    slotBox.append(f);
  }

  const kind = $("#aud-kind", m), custField = $("#cust-field", m), labelField = $("#label-field", m);
  const syncAud = () => {
    const isCust = kind.value === "customer";
    custField.style.display = isCust ? "" : "none";
    labelField.style.display = isCust ? "none" : "";
  };
  kind.addEventListener("change", syncAud);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  $(".close2", m).addEventListener("click", close);
  backdropClose(m, close);

  $("#create", m).addEventListener("click", async () => {
    // build personalized html: set each slot's textContent
    for (const node of doc.querySelectorAll("[data-slot]")) {
      const key = node.getAttribute("data-slot");
      if (inputs[key]) node.textContent = inputs[key].value;
    }
    const outHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    const title = $("#p-title", m).value.trim() || deck.title;
    const payload = { html: outHtml, title };
    if (kind.value === "customer") {
      const cid = $("#aud-cust", m).value;
      if (!cid) { toast("Pick a customer or choose another audience."); return; }
      payload.customer_id = cid;
    } else {
      payload.audience = { kind: kind.value, label: $("#aud-label", m).value.trim() || title };
    }
    try {
      const out = await api.personalizeDeck(deck.id, payload);
      await loadBackend(api);
      toast("Deck created.");
      close();
      go("/deck/" + out.deck.id);
    } catch (e) { toast(e.message || "could not create"); }
  });

  document.body.append(m);
  syncAud();
}
