// Deck draft — a clear three-part page:
//   toolbar (switcher + actions) · slide strip (the composition, the focus) ·
//   a collapsible right Intent rail. Handoff is a modal, not an always-on panel.

import { $, $$, el, esc, decodeEntities, slugify, toast, todayISO } from "../util.js";
import { state, saveDraftLocal, setDraft, blankDraft, slideById, slideExceedsClearance } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { renderTray, toggleCompose } from "../compose.js";
import { draftViewer } from "./viewer.js";
import { icon, ibtn } from "../icons.js";

let intentOpen = localStorage.getItem("oppr.intentOpen") !== "false";

export function render() {
  const d = state.draft;
  const newCount = d.slides.filter((s) => s.source === "new").length;
  const warnCount = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;

  const page = el(`
    <div class="draft-page ${intentOpen ? "" : "rail-collapsed"}">
      <div class="draft-toolbar">
        <div class="dt-left">
          <select id="dt-switch" class="dt-switch" title="Switch draft"></select>
          <span class="dt-stats note">${d.slides.length} slides${newCount ? ` · ${newCount} new` : ""}${warnCount ? ` · <span class="warn-text">${warnCount} over clearance</span>` : ""}</span>
        </div>
        <div class="dt-right">
          <button class="ghost" id="dt-preview" ${d.slides.length ? "" : "disabled"}>${ibtn("preview", "Preview")}</button>
          <button class="ghost" id="dt-new">${ibtn("newfile", "New")}</button>
          <button class="primary" id="dt-handoff" ${d.slides.length ? "" : "disabled"}>${ibtn("save", "Hand off")}</button>
          <button class="ghost ${intentOpen ? "on" : ""}" id="dt-intent" title="Show/hide the intent panel">${ibtn("info", "Intent")}</button>
        </div>
      </div>
      <div class="draft-main">
        <div class="draft-strip-col" id="strip-col"></div>
        <aside class="draft-rail" id="rail"></aside>
      </div>
    </div>`);

  $("#strip-col", page).append(stripEl());
  $("#rail", page).append(intentRail());

  $("#dt-preview", page).addEventListener("click", () => { if (d.slides.length) draftViewer(d, d.title || "Draft preview"); });
  $("#dt-new", page).addEventListener("click", () => {
    if (!d.slides.length || confirm("Start a new draft? Save the current one first if you want to keep it.")) { setDraft(blankDraft()); go("/draft"); }
  });
  $("#dt-handoff", page).addEventListener("click", () => { if (d.slides.length) openHandoff(); });
  $("#dt-intent", page).addEventListener("click", () => {
    intentOpen = !intentOpen;
    localStorage.setItem("oppr.intentOpen", intentOpen);
    page.classList.toggle("rail-collapsed", !intentOpen);
    $("#dt-intent", page).classList.toggle("on", intentOpen);
  });

  populateSwitcher($("#dt-switch", page));
  return page;
}

// ---- switcher ---------------------------------------------------------------
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
    if (v === "__new") { if (!state.draft.slides.length || confirm("Start a new draft?")) { setDraft(blankDraft()); go("/draft"); } else sel.value = "__current"; return; }
    try { setDraft(await api.getDraft(v)); go("/draft"); toast("Loaded " + v); } catch { toast("Could not load draft"); }
  };
}

