// Decks output: canonicals + frozen variants as filmstrips, preview, clone.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, blankDraft, setDraft, slideById } from "../state.js";
import { go } from "../router.js";
import { toggleCompose } from "../compose.js";
import { assembledViewer } from "./viewer.js";
import { ibtn } from "../icons.js";

export function renderList() {
  const box = el(`<div></div>`);
  box.append(el(`<div class="subbar"><h1 class="page-title">Decks</h1></div>`));
  section(box, "Canonical masters", state.index.decks.canonical);
  section(box, "Frozen variants", state.index.decks.variants);
  if (!state.index.decks.canonical.length && !state.index.decks.variants.length)
    box.append(el(`<div class="loading">No decks yet.</div>`));
  return box;
}

function section(box, label, decks) {
  if (!decks.length) return;
  box.append(el(`<div class="section-head"><h2>${esc(label)}</h2><span class="section-count">${decks.length}</span></div>`));
  for (const d of decks) box.append(deckRow(d));
}

function deckRow(d) {
  const thumbFor = (id) => { const s = slideById(id); return s && s.thumb ? `/repo/${s.thumb}` : ""; };
  const row = el(`
    <div class="deck-row">
      <div class="head">
        <h3>${esc(decodeEntities(d.title))}</h3>
        <span class="badge">${esc(d.type || "—")}</span>
        <span class="tags">${d.slides.length} slides</span>
        <div class="spacer">
          ${d.index ? `<button class="ghost prev">${ibtn("preview", "Preview")}</button>` : ""}
          ${d.pdf ? `<a class="ghost" href="/repo/${esc(d.pdf)}" download>${ibtn("download", "PDF")}</a>` : ""}
          <button class="ghost clone">${ibtn("clone", "Start draft")}</button>
        </div>
      </div>
      <div class="filmstrip">
        ${d.slides.map((id) => `<div class="frame" data-open="${esc(id)}"><img src="${thumbFor(id)}" alt=""><div class="cap">${esc(id)}</div></div>`).join("")}
      </div>
    </div>`);
  if (d.index) $(".prev", row).addEventListener("click", () => assembledViewer(d.index, decodeEntities(d.title), d.pdf));
  $(".clone", row).addEventListener("click", () => cloneToDraft(d));
  $$("[data-open]", row).forEach((f) => f.addEventListener("click", () => go("/slides/" + f.dataset.open)));
  return row;
}

function cloneToDraft(d) {
  if (state.draft.slides.length && !confirm("Replace the current draft with this deck's slides?")) return;
  const draft = blankDraft();
  draft.title = decodeEntities(d.title) + " (variant)";
  draft.type = d.type;
  draft.vars = { ...d.vars };
  const ae = d.allowed_entitlements || ["public"];
  draft.intent.entitlement = ae.includes("mutares-family") ? "mutares-family" : ae.includes("named-customer") ? "named-customer" : "public";
  draft.source_deck = d.path;
  for (const id of d.slides) {
    const s = slideById(id);
    draft.slides.push({ source: "library", id, role: s ? s.role : "", title: s ? s.title : id, thumb: s ? s.thumb : null, comment: "" });
  }
  setDraft(draft);
  toggleCompose(true);
  go("/draft");
  toast("Draft started from " + decodeEntities(d.title));
}
