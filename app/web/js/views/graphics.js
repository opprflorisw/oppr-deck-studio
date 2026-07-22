// Graphics repository: browse the described image library with usage
// cross-references (which slides / decks use each graphic), a detail page, and
// (Phase 5) an import flow. Usage is computed from the index client-side.

import { $, $$, el, esc, decodeEntities } from "../util.js";
import { state } from "../state.js";
import { go } from "../router.js";

const norm = (p) => String(p).replace(/^.*brand\/img\//, "");

function usageOf(file) {
  const slides = state.index.slides.filter((s) => (s.images || []).some((im) => norm(im) === file));
  const slideIds = new Set(slides.map((s) => s.id));
  const decks = [...state.index.decks.canonical, ...state.index.decks.variants]
    .filter((d) => d.slides.some((id) => slideIds.has(id)));
  return { slides, decks };
}

let gFilter = { q: "", ent: "", unused: false };

export function renderList() {
  const wrap = el(`<div></div>`);
  wrap.append(el(`
    <div class="subbar">
      <h1 class="page-title">Graphics</h1>
      <div class="filters">
        <input type="search" id="gq" placeholder="Filter…" value="${esc(gFilter.q)}">
        <select id="gent"><option value="">Any clearance</option>${["public", "named-customer", "mutares-family"].map((r) => `<option ${gFilter.ent === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <label class="chk"><input type="checkbox" id="gun" ${gFilter.unused ? "checked" : ""}> unused only</label>
        <button class="ghost" id="gimport">Import graphics</button>
      </div>
    </div>`));
  const body = el(`<div id="gbody"></div>`);
  wrap.append(body);
  const upd = () => renderGrid(body);
  $("#gq", wrap).addEventListener("input", (e) => { gFilter.q = e.target.value; upd(); });
  $("#gent", wrap).addEventListener("change", (e) => { gFilter.ent = e.target.value; upd(); });
  $("#gun", wrap).addEventListener("change", (e) => { gFilter.unused = e.target.checked; upd(); });
  $("#gimport", wrap).addEventListener("click", () => go("/graphics")); // Phase 5 wires the drop zone
  renderGrid(body);
  return wrap;
}

function renderGrid(container) {
  const q = gFilter.q.trim().toLowerCase();
  const imgs = state.index.images.filter((im) => {
    if (gFilter.ent && (im.entitlement || "public") !== gFilter.ent) return false;
    if (gFilter.unused && usageOf(im.file).slides.length) return false;
    if (q) {
      const hay = (im.file + " " + (im.description || "") + " " + (im.tags || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  container.innerHTML = "";
  if (!imgs.length) { container.innerHTML = `<div class="loading">No graphics match.</div>`; return; }
  const grid = el(`<div class="grid">${imgs.map(gcard).join("")}</div>`);
  $$("[data-gopen]", grid).forEach((c) => c.addEventListener("click", () => go("/graphics/" + encodeURIComponent(c.dataset.gopen))));
  container.append(grid);
}

function gcard(im) {
  const u = usageOf(im.file);
  return `
    <div class="card" data-gopen="${esc(im.file)}">
      <div class="thumb ${im.orientation === "portrait" ? "portrait" : ""}" style="background-image:url('/repo/${esc(im.src)}')"></div>
      <div class="body">
        <h3 style="font-weight:600;font-size:13px">${esc(im.description || im.file)}</h3>
        <div class="meta-row">
          <span class="chip">${esc(im.type || "image")}</span>
          <span class="badge ${esc(im.entitlement || "public")}">${esc(im.entitlement || "public")}</span>
        </div>
        <div class="tags">used in ${u.slides.length} slide(s) · ${u.decks.length} deck(s)</div>
      </div>
    </div>`;
}

export function renderDetail(file) {
  const im = state.index.images.find((x) => x.file === file);
  if (!im) return el(`<div class="loading">No such graphic: ${esc(file)}</div>`);
  const u = usageOf(file);
  const wrap = el(`
    <div class="detail">
      <div class="detail-head">
        <button class="ghost" id="back">&larr; Graphics</button>
        <h1>${esc(im.description || im.file)}</h1>
      </div>
      <div class="detail-grid">
        <div class="detail-main">
          <img class="graphic-hero" src="/repo/${esc(im.src)}" alt="${esc(im.description || "")}">
        </div>
        <div class="detail-side">
          <div class="panel">
            <h2>Manifest</h2>
            <dl class="meta-dl">
              <dt>file</dt><dd class="mono">${esc(im.file)}</dd>
              <dt>type</dt><dd>${esc(im.type || "—")}</dd>
              <dt>orientation</dt><dd>${esc(im.orientation || "—")}</dd>
              <dt>clearance</dt><dd><span class="badge ${esc(im.entitlement || "public")}">${esc(im.entitlement || "public")}</span></dd>
              <dt>tags</dt><dd>${(im.tags || []).map((t) => `<span class="chip sm">${esc(t)}</span>`).join(" ")}</dd>
              ${im.source === "generated" ? `<dt>source</dt><dd>generated${im.generator ? ` · ${esc(im.generator.model || "")}` : ""}</dd>` : ""}
            </dl>
            ${(im.suggested_use || []).length ? `<p class="note"><b>Suggested use:</b> ${im.suggested_use.map(esc).join(" · ")}</p>` : ""}
          </div>
          <div class="panel">
            <h2>Used in slides</h2>
            ${u.slides.length ? `<ul class="plain">${u.slides.map((s) => `<li><a href="#/slides/${encodeURIComponent(s.id)}">${esc(decodeEntities(s.title))}</a></li>`).join("")}</ul>` : `<p class="note">Not used in any slide.</p>`}
          </div>
          <div class="panel">
            <h2>In decks</h2>
            ${u.decks.length ? `<ul class="plain">${u.decks.map((d) => `<li>${esc(d.slug)}</li>`).join("")}</ul>` : `<p class="note">—</p>`}
          </div>
        </div>
      </div>
    </div>`);
  wrap.querySelector("#back").addEventListener("click", () => go("/graphics"));
  return wrap;
}
