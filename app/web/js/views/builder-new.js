// The create dialog: the facts a deck is STUCK with, asked once.
//
// Slug and client are inherited by every version and are not re-pickable later,
// because a "new version" that could change the client would be a way around the
// entitlement gate rather than a version of the same deck. Asking for them once,
// up front, is honest about that; a live form field implies they are still
// negotiable. Everything you CAN change later (title, footer, cover meta) lives
// behind Deck details in the workspace.
//
// **Clearance is derived, not picked** (2026-08-20). The grid of customer chips
// that used to sit at the bottom of this dialog was a control with no meaning
// for the person using it: `deriveClearance()` on the server recomputes it from
// the client for everyone except an owner, so the chips an editor ticked were
// discarded on the way in. It also asked the wrong question — a deck is cleared
// for the customer it is for, which this dialog already knows. No deck ever
// built has needed anything but `public` plus its own client. So the dialog
// states the clearance as a fact and the picker greys out the same slides the
// gate would have failed on. An owner who genuinely needs a deck cleared for two
// customers passes `allowed_entitlements` in a recipe to `npm run studio -- build`,
// which is still honoured.

import { $, el, esc, toast, slugify, todayISO } from "../util.js";
import { state } from "../state.js";
import { icon } from "../icons.js";
import { DECK_TYPES, typeLabel, typeRank, isCustomerDeck } from "../decktypes.js";

// The clearance slug a customer's material carries. The server computes the same
// string with the same rule (namescope.mjs), so what the picker greys out and
// what the gate enforces cannot drift.
const clearanceFor = (c) => (c ? c.clearance || c.slug : "");

// The name a person would use for a deck row, and what to say about it in the
// "Start from" list. A company deck is best named by its TYPE — the titles are
// near-identical ("Oppr · Operator Intelligence · …") and the type is the part
// that differs. A customer deck is best named by its customer.
function baseLabel(d) {
  const pages = `${d.page_count || "?"} pages`;
  const stop = d.has_recipe ? "" : " — no recipe, cannot be copied";
  if (isCustomerDeck(d)) {
    const c = (state.backend.customers || []).find((x) => x.slug === d.client_slug);
    const who = c?.name || d.audience_label || d.client_slug;
    return `${who} · ${typeLabel(d.type)} (${pages})${stop}`;
  }
  return `${typeLabel(d.type)} (${pages})${stop}`;
}

// Which decks can be the basis of a new one, grouped and ordered exactly as the
// Decks page groups them: company decks in registry order, then customer decks
// by customer. Two lists that claim to show the same decks should not disagree
// about what those decks are called or which order they come in.
//
// Copying a deck copies its RECIPE, so a version published before recipes
// existed is offered but not selectable: saying why is better than hiding it and
// leaving you to wonder where the investor deck went.
function baseOptions() {
  const decks = (state.backend.decks || [])
    .filter((d) => (!d.kind || d.kind === "deck") && !d.archived);
  const opt = (d) =>
    `<option value="${esc(d.id)}" ${d.has_recipe ? "" : "disabled"}>${esc(baseLabel(d))}</option>`;

  const company = decks.filter((d) => !isCustomerDeck(d)).sort((a, b) =>
    typeRank(a.type) - typeRank(b.type) ||
    Number(b.is_master) - Number(a.is_master) ||
    String(a.title).localeCompare(String(b.title)));
  const customer = decks.filter(isCustomerDeck).sort((a, b) =>
    String(a.client_slug || "").localeCompare(String(b.client_slug || "")) ||
    typeRank(a.type) - typeRank(b.type));

  return [
    company.length ? `<optgroup label="Company decks">${company.map(opt).join("")}</optgroup>` : "",
    customer.length ? `<optgroup label="Customer decks">${customer.map(opt).join("")}</optgroup>` : "",
  ].join("");
}

// The type list is the REGISTRY, in the registry's order — not the distinct
// values found on existing rows. Reading it off the rows meant the dropdown
// offered `article`, `carousel` and `image` (types belonging to social output,
// which is not a deck) and `proposal` (one archived deck), alphabetically, so
// the first deck type in the list was whichever one sorted earliest. A deck's
// type says which company deck family it belongs to; the six families are known.
const typeOptions = (sel) => DECK_TYPES
  .map((t) => `<option value="${esc(t.id)}" ${t.id === sel ? "selected" : ""}>${esc(t.label)}</option>`)
  .join("");

/**
 * @param onCreate  called with the deck's fixed facts, plus `base_deck_id` when
 *                  it should start from an existing deck's picks
 * @param opts.forCustomer  the customer row this deck is being made for, from
 *                  the Customers page. Binds the client (and its clearance) up
 *                  front, which is the difference between a deck that lands on
 *                  that customer's page and one that lands nowhere.
 */
