// Output → Masters (Deck Studio v3): the master-tagged decks, plus "Company
// decks" (non-master decks that belong to no customer: teasers, investor
// updates, event one-offs). Customer decks live under Customers only. All read
// from the backend (state.backend).

import { $, el, esc, decodeEntities } from "../util.js";
import { state } from "../state.js";
import { go } from "../router.js";
import { icon } from "../icons.js";
import { offlinePanel } from "./deck.js";

export function renderMasters() {
  if (!state.backend.ok) return offlinePanel("Output");
  const box = el(`<div></div>`);
  const all = state.backend.decks || [];
  const masters = all.filter((d) => d.is_master);
  const company = all.filter((d) => !d.is_master && d.audience_kind !== "customer");

  if (!masters.length && !company.length) {
    box.append(el(`<div class="empty"><p>No decks yet.</p><p class="note">Build one in the CLI and publish it, then it appears here.</p></div>`));
    return box;
  }

  if (masters.length) {
    box.append(el(`<div class="section-head"><h2>Masters</h2><span class="section-count">${masters.length}</span></div>`));
    box.append(el(`<p class="note">The reusable master decks. Personalize one for a customer from its page; customer decks live under <a href="#/customers">Customers</a>.</p>`));
    for (const d of masters) box.append(deckRow(d, true));
  }

  if (company.length) {
    box.append(el(`<div class="section-head"><h2>Company decks</h2><span class="section-count">${company.length}</span></div>`));
    box.append(el(`<p class="note">Decks that are not for a single customer: teasers, investor updates, event one-offs.</p>`));
    for (const d of company) box.append(deckRow(d, false));
  }
  return box;
}

function deckRow(d, isMaster) {
  const row = el(`
    <div class="deck-row">
      <div class="head">
        ${d.thumb ? `<img class="deck-thumb" src="${esc(d.thumb)}" alt="">` : ""}
        <h3>${esc(decodeEntities(d.title))}</h3>
        ${isMaster ? `<span class="badge badge--master">MASTER</span>` : ""}
        <span class="badge">${esc(d.type || "—")}</span>
        <span class="tags mono">v${d.current_version_n}</span>
        ${d.status === "needs_cli" ? `<span class="pill-status draft">needs CLI</span>` : ""}
        <div class="spacer"><button class="ghost icon-only open" title="Open">${icon("open")}</button></div>
      </div>
    </div>`);
  row.querySelector(".open").addEventListener("click", (e) => { e.stopPropagation(); go("/deck/" + d.id); });
  row.addEventListener("click", () => go("/deck/" + d.id));
  return row;
}
