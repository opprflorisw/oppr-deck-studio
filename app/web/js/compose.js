// Compose mode + the persistent draft tray. Enriched in Phase 4.

import { $, el, esc, decodeEntities, toast } from "./util.js";
import { state, saveDraftLocal, slideExceedsClearance, slideById } from "./state.js";
import { go, dispatch } from "./router.js";

export function toggleCompose(force) {
  state.composeMode = force === undefined ? !state.composeMode : force;
  $("#compose-toggle").classList.toggle("on", state.composeMode);
  $("#compose-toggle").textContent = state.composeMode ? "Composing" : "Compose";
  document.getElementById("app").classList.toggle("composing", state.composeMode);
  renderTray();
  dispatch();
}

export function renderTray() {
  const tray = $("#tray");
  if (!state.composeMode) { tray.hidden = true; tray.innerHTML = ""; return; }
  const d = state.draft;
  const warn = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;
  tray.hidden = false;
  tray.innerHTML = `
    <div class="tray-inner">
      <div class="tray-mini">
        ${d.slides.length ? d.slides.map((s, i) => s.thumb
          ? `<img src="/repo/${esc(s.thumb)}" title="${esc(decodeEntities(s.title || s.id))}" alt="">`
          : `<span class="tray-new" title="new slide">${i + 1}</span>`).join("")
          : `<span class="tmuted">No slides yet — add from the library.</span>`}
      </div>
      <div class="tray-actions">
        ${warn ? `<span class="warn-text">${warn} above clearance</span>` : ""}
        <span class="tray-count"><b data-draft-count>${d.slides.length}</b> slides</span>
        <button class="ghost" id="tray-open">Open draft</button>
        <button class="ghost" id="tray-clear">Clear</button>
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
}