export function openNewDeck(onCreate, { forCustomer = null } = {}) {
  const customers = (state.backend.customers || [])
    .slice().sort((a, b) => String(a.name || a.slug).localeCompare(String(b.name || b.slug)));

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

      <div class="field"><label for="n-base">Start from</label>
        <select id="n-base">
          <option value="">An empty deck — pick every slide yourself</option>
          ${baseOptions()}
        </select>
        <p class="note">Copies that deck's slides and order in as a starting point.
          It is a <b>copy</b>: changing it here never touches the deck you copied,
          and this one still publishes as its own <b>v1</b>.</p></div>

      <div class="field"><label for="n-title">Title</label>
        <input id="n-title" type="text" placeholder="Oppr &middot; Management outlook" maxlength="200"
               value="${esc(forCustomer ? `Oppr · Operator Intelligence · ${forCustomer.name}` : "")}"></div>

      <div class="grid2">
        <div class="field"><label for="n-type">Type</label>
          <select id="n-type">${typeOptions(forCustomer ? "customer" : "teaser")}</select>
          <p class="note">Which company deck family it belongs to.</p></div>

        ${forCustomer ? "" : `
        <div class="field"><label for="n-client">Who is it for?</label>
          <select id="n-client">
            <option value="">No named customer — a company deck</option>
            ${customers.map((c) => `<option value="${esc(c.slug)}">${esc(c.name || c.slug)}</option>`).join("")}
          </select>
          <p class="note">A customer deck is filed under them and carries their
            slug in the PDF filename.</p></div>`}
      </div>

      <div class="field"><label for="n-slug">Filename</label>
        <input id="n-slug" type="text" placeholder="${esc(todayISO())}_management-outlook"
               value="${esc(forCustomer ? `${todayISO()}_${forCustomer.slug}` : "")}">
        <p class="note">Its permanent name in the backend, and the middle of the PDF
          filename. It cannot be changed afterwards.</p></div>

      <p class="derived" id="n-derived"></p>

      <div class="modal-actions">
        <button class="primary" id="n-go">Start composing</button>
      </div>
    </div>
  </div></div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });

  // Which customer this deck is for: fixed when the Customers page opened the
  // dialog, chosen here otherwise.
  const chosenCustomer = () => forCustomer
    || customers.find((c) => c.slug === ($("#n-client", m)?.value || "")) || null;

  // The clearance sentence, in place of the grid of chips. It states what the
  // server is going to derive anyway, so there is nothing to get wrong and
  // nothing to explain: a deck carries its own customer's material and public
  // material, and the picker greys out the rest.
  function paintDerived() {
    const c = chosenCustomer();
    const cl = clearanceFor(c);
    $("#n-derived", m).innerHTML = c
      ? `Filed under <b>${esc(c.name || c.slug)}</b>. It may carry <b>${esc(cl)}</b> and
         <b>public</b> material; slides naming any other customer stay greyed out in the
         picker, because a deck that names a customer it is not cleared for is a hard
         verification failure.`
      : `No named customer, so it may carry <b>public</b> material only. Slides naming a
         customer stay greyed out in the picker.`;
  }

  // Derive the filename from the title until it is touched by hand: the common
  // case is a title and a date, and typing it twice is not a decision. A
  // customer deck arrives with `<date>_<customer>` already in the box, which is
  // a better name than anything derived from its title would be. Treat that as
  // chosen, so editing the title does not overwrite it.
  let slugTouched = Boolean(forCustomer);
  $("#n-slug", m).addEventListener("input", () => { slugTouched = true; });
  const syncSlug = () => {
    if (slugTouched) return;
    const c = chosenCustomer();
    const core = c ? c.slug
      : slugify($("#n-title", m).value.replace(/^oppr\s*[·.\-]\s*/i, ""));
    $("#n-slug", m).value = !core || core === "untitled" ? "" : `${todayISO()}_${core}`;
  };
  $("#n-title", m).addEventListener("input", syncSlug);
  $("#n-client", m)?.addEventListener("change", () => { paintDerived(); syncSlug(); });

  // Copying a deck of a type is almost always making a deck of that type, and
  // the type drives which master the workspace offers to reload picks from.
  $("#n-base", m).addEventListener("change", (e) => {
    const d = (state.backend.decks || []).find((x) => x.id === e.target.value);
    if (d?.type && !forCustomer) $("#n-type", m).value = d.type;
  });
  if (suggested) $("#n-base", m).value = suggested.id;
  paintDerived();

  $("#n-go", m).addEventListener("click", () => {
    const title = $("#n-title", m).value.trim();
    const slug = slugify($("#n-slug", m).value.trim());
    if (!title) { toast("Give it a title."); return; }
    if (!slug || slug === "untitled") { toast("Give it a filename."); return; }
    if ((state.backend.decks || []).some((d) => d.slug === slug)) {
      toast("A deck already has that filename. Open it instead, or choose another.");
      return;
    }
    const c = chosenCustomer();
    const cl = clearanceFor(c);
    close();
    onCreate({
      title, slug,
      type: $("#n-type", m).value,
      client: c ? c.slug : "",
      // Exactly what deriveClearance() will compute server-side. Sending it is
      // what lets the picker grey out the right slides before the first build;
      // the server does not take our word for it.
      allowed_entitlements: [...new Set(["public", ...(cl ? [cl] : [])])],
      base_deck_id: $("#n-base", m).value || "",
    });
  });

  document.body.append(m);
  setTimeout(() => $("#n-title", m).focus(), 30);
}
