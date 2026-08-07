// The create dialog: the five things a deck needs before you can compose it,
// asked once.
//
// Why a dialog and not a form above the picker: these are the facts a deck is
// STUCK with. Slug, client and clearance are inherited by every version and are
// not re-pickable later, because a "new version" that could widen the clearance
// or change the client would be a way around the entitlement gate rather than a
// version of the same deck. Asking for them once, up front, is honest about
// that; a live form field implies they are still negotiable.
//
// Everything you CAN change later (title, footer, cover meta) is deliberately
// not here. It lives behind Deck details in the workspace.

import { $, el, esc, toast, slugify, todayISO, decodeEntities, ENTITLEMENTS } from "../util.js";
import { state } from "../state.js";
import { icon } from "../icons.js";

// `unclassified` is in the manifest but is not a customer: it marks an image
// nobody has made a disclosability decision about yet. Offering it as a
// clearance would let you grant a deck permission to carry exactly the material
// that is still undecided, so it is never a choice here. A slide that needs it
// stays blocked in the picker until someone classifies the image in
// brand/img/library.json.
const NOT_A_CLEARANCE = new Set(["unclassified"]);

// Clearance slugs a deck can be given: every entitlement present in the image
// manifest, plus every REGISTERED CUSTOMER. The manifest alone was not enough —
// a customer registered today owns no images yet, so their own deck could not be
// cleared for them and the leak gate had no scope to enforce. The server computes
// `clearance` per customer with the same rule verify uses (namescope.mjs), so the
// chip you tick here and the scope the gate enforces are the same string.
function clearanceOptions() {
  const seen = new Set(["public"]);
  for (const im of state.index?.images || []) {
    if (im.entitlement && !NOT_A_CLEARANCE.has(im.entitlement)) seen.add(im.entitlement);
  }
  for (const c of state.backend.customers || []) {
    const cl = c.clearance || c.slug;
    if (cl && !NOT_A_CLEARANCE.has(cl)) seen.add(cl);
  }
  const known = ENTITLEMENTS.filter((e) => seen.has(e));
  return [...known, ...[...seen].filter((e) => !known.includes(e)).sort()];
}

// Which decks can be the basis of a new one. Copying a deck copies its RECIPE,
// so a version published before recipes existed is offered but not selectable:
// saying why is better than hiding it and leaving you to wonder where the
// investor deck went.
function baseOptions() {
  const decks = (state.backend.decks || []).filter((d) => (!d.kind || d.kind === "deck") && !d.archived);
  const label = (d) => `${decodeEntities(d.title)} (${d.page_count || "?"} pages)`
    + (d.has_recipe ? "" : " — no recipe, cannot be copied");
  const opt = (d) => `<option value="${esc(d.id)}" ${d.has_recipe ? "" : "disabled"}>${esc(label(d))}</option>`;
  const masters = decks.filter((d) => d.is_master);
  const rest = decks.filter((d) => !d.is_master);
  return [
    masters.length ? `<optgroup label="Company decks">${masters.map(opt).join("")}</optgroup>` : "",
    rest.length ? `<optgroup label="Other decks">${rest.map(opt).join("")}</optgroup>` : "",
  ].join("");
}

/**
 * @param onCreate  called with the deck's fixed facts, plus `base_deck_id` when
 *                  it should start from an existing deck's picks
 * @param opts.forCustomer  the customer row this deck is being made for, from
 *                  the Customers page. Binds the client (and its clearance) up
 *                  front, which is the difference between a deck that lands on
 *                  that customer's page and one that lands nowhere.
 */
