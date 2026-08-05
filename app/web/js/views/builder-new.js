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

import { $, el, esc, toast, slugify, todayISO, ENTITLEMENTS } from "../util.js";
import { state } from "../state.js";
import { icon } from "../icons.js";

// `unclassified` is in the manifest but is not a customer: it marks an image
// nobody has made a disclosability decision about yet. Offering it as a
// clearance would let you grant a deck permission to carry exactly the material
// that is still undecided, so it is never a choice here. A slide that needs it
// stays blocked in the picker until someone classifies the image in
// brand/img/library.json.
const NOT_A_CLEARANCE = new Set(["unclassified"]);

// Clearance slugs actually present in this repo's image manifest, so a new
// customer needs no code change. util.ENTITLEMENTS is only the fallback order.
function clearanceOptions() {
  const seen = new Set(["public"]);
  for (const im of state.index?.images || []) {
    if (im.entitlement && !NOT_A_CLEARANCE.has(im.entitlement)) seen.add(im.entitlement);
  }
  const known = ENTITLEMENTS.filter((e) => seen.has(e));
  return [...known, ...[...seen].filter((e) => !known.includes(e)).sort()];
}

export function openNewDeck(onCreate) {
  const types = [...new Set((state.backend.decks || [])
    .filter((d) => d.type).map((d) => d.type))].sort();
  const customers = (state.backend.customers || []).map((c) => c.slug).sort();

  const m = el(`<div class="modal"><div class="modal-box modal-box--wide">
    <header><b>${icon("compose", 18)} New deck</b>
      <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body">
      <p class="note">A new deck publishes as <b>v1</b>. Later versions come from
        opening it again and changing it, never from this dialog.</p>

      <div class="field"><label for="n-title">Title</label>
        <input id="n-title" type="text" placeholder="Oppr &middot; Management outlook" maxlength="200"></div>

      <div class="field"><label for="n-slug">Slug</label>
        <input id="n-slug" type="text" placeholder="${esc(todayISO())}_management-outlook">
        <p class="note">Its permanent name in the backend, and the middle of the PDF
          filename. It cannot be changed afterwards.</p></div>

      <div class="grid2">
        <div class="field"><label for="n-type">Type</label>
          <select id="n-type">
            <option value="">(none)</option>
            ${types.map((t) => `<option>${esc(t)}</option>`).join("")}
          </select>
          <p class="note">Which master family it belongs to.</p></div>

        <div class="field"><label for="n-client">Client</label>
          <select id="n-client">
            <option value="">(not for a named client)</option>
            ${customers.map((c) => `<option>${esc(c)}</option>`).join("")}
          </select>
          <p class="note">Adds the client slug to the PDF filename.</p></div>
      </div>

      <div class="field"><label>Cleared for</label>
        <div class="chips" id="n-ent">
          ${clearanceOptions().map((e) => `
            <label class="chipbox ${e === "public" ? "is-fixed" : ""}">
              <input type="checkbox" value="${esc(e)}" ${e === "public" ? "checked disabled" : ""}>
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
  let slugTouched = false;
  $("#n-slug", m).addEventListener("input", () => { slugTouched = true; });
  $("#n-title", m).addEventListener("input", (e) => {
    if (slugTouched) return;
    const core = slugify(e.target.value.replace(/^oppr\s*[·.\-]\s*/i, ""));
    $("#n-slug", m).value = core === "untitled" ? "" : `${todayISO()}_${core}`;
  });
  // Picking a client implies the deck is cleared for that client; anything else
  // and the first customer slide you pick is greyed out for no visible reason.
  $("#n-client", m).addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    const box = [...m.querySelectorAll("#n-ent input")].find((c) => c.value === v);
    if (box && !box.disabled) box.checked = true;
  });

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
    close();
    onCreate({
      title, slug,
      type: $("#n-type", m).value,
      client: $("#n-client", m).value,
      allowed_entitlements: [...new Set(["public", ...allowed])],
    });
  });

  document.body.append(m);
  setTimeout(() => $("#n-title", m).focus(), 30);
}
