// Slides: two view modes (cards / table) + a detail page.
//
// There were three. "Cards" and "Sections" rendered the SAME cards from the
// same template; Sections only broke the grid with headings. A toggle whose
// two states differ by whether headings are drawn is not a choice worth
// offering, so Cards is grouped now and the flat one is gone. What is left is a
// real pair: browse it, or read it dense.
//
// Two things left on 2026-08-20. The "+ Add to draft" buttons belonged to
// compose mode, which had been unreachable since the builder replaced it (you
// add a slide to a deck in the builder's rail now). And every detail page ended
// in a "Version history" panel that called an endpoint the server has never
// had, so it only ever printed its own failure message; `git log` answers that
// question for the one person who asks it.

import { $, $$, el, esc, decodeEntities, ENTITLEMENTS } from "../util.js";
import { state, setSlideView, slideById } from "../state.js";
import { go } from "../router.js";
import { previewFrame, fetchFragment } from "../preview.js";
import { downloadPanel } from "../download.js";
import { icon, ibtn } from "../icons.js";

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
        ${[["cards", "Cards"], ["table", "Table"]].map(([v, l]) => `<button data-view="${v}" class="${state.slideView === v ? "active" : ""}">${icon(v, 15)}<span>${l}</span></button>`).join("")}
      </div>
      <div class="filters">
        <input type="search" id="q" placeholder="Filter…" value="${esc(state.filter.q)}">
        <select id="section"><option value="">All sections</option>${sections.map((r) => `<option ${state.filter.section === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <select id="role"><option value="">All roles</option>${roles.map((r) => `<option ${state.filter.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <select id="ent"><option value="">Any clearance</option>${ENTITLEMENTS.map((r) => `<option ${state.filter.entitlement === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
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
  if (state.slideView === "table") container.append(tableView(list));
  else container.append(cardsView(list));
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
      </div>
    </div>`;
}
// Cards, grouped by section, because a library is navigated by meaning before
// it is navigated by name. A slide whose section is not in the index still
// shows, under its own heading, rather than vanishing from the only visual view.
function cardsView(list) {
  const box = el(`<div></div>`);
  const grid = (items) => {
    const g = el(`<div class="grid">${items.map(card).join("")}</div>`);
    $$("[data-open]", g).forEach((c) => c.addEventListener("click", () => go("/slides/" + c.dataset.open)));
    return g;
  };
  const named = new Set();
  for (const sec of state.index.sections) {
    const inSec = list.filter((s) => s.section === sec.name);
    named.add(sec.name);
    if (!inSec.length) continue;
    box.append(el(`<div class="section-head"><h2>${esc(sec.name)}</h2><span class="section-desc">${esc(sec.desc)}</span><span class="section-count">${inSec.length}</span></div>`));
    box.append(grid(inSec));
  }
  const loose = list.filter((s) => !named.has(s.section));
  if (loose.length) {
    box.append(el(`<div class="section-head"><h2>Unsectioned</h2><span class="section-count">${loose.length}</span></div>`));
    box.append(grid(loose));
  }
  // Sections with no slides at all are library GAPS, which is a fact about the
  // library rather than about this filter, so it is measured against the whole
  // index and not against what is on screen.
  const gaps = state.index.sections.filter((sec) => !state.index.slides.some((s) => s.section === sec.name));
  if (gaps.length) box.append(el(`<p class="note" style="margin-top:16px">Empty sections (library gaps): ${gaps.map((g) => esc(g.name)).join(", ")}.</p>`));
  return box;
}

// ---- table ------------------------------------------------------------------
// Which published artifacts use this slide. Sourced from the backend (see
// /api/slide-usage) because decks/ on disk is scratch that gets deleted after a
// publish — reading it used to crash this page once the folders went.
function decksUsing(id) {
  return state.slideUsage?.[id] || [];
}
function tableView(list) {
  const rows = list.map((s) => {
    const decks = decksUsing(s.id);
    const usedCell = decks.length
      ? `<span class="tip"><span class="count-pill">${decks.length}</span><span class="tip-body">${decks.map((d) => esc(d)).join("<br>")}</span></span>`
      : `<span class="count-pill zero">0</span>`;
    return `
      <tr data-open="${esc(s.id)}">
        <td class="tcell-thumb">${s.thumb ? `<img src="/repo/${esc(s.thumb)}" alt="">` : ""}</td>
        <td class="tcell-title"><div class="tt-title">${esc(decodeEntities(s.title))}</div><div class="tt-id mono">${esc(s.id)}</div></td>
        <td>${esc(s.role)}</td>
        <td>${esc(s.section)}</td>
        <td><span class="badge ${esc(s.entitlement)}">${esc(s.entitlement)}</span></td>
        <td class="tcell-num">${usedCell}</td>
        <td class="tcell-num mono">${(s.images || []).length}</td>
        <td class="tcell-num mono">${s.versions ?? "·"}</td>
      </tr>`;
  }).join("");
  const t = el(`
    <div class="table-wrap">
      <table class="slide-table">
        <thead><tr><th></th><th>Title</th><th>Role</th><th>Section</th><th>Clearance</th><th class="tcell-num">Used in</th><th class="tcell-num">Imgs</th><th class="tcell-num">Vers</th></tr></thead>
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
          <div id="dl-panel"></div>
          <div class="panel">
            <h2>Used in</h2>
            ${decks.length ? `<ul class="plain">${decks.map((slug) => {
              // Link to the artifact, not to the list of artifacts. `slideUsage`
              // is keyed by slug (it is derived from published HTML), so the id
              // comes from the backend slice.
              const d = (state.backend.decks || []).find((x) => x.slug === slug);
              return `<li>${d ? `<a href="#/deck/${esc(d.id)}">${esc(decodeEntities(d.title))}</a>`
                              : `<span class="mono">${esc(slug)}</span>`}</li>`;
            }).join("")}</ul>` : `<p class="note">Not used in any deck yet.</p>`}
          </div>
          <div class="panel">
            <h2>Images</h2>
            ${(s.images || []).length ? `<ul class="plain">${s.images.map((im) => { const f = im.replace(/^.*brand\/img\//, ""); return `<li><a href="#/graphics/${encodeURIComponent(f)}">${esc(f)}</a></li>`; }).join("")}</ul>` : `<p class="note">No images.</p>`}
          </div>
        </div>
      </div>
    </div>`);
  wrap.querySelector("#back").addEventListener("click", () => go("/slides"));
  wrap.querySelector("#dl-panel").replaceWith(downloadPanel("slide", id));
  wrap.querySelector("#preview-col").append(previewFrame(fetchFragment(id), 720));
  return wrap;
}