export function openNewDeck(onCreate, { forCustomer = null } = {}) {
  const types = [...new Set((state.backend.decks || [])
    .filter((d) => d.type).map((d) => d.type))].sort();
  const customers = (state.backend.customers || []).map((c) => c.slug).sort();
  const forClear = forCustomer ? (forCustomer.clearance || forCustomer.slug) : "";
  // A customer deck is a copy of the generic customer deck by default: that is
  // what the generic one is FOR, and starting a customer from a blank picker is
  // a worse default than starting from the deck you would have copied anyway.
  const suggested = forCustomer
    ? (state.backend.decks || []).find((d) => d.type === "customer" && d.is_master && d.has_recipe)
    : null;

  const m = el(`<div class="modal"><div class="modal-box modal-box--wide">
    <header><b>${icon("compose", 18)} New deck${forCustomer ? ` for ${esc(forCustomer.name)}` : ""}</b>
      <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body">
      <p class="note">A new deck publishes as <b>v1</b>. Later versions come from
        opening it again and changing it, never from this dialog.</p>

      <div class="field"><label for="n-base">Start from</label>
        <select id="n-base">
          <option value="">An empty deck — pick every slide yourself</option>
          ${baseOptions()}
        </select>
        <p class="note">Starting from a deck copies its slides and order into the
          builder as a starting point. It is a <b>copy</b>: changing it here never
          touches the deck you copied, and this one still publishes as its own v1.</p></div>

      <div class="field"><label for="n-title">Title</label>
        <input id="n-title" type="text" placeholder="Oppr &middot; Management outlook" maxlength="200"
               value="${esc(forCustomer ? `Oppr · Operator Intelligence · ${forCustomer.name}` : "")}"></div>

      <div class="field"><label for="n-slug">Slug</label>
        <input id="n-slug" type="text" placeholder="${esc(todayISO())}_management-outlook"
               value="${esc(forCustomer ? `${todayISO()}_${forCustomer.slug}` : "")}">
        <p class="note">Its permanent name in the backend, and the middle of the PDF
          filename. It cannot be changed afterwards.</p></div>

      <div class="grid2">
        <div class="field"><label for="n-type">Type</label>
          <select id="n-type">
            <option value="">(none)</option>
            ${types.map((t) => `<option ${forCustomer && t === "customer" ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
          <p class="note">Which master family it belongs to.</p></div>

        <div class="field"><label for="n-client">Client</label>
          <select id="n-client" ${forCustomer ? "disabled" : ""}>
            <option value="">(not for a named client)</option>
            ${customers.map((c) => `<option ${forCustomer && c === forCustomer.slug ? "selected" : ""}>${esc(c)}</option>`).join("")}
          </select>
          <p class="note">${forCustomer
            ? `Fixed: this deck is filed under ${esc(forCustomer.name)}.`
            : "Adds the client slug to the PDF filename."}</p></div>
      </div>

      <div class="field"><label>Cleared for</label>
        <div class="chips" id="n-ent">
          ${clearanceOptions().map((e) => `
            <label class="chipbox ${e === "public" ? "is-fixed" : ""}">
              <input type="checkbox" value="${esc(e)}"
                ${e === "public" ? "checked disabled" : e === forClear ? "checked" : ""}>
              <span>${esc(e)}</span>
            </label>`).join("")}
        </div>
        <p class="note">Which customers' material this deck may carry. A deck that
          names a customer it is not cleared for is a hard verify failure, so the
          builder greys those slides out while you pick rather than failing the
          build. <b>public</b> is always included.</p></div>

      <div class="modal-actions">
        <button class="primary" id="n-go">Start composing</button>
      </div>
    </div>
  </div></div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });

  // Derive the slug from the title until the slug is touched by hand: the
  // common case is a title and a date, and typing it twice is not a decision.
  // A customer deck arrives with `<date>_<customer>` already in the box, which
  // is a better slug than anything derived from its title would be. Treat that
  // as chosen, so editing the title does not overwrite it.
  let slugTouched = Boolean(forCustomer);
  $("#n-slug", m).addEventListener("input", () => { slugTouched = true; });
  $("#n-title", m).addEventListener("input", (e) => {
    if (slugTouched) return;
    const core = slugify(e.target.value.replace(/^oppr\s*[·.\-]\s*/i, ""));
    $("#n-slug", m).value = core === "untitled" ? "" : `${todayISO()}_${core}`;
  });
  // Picking a client implies the deck is cleared for that client; anything else
  // and the first customer slide you pick is greyed out for no visible reason.
  const clearFor = (v) => {
    if (!v) return;
    const box = [...m.querySelectorAll("#n-ent input")].find((c) => c.value === v);
    if (box && !box.disabled) box.checked = true;
  };
  $("#n-client", m).addEventListener("change", (e) => clearFor(e.target.value));

  // Copying a deck of a type is almost always making a deck of that type, and
  // the type drives which master the workspace offers to reload picks from.
  $("#n-base", m).addEventListener("change", (e) => {
    const d = (state.backend.decks || []).find((x) => x.id === e.target.value);
    if (d?.type && !$("#n-type", m).value) $("#n-type", m).value = d.type;
  });
  if (suggested) $("#n-base", m).value = suggested.id;

  $("#n-go", m).addEventListener("click", () => {
    const title = $("#n-title", m).value.trim();
    const slug = slugify($("#n-slug", m).value.trim());
    if (!title) { toast("Give it a title."); return; }
    if (!slug || slug === "untitled") { toast("Give it a slug."); return; }
    if ((state.backend.decks || []).some((d) => d.slug === slug)) {
      toast("A deck already has that slug. Open it instead, or choose another.");
      return;
    }
    const allowed = [...m.querySelectorAll("#n-ent input:checked")].map((c) => c.value);
    // A disabled <select> submits nothing, so a customer-bound deck reads its
    // client from the customer rather than from the greyed-out control.
    const client = forCustomer ? forCustomer.slug : $("#n-client", m).value;
    close();
    onCreate({
      title, slug,
      type: $("#n-type", m).value,
      client,
      allowed_entitlements: [...new Set(["public", ...allowed, ...(forClear ? [forClear] : [])])],
      base_deck_id: $("#n-base", m).value || "",
    });
  });

  document.body.append(m);
  setTimeout(() => $("#n-title", m).focus(), 30);
}