// ---- intent rail ------------------------------------------------------------
function intentRail() {
  const d = state.draft;
  const recipeOpts = ["", ...state.index.recipes.map((r) => r.type)];
  const p = el(`
    <div class="panel rail-panel">
      <h2>Deck intent</h2>
      <div class="field"><label>Working title</label><input id="d-title" value="${esc(d.title)}"></div>
      <div class="field"><label>Type / recipe</label>
        <select id="d-type">${recipeOpts.map((t) => `<option value="${esc(t)}" ${d.type === t ? "selected" : ""}>${esc(t || "— none —")}</option>`).join("")}</select></div>
      <div class="field"><label>Audience</label><input id="d-aud" value="${esc(d.intent.audience)}" placeholder="company, role, what they know"></div>
      <div class="field"><label>Named client (optional)</label><input id="d-client" value="${esc(d.intent.client)}" placeholder="blank for a public deck"></div>
      <div class="field"><label>Language</label>
        <select id="d-lang">${["en", "fr", "de", "nl"].map((l) => `<option ${d.intent.language === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div class="field"><label>Entitlement clearance</label>
        <select id="d-ent">${["public", "named-customer", "mutares-family"].map((e) => `<option value="${e}" ${d.intent.entitlement === e ? "selected" : ""}>${e}</option>`).join("")}</select>
        <span class="hint">Slides above this clearance are flagged.</span></div>
      <div class="field"><label>Goal &amp; emphasis</label><textarea id="d-goal" placeholder="the one action the audience should take">${esc(d.intent.goal)}</textarea></div>
      <div class="field"><label>Presenter (Oppr side)</label><input id="d-pres" value="${esc(d.intent.presenter)}"></div>
      <hr class="soft">
      <div class="field"><label>deck_footer</label><input id="d-foot" value="${esc(d.vars.deck_footer)}"></div>
      <div class="field"><label>cover_meta</label><input id="d-cover" value="${esc(d.vars.cover_meta)}"></div>
    </div>`);
  const bind = (id, fn) => $(id, p).addEventListener("input", (e) => { fn(e.target.value); saveDraftLocal(); });
  bind("#d-title", (v) => (d.title = v));
  bind("#d-type", (v) => (d.type = v));
  bind("#d-aud", (v) => (d.intent.audience = v));
  bind("#d-client", (v) => (d.intent.client = v));
  bind("#d-lang", (v) => (d.intent.language = v));
  $("#d-ent", p).addEventListener("change", (e) => { d.intent.entitlement = e.target.value; saveDraftLocal(); redrawStrip(); renderTray(); });
  bind("#d-goal", (v) => (d.intent.goal = v));
  bind("#d-pres", (v) => (d.intent.presenter = v));
  bind("#d-foot", (v) => (d.vars.deck_footer = v));
  bind("#d-cover", (v) => (d.vars.cover_meta = v));
  return p;
}

// ---- slide strip ------------------------------------------------------------
function redrawStrip() {
  const old = $("#strip-col > .strip-wrap");
  if (old) old.replaceWith(stripEl());
  // refresh toolbar stats
  const stats = $(".dt-stats");
  if (stats) {
    const d = state.draft;
    const nc = d.slides.filter((s) => s.source === "new").length;
    const wc = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;
    stats.innerHTML = `${d.slides.length} slides${nc ? ` · ${nc} new` : ""}${wc ? ` · <span class="warn-text">${wc} over clearance</span>` : ""}`;
  }
}

function stripEl() {
  const box = el(`<div class="strip-wrap"></div>`);
  if (!state.draft.slides.length) {
    box.innerHTML = `<div class="empty-draft">Empty draft. Turn on <b>Compose</b> (top right) and add slides from the Library, or open a deck and choose <b>Start draft</b>.</div>`;
    return box;
  }
  const strip = el(`<div class="strip"></div>`);
  state.draft.slides.forEach((slot, i) => { strip.append(insertRow(i)); strip.append(slotEl(slot, i)); });
  strip.append(insertRow(state.draft.slides.length));
  box.append(strip);
  return box;
}

function insertRow(i) {
  const row = el(`<div class="insert-row"><button>${ibtn("add", "Insert new slide")}</button></div>`);
  $("button", row).addEventListener("click", () => {
    state.draft.slides.splice(i, 0, { source: "new", id: "", role: "", title: "", brief: "" });
    saveDraftLocal(); redrawStrip();
  });
  return row;
}

function slotEl(slot, i) {
  const isNew = slot.source === "new";
  const warn = !isNew && slideExceedsClearance((slideById(slot.id) || {}).entitlement || "public");
  const el_ = el(`<div class="slot ${isNew ? "new" : ""} ${warn ? "warn" : ""}" draggable="true"></div>`);
  if (isNew) {
    el_.innerHTML = `
      <div class="handle" title="drag to reorder">⋮⋮</div>
      <div class="new-thumb">New</div>
      <div class="info">
        <div class="meta-row">
          <input class="new-id mono" placeholder="proposed id (e.g. payback-200-plant)" value="${esc(slot.id)}">
          <select class="new-role">${["", ...state.index.roles].map((r) => `<option ${slot.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        </div>
        <textarea class="brief" placeholder="Describe the new slide: what it shows, the message, any numbers.">${esc(slot.brief || "")}</textarea>
      </div>
      <button class="rm" title="remove">${icon("close", 18)}</button>`;
    $(".new-id", el_).addEventListener("input", (e) => { slot.id = e.target.value; saveDraftLocal(); });
    $(".new-role", el_).addEventListener("change", (e) => { slot.role = e.target.value; saveDraftLocal(); });
    $(".brief", el_).addEventListener("input", (e) => { slot.brief = e.target.value; saveDraftLocal(); });
  } else {
    el_.innerHTML = `
      <div class="handle" title="drag to reorder">⋮⋮</div>
      <div>${slot.thumb ? `<img class="mini" src="/repo/${esc(slot.thumb)}" alt="">` : `<div class="new-thumb">${esc(slot.id)}</div>`}<div class="idx mono">${esc(slot.id)}</div></div>
      <div class="info">
        <div class="title">${esc(decodeEntities(slot.title || slot.id))} ${warn ? `<span class="warn-text">· exceeds clearance</span>` : ""}</div>
        <textarea class="comment" placeholder="Comment: what to change here (blank = reuse as-is).">${esc(slot.comment || "")}</textarea>
      </div>
      <button class="rm" title="remove">${icon("close", 18)}</button>`;
    $(".comment", el_).addEventListener("input", (e) => { slot.comment = e.target.value; saveDraftLocal(); });
  }
  $(".rm", el_).addEventListener("click", () => { state.draft.slides.splice(i, 1); saveDraftLocal(); redrawStrip(); renderTray(); });

  el_.addEventListener("dragstart", (e) => { el_.classList.add("dragging"); e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; });
  el_.addEventListener("dragend", () => el_.classList.remove("dragging"));
  el_.addEventListener("dragover", (e) => { e.preventDefault(); el_.classList.add("over"); });
  el_.addEventListener("dragleave", () => el_.classList.remove("over"));
  el_.addEventListener("drop", (e) => {
    e.preventDefault(); el_.classList.remove("over");
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (from === i || Number.isNaN(from)) return;
    const [m] = state.draft.slides.splice(from, 1);
    state.draft.slides.splice(i, 0, m);
    saveDraftLocal(); redrawStrip();
  });
  return el_;
}

// ---- handoff modal ----------------------------------------------------------
function openHandoff() {
  const d = state.draft;
  const defaultSlug = d.slug || `${todayISO()}_${slugify(d.intent.client || d.title || "draft")}`;
  const newCount = d.slides.filter((s) => s.source === "new").length;
  const warnCount = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;
  const m = el(`
    <div class="modal">
      <div class="box handoff-modal">
        <header><b>Hand off to the CLI</b><div class="spacer"></div><button class="ghost icon-only close">${icon("close")}</button></header>
        <div class="handoff-inner">
          <p class="note">Saves the draft under <span class="mono">decks/drafts/</span>. It does not build — run one line in the Claude CLI, which shows a plan, waits for approval, then assembles + builds + verifies.</p>
          <div class="field inline"><label>Draft slug</label><input id="h-slug" value="${esc(defaultSlug)}"></div>
          <p class="note">${d.slides.length} slides · ${d.slides.length - newCount} reused · ${newCount} new${warnCount ? ` · <span class="warn-text">${warnCount} above clearance</span>` : ""}</p>
          ${warnCount ? `<p class="note warn-text">Some slides exceed the draft's clearance. Raise it in the Intent panel or remove them.</p>` : ""}
          <button class="primary" id="h-save">${ibtn("save", "Save draft to repo")}</button>
          <div id="h-result" style="margin-top:14px"></div>
          <h3 style="margin-top:22px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Existing drafts</h3>
          <ul class="draft-list" id="h-list"><li class="note">Loading…</li></ul>
        </div>
      </div>
    </div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  $("#h-save", m).addEventListener("click", async () => {
    const slug = slugify($("#h-slug", m).value);
    d.slug = slug; saveDraftLocal();
    try {
      const out = await api.putDraft(slug, d);
      $("#h-result", m).innerHTML = `
        <p class="note">Saved to <span class="mono">decks/drafts/${esc(slug)}/draft.json</span>. Run in the CLI:</p>
        <div class="prompt-box"><code>${esc(out.prompt)}</code><button id="h-copy">${ibtn("copy", "Copy")}</button></div>`;
      $("#h-copy", m).addEventListener("click", () => { navigator.clipboard.writeText(out.prompt); toast("Copied."); });
      loadList(m);
      toast("Draft saved.");
    } catch (err) { toast(err.message || "save failed"); }
  });
  loadList(m);
  document.body.append(m);
}

async function loadList(root) {
  const ul = $("#h-list", root);
  try {
    const { drafts } = await api.listDrafts();
    if (!drafts.length) { ul.innerHTML = `<li class="note">No saved drafts yet.</li>`; return; }
    ul.innerHTML = "";
    for (const dr of drafts) {
      const li = el(`<li><span class="grow"><b>${esc(dr.title)}</b> <span class="slug mono">${esc(dr.slug)}</span> · ${dr.slides} slides</span>
        <button class="ghost load">${ibtn("open", "Load")}</button><button class="ghost del">${ibtn("trash", "Delete")}</button></li>`);
      $(".load", li).addEventListener("click", async () => { setDraft(await api.getDraft(dr.slug)); root.remove(); go("/draft"); toast("Loaded " + dr.slug); });
      $(".del", li).addEventListener("click", async () => { if (!confirm(`Delete draft "${dr.slug}"?`)) return; await api.deleteDraft(dr.slug); loadList(root); toast("Deleted."); });
      ul.append(li);
    }
  } catch { ul.innerHTML = `<li class="note">Could not load drafts.</li>`; }
}
