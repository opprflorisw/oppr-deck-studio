// Graphics repository: browse the described image library with usage
// cross-references (which slides / decks use each graphic), a detail page, and
// (Phase 5) an import flow. Usage is computed from the index client-side.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state } from "../state.js";
import { go } from "../router.js";
import * as api from "../api.js";
import { icon, ibtn } from "../icons.js";

const norm = (p) => String(p).replace(/^.*brand\/img\//, "");

function usageOf(file) {
  // Which library SLIDES use this image. (v3: decks are HTML snapshots in the
  // backend with bundled assets, not slide-id compositions, so deck-level image
  // usage is no longer tracked here.)
  const slides = state.index.slides.filter((s) => (s.images || []).some((im) => norm(im) === file));
  return { slides, decks: [] };
}

let gFilter = { q: "", ent: "", unused: false };
let gView = localStorage.getItem("oppr.gView") || "cards"; // cards | categories | table

const TYPE_ORDER = ["photo", "diagram", "product-screenshot", "logo"];

export function renderList() {
  const wrap = el(`<div></div>`);
  const bar = el(`
    <div class="subbar">
      <div class="viewswitch">
        ${[["cards", "Cards"], ["categories", "Categories"], ["table", "Table"]].map(([v, l]) => `<button data-gview="${v}" class="${gView === v ? "active" : ""}">${icon(v, 15)}<span>${l}</span></button>`).join("")}
      </div>
      <div class="filters">
        <input type="search" id="gq" placeholder="Filter…" value="${esc(gFilter.q)}">
        <select id="gent"><option value="">Any clearance</option>${["public", "named-customer", "mutares-family"].map((r) => `<option ${gFilter.ent === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <label class="chk"><input type="checkbox" id="gun" ${gFilter.unused ? "checked" : ""}> unused only</label>
        <button class="ghost" id="gimport">${ibtn("add", "Import graphics")}</button>
      </div>
    </div>`);
  wrap.append(bar);
  const body = el(`<div id="gbody"></div>`);
  wrap.append(body);
  const upd = () => renderBody(body);
  $$("[data-gview]", bar).forEach((b) => b.addEventListener("click", () => { gView = b.dataset.gview; localStorage.setItem("oppr.gView", gView); go("/graphics"); }));
  $("#gq", wrap).addEventListener("input", (e) => { gFilter.q = e.target.value; upd(); });
  $("#gent", wrap).addEventListener("change", (e) => { gFilter.ent = e.target.value; upd(); });
  $("#gun", wrap).addEventListener("change", (e) => { gFilter.unused = e.target.checked; upd(); });
  $("#gimport", wrap).addEventListener("click", () => openImport());
  renderBody(body);
  return wrap;
}

function filteredImgs() {
  const q = gFilter.q.trim().toLowerCase();
  return state.index.images.filter((im) => {
    if (gFilter.ent && (im.entitlement || "public") !== gFilter.ent) return false;
    if (gFilter.unused && usageOf(im.file).slides.length) return false;
    if (q) {
      const hay = (im.file + " " + (im.description || "") + " " + (im.tags || []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderBody(container) {
  const imgs = filteredImgs();
  container.innerHTML = "";
  if (!imgs.length) { container.innerHTML = `<div class="loading">No graphics match.</div>`; return; }
  if (gView === "cards") container.append(cardsGrid(imgs));
  else if (gView === "categories") container.append(categoriesView(imgs));
  else container.append(tableView(imgs));
}

function wireOpen(root) {
  $$("[data-gopen]", root).forEach((c) => c.addEventListener("click", () => go("/graphics/" + encodeURIComponent(c.dataset.gopen))));
}

function cardsGrid(imgs) {
  const grid = el(`<div class="grid">${imgs.map(gcard).join("")}</div>`);
  wireOpen(grid);
  return grid;
}

function categoriesView(imgs) {
  const box = el(`<div></div>`);
  const types = [...new Set(imgs.map((im) => im.type || "other"))]
    .sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99));
  for (const t of types) {
    const inType = imgs.filter((im) => (im.type || "other") === t);
    box.append(el(`<div class="section-head"><h2>${esc(t)}</h2><span class="section-count">${inType.length}</span></div>`));
    const grid = el(`<div class="grid">${inType.map(gcard).join("")}</div>`);
    wireOpen(grid);
    box.append(grid);
  }
  return box;
}

function tableView(imgs) {
  const rows = imgs.map((im) => {
    const u = usageOf(im.file);
    const usedCell = u.slides.length
      ? `<span class="tip"><span class="count-pill">${u.slides.length}</span><span class="tip-body">${u.slides.map((s) => esc(decodeEntities(s.title))).join("<br>")}</span></span>`
      : `<span class="count-pill zero">0</span>`;
    return `
      <tr data-gopen="${esc(im.file)}">
        <td class="tcell-thumb"><img src="/repo/${esc(im.src)}" alt=""></td>
        <td class="tcell-title"><div class="tt-title">${esc(im.description || im.file)}</div><div class="tt-id mono">${esc(im.file)}</div></td>
        <td>${esc(im.type || "—")}</td>
        <td><span class="badge ${esc(im.entitlement || "public")}">${esc(im.entitlement || "public")}</span></td>
        <td class="tcell-num">${usedCell}</td>
        <td class="tcell-num mono">${u.decks.length}</td>
      </tr>`;
  }).join("");
  const t = el(`
    <div class="table-wrap">
      <table class="slide-table">
        <thead><tr><th></th><th>Description</th><th>Type</th><th>Clearance</th><th class="tcell-num">Slides</th><th class="tcell-num">Decks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
  wireOpen(t);
  return t;
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

// ---- import flow: stage files into dump/_app for /ingest-dump --------------
function openImport() {
  const picked = [];
  const m = el(`
    <div class="modal">
      <div class="box import-box">
        <header><b>Import graphics</b><div class="spacer"></div><button class="ghost close">Close</button></header>
        <div class="import-body">
          <p class="note">Files are staged into <span class="mono">dump/_app/</span>. Run <span class="mono">/ingest-dump</span> in the CLI to describe them and file them into <span class="mono">brand/img/</span> with entitlement. The app never edits the manifest directly.</p>
          <div class="dropzone" id="dz">
            <p>Drop images here, or <label class="link-btn">browse<input type="file" id="fin" accept="image/*" multiple hidden></label></p>
            <ul class="picked" id="picked"></ul>
          </div>
          <div class="field"><label>Note (who / what / suggested tags)</label><textarea id="note" placeholder="e.g. Trade-show floor photos, operator close-ups. Tags: operator, capture."></textarea></div>
          <div class="import-actions">
            <button class="primary" id="do-import" disabled>Import <span id="cnt"></span></button>
            <div id="import-result" class="note"></div>
          </div>
        </div>
      </div>
    </div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });

  const dz = $("#dz", m), fin = $("#fin", m);
  const refresh = () => {
    $("#picked", m).innerHTML = picked.map((f, i) => `<li>${esc(f.name)} <span class="tmuted">${(f.size / 1024 | 0)} KB</span> <button data-rm="${i}">✕</button></li>`).join("");
    $$("[data-rm]", m).forEach((b) => b.addEventListener("click", () => { picked.splice(+b.dataset.rm, 1); refresh(); }));
    $("#do-import", m).disabled = !picked.length;
    $("#cnt", m).textContent = picked.length ? `(${picked.length})` : "";
  };
  const accept = (files) => { for (const f of files) if (f.type.startsWith("image/")) picked.push(f); refresh(); };
  fin.addEventListener("change", () => accept(fin.files));
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("over"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); accept(e.dataTransfer.files); });

  $("#do-import", m).addEventListener("click", async () => {
    $("#do-import", m).disabled = true;
    try {
      const files = await Promise.all(picked.map((f) => new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, data: r.result });
        r.readAsDataURL(f);
      })));
      const out = await api.importGraphics({ note: $("#note", m).value, files });
      $("#import-result", m).innerHTML = `Staged ${out.count} file(s) to <span class="mono">${esc(out.dir)}</span>. Run <span class="mono">/ingest-dump</span> to file them.`;
      toast("Imported to dump/_app.");
    } catch (err) { $("#import-result", m).innerHTML = `<span class="warn-text">${esc(err.message || "import failed")}</span>`; $("#do-import", m).disabled = false; }
  });

  document.body.append(m);
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
