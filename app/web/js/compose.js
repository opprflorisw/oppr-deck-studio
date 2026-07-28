// Compose mode + the persistent draft tray, with a multi-draft switcher.

import { $, $$, el, esc, decodeEntities, toast } from "./util.js";
import { state, saveDraftLocal, setDraft, blankDraft, slideExceedsClearance, slideById } from "./state.js";
import { go, dispatch } from "./router.js";
import { icon, ibtn } from "./icons.js";
import * as api from "./api.js";

export function toggleCompose(force) {
  state.composeMode = force === undefined ? !state.composeMode : force;
  $("#compose-toggle").classList.toggle("on", state.composeMode);
  $("#compose-toggle").innerHTML = ibtn("compose", state.composeMode ? "Composing" : "Compose");
  document.getElementById("app").classList.toggle("composing", state.composeMode);
  renderTray();
  dispatch();
}

export function renderTray() {
  const tray = $("#tray");
  // The tray is redundant on the deck-draft page (the whole draft is shown there).
  const h = location.hash.replace(/^#/, "");
  const onDraftPage = h.startsWith("/draft") || h.startsWith("/create/drafts");
  if (!state.composeMode || onDraftPage) { tray.hidden = true; tray.innerHTML = ""; return; }
  const d = state.draft;
  const warn = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;
  tray.hidden = false;
  tray.innerHTML = `
    <div class="tray-inner">
      <div class="tray-switch">
        <select id="tray-draft" title="switch draft"><option>${esc(d.title || d.slug || "current draft")}</option></select>
      </div>
      <div class="tray-mini">
        ${d.slides.length ? d.slides.map((s, i) => s.thumb
          ? `<img src="/repo/${esc(s.thumb)}" title="${esc(decodeEntities(s.title || s.id))}" alt="">`
          : `<span class="tray-new" title="new slide">${i + 1}</span>`).join("")
          : `<span class="tmuted">No slides yet — add from the library.</span>`}
      </div>
      <div class="tray-actions">
        ${warn ? `<span class="warn-text">${warn} above clearance</span>` : ""}
        <span class="tray-count"><b data-draft-count>${d.slides.length}</b> slides</span>
        <button class="ghost" id="tray-open">${ibtn("open", "Open draft")}</button>
        <button class="ghost" id="tray-clear">${ibtn("trash", "Clear")}</button>
      </div>
    </div>`;
  $("#tray-open", tray).addEventListener("click", () => go("/draft"));
  $("#tray-clear", tray).addEventListener("click", () => {
    if (!d.slides.length || confirm("Clear the current draft?")) {
      state.draft.slides = [];
      saveDraftLocal(); renderTray(); dispatch();
      toast("Draft cleared.");
    }
  });
  populateSwitcher($("#tray-draft", tray));
}

async function populateSwitcher(sel) {
  let drafts = [];
  try { drafts = (await api.listDrafts()).drafts; } catch {}
  const cur = state.draft.title || state.draft.slug || "current draft";
  sel.innerHTML =
    `<option value="__current">${esc(cur)} (working)</option>` +
    drafts.map((dr) => `<option value="${esc(dr.slug)}">${esc(dr.title)} · ${dr.slides} slides</option>`).join("") +
    `<option value="__new">+ New draft</option>`;
  sel.onchange = async () => {
    const v = sel.value;
    if (v === "__current") return;
    if (v === "__new") {
      if (!state.draft.slides.length || confirm("Start a new draft?")) { setDraft(blankDraft()); renderTray(); dispatch(); }
      else sel.value = "__current";
      return;
    }
    try { setDraft(await api.getDraft(v)); renderTray(); dispatch(); toast("Switched to " + v); }
    catch { toast("Could not load draft"); }
  };
}
