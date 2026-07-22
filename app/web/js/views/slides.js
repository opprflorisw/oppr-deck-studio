// Slides: three view modes (cards / sections / table) + a detail page.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, setSlideView, slideById, addSlide, saveDraftLocal } from "../state.js";
import { go } from "../router.js";
import { previewFrame, fetchFragment } from "../preview.js";
import { renderTray } from "../compose.js";
import { historySection } from "./history.js";

function filtered() {
  const q = state.filter.q.trim().toLowerCase();
  return state.index.slides.filter((s) => {
    if (state.filter.role && s.role !== state.filter.role) return false;
    if (state.filter.section && s.section !== state.filter.section) return false;
    if (state.filter.entitlement && s.entitlement !== state.filter.entitlement) return false;
    if (q) {
      const hay = (s.id + " " + decodeEntities(s.title) + " " + (s.tags || []).join(" ") + " " + s.role + " " + s.section).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function addBtn(s) {
  if (!state.composeMode) return "";
  const pos = state.draft.slides.filter((x) => x.source !== "new").findIndex((x) => x.id === s.id);
  return `<button class="add-btn ${pos >= 0 ? "added" : ""}" data-add="${esc(s.id)}">${pos >= 0 ? `In draft #${pos + 1} (add again)` : "+ Add to draft"}</button>`;
}

function wireAdds(root) {
  $$("[data-add]", root).forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      addSlide(b.dataset.add);
      toast("Added to draft");
      renderTray();
      go(location.hash.replace("#", "") || "/slides"); // re-render current
    }));
}

// ---- list shell -------------------------------------------------------------
export function renderList() {
  const wrap = el(`<div></div>`);
  wrap.append(toolbar());
  const body = el(`<div id="slides-body"></div>`);
  wrap.append(body);
  renderBody(body);
  return wrap;
}

function toolbar() {
  const roles = [...new Set(state.index.slides.map((s) => s.role).filter(Boolean))];
  const sections = state.index.sections.map((s) => s.name);
  const bar = el(`
    <div class="subbar">
      <div class="viewswitch">
        ${["cards", "sections", "table"].map((v) => `<button data-view="${v}" class="${state.slideView === v ? "active" : ""}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}
      </div>
      <div class="filters">
        <input type="search" id="q" placeholder="Filter…" value="${esc(state.filter.q)}">
        <select id="section"><option value="">All sections</option>${sections.map((r) => `<option ${state.filter.section === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <select id="role"><option value="">All roles</option>${roles.map((r) => `<option ${state.filter.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <select id="ent"><option value="">Any clearance</option>${["public", "named-customer", "mutares-family"].map((r) => `<option ${state.filter.entitlement === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      </div>
    </div>`);
  $$("[data-view]", bar).forEach((b) => b.addEventListener("click", () => { setSlideView(b.dataset.view); go("/slides"); }));
  const upd = () => renderBody($("#slides-body"));
  $("#q", bar).addEventListener("input", (e) => { state.filter.q = e.target.value; $("#global-search").value = e.target.value; upd(); });
  $("#section", bar).addEventListener("change", (e) => { state.filter.section = e.target.value; upd(); });
  $("#role", bar).addEventListener("change", (e) => { state.filter.role = e.target.value; upd(); });
  $("#ent", bar).addEventListener("change", (e) => { state.filter.entitlement = e.target.value; upd(); });
  return bar;
}

function renderBody(container) {
  container.innerHTML = "";
  const list = filtered();
  if (!list.length) { container.innerHTML = `<div class="loading">No slides match.</div>`; return; }
  if (state.slideView === "cards") container.append(cardsView(list));
  else if (state.slideView === "sections") container.append(sectionsView(list));
  else container.append(tableView(list));
  wireAdds(container);
}

// ---- cards ------------------------------------------------------------------
function card(s) {
  return `
    <div class="card" data-open="${esc(s.id)}">
      <div class="thumb" style="${s.thumb ? `background-image:url('/repo/${esc(s.thumb)}')` : ""}"></div>
      <div class="body">
        <h3>${esc(decodeEntities(s.title))}</h3>
        <div class="meta-row">
          ${s.role ? `<span class="chip">${esc(s.role)}</span>` : ""}
          <span class="badge ${esc(s.entitlement)}">${esc(s.entitlement)}</span>
        </div>
        <div class="tags">${(s.tags || []).slice(0, 5).map(esc).join(" · ")}</div>
        <div class="actions">${addBtn(s)}</div>
      </div>
    </div>`;
}
function cardsView(list) {
  const grid = el(`<div class="grid">${list.map(card).join("")}</div>`);
  $$("[data-open]", grid).forEach((c) => c.addEventListener("click", (e) => {
    if (e.target.closest("[data-add]")) return;
    go("/slides/" + c.dataset.open);
  }));
  return grid;
}

// ---- sections ---------------------------------------------------------------
function sectionsView(list) {
  const box = el(`<div></div>`);
  for (const sec of state.index.sections) {
    const inSec = list.filter((s) => s.section === sec.name);
    if (!inSec.length) continue;
    box.append(el(`<div class="section-head"><h2>${esc(sec.name)}</h2><span class="section-desc">${esc(sec.desc)}</span><span class="section-count">${inSec.length}</span></div>`));
    const grid = el(`<div class="grid">${inSec.map(card).join("")}</div>`);
    $$("[data-open]", grid).forEach((c) => c.addEventListener("click", (e) => { if (e.target.closest("[data-add]")) return; go("/slides/" + c.dataset.open); }));
    box.append(grid);
  }
  // sections with zero slides in the library -> flag as gaps
  const gaps = state.index.sections.filter((sec) => !state.index.slides.some((s) => s.section === sec.name));
  if (gaps.length) box.append(el(`<p class="note" style="margin-top:16px">Empty sections (library gaps): ${gaps.map((g) => esc(g.name)).join(", ")}.</p>`));
  return box;
}

// ---- table ------------------------------------------------------------------
function decksUsing(id) {
  const all = [...state.index.decks.canonical, ...state.index.decks.variants];
  return all.filter((d) => d.slides.includes(id)).map((d) => d.slug);
}
function tableView(list) {
  const rows = list.map((s) => {
    const decks = decksUsing(s.id);
    return `
      <tr data-open="${esc(s.id)}">
        <td class="tcell-thumb">${s.thumb ? `<img src="/repo/${esc(s.thumb)}" alt="">` : ""}</td>
        <td class="mono">${esc(s.id)}</td>
        <td>${esc(decodeEntities(s.title))}</td>
        <td>${esc(s.role)}</td>
        <td>${esc(s.section)}</td>
        <td><span class="badge ${esc(s.entitlement)}">${esc(s.entitlement)}</span></td>
        <td>${decks.map((d) => `<span class="chip sm">${esc(d)}</span>`).join(" ") || "<span class='tmuted'>—</span>"}</td>
        <td class="mono">${(s.images || []).length}</td>
        <td class="mono">${s.versions ?? "·"}</td>
      </tr>`;
  }).join("");
  const t = el(`
    <div class="table-wrap">
      <table class="slide-table">
        <thead><tr><th></th><th>id</th><th>title</th><th>role</th><th>section</th><th>clearance</th><th>used in</th><th>imgs</th><th>vers</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
  $$("[data-open]", t).forEach((r) => r.addEventListener("click", () => go("/slides/" + r.dataset.open)));
  return t;
}

// ---- detail -----------------------------------------------------------------
export function renderDetail(id) {
  const s = slideById(id);
  if (!s) { const d = el(`<div class="loading">No such slide: ${esc(id)}</div>`); return d; }
  const decks = decksUsing(id);
  const wrap = el(`
    <div class="detail">
      <div class="detail-head">
        <button class="ghost" id="back">&larr; Slides</button>
        <h1>${esc(decodeEntities(s.title))}</h1>
        ${state.composeMode ? `<button class="primary" id="add-detail">+ Add to draft</button>` : ""}
      </div>
      <div class="detail-grid">
        <div class="detail-main" id="preview-col"></div>
        <div class="detail-side">
          <div class="panel">
            <h2>Meta</h2>
            <dl class="meta-dl">
              <dt>id</dt><dd class="mono">${esc(s.id)}</dd>
              <dt>role</dt><dd>${esc(s.role || "—")}</dd>
              <dt>section</dt><dd>${esc(s.section)}</dd>
              <dt>clearance</dt><dd><span class="badge ${esc(s.entitlement)}">${esc(s.entitlement)}</span></dd>
              <dt>language</dt><dd>${esc(s.language)}</dd>
              <dt>tags</dt><dd>${(s.tags || []).map((t) => `<span class="chip sm">${esc(t)}</span>`).join(" ")}</dd>
            </dl>
            ${s.notes ? `<p class="note">${esc(s.notes)}</p>` : ""}
          </div>
          <div class="panel">
            <h2>Used in</h2>
            ${decks.length ? `<ul class="plain">${decks.map((d) => `<li><a href="#/decks">${esc(d)}</a></li>`).join("")}</ul>` : `<p class="note">Not used in any deck yet.</p>`}
          </div>
          <div class="panel">
            <h2>Images</h2>
            ${(s.images || []).length ? `<ul class="plain">${s.images.map((im) => { const f = im.replace(/^.*brand\/img\//, ""); return `<li><a href="#/graphics/${encodeURIComponent(f)}">${esc(f)}</a></li>`; }).join("")}</ul>` : `<p class="note">No images.</p>`}
          </div>
        </div>
      </div>
      <div id="history-col"></div>
    </div>`);
  wrap.querySelector("#back").addEventListener("click", () => go("/slides"));
  const addBtnEl = wrap.querySelector("#add-detail");
  if (addBtnEl) addBtnEl.addEventListener("click", () => { addSlide(id); toast("Added to draft"); renderTray(); });
  wrap.querySelector("#preview-col").append(previewFrame(fetchFragment(id), 720));
  wrap.querySelector("#history-col").append(historySection(id));
  return wrap;
}
