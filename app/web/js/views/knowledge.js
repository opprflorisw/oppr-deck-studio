// Knowledge + Config pages: render whitelisted repo docs with the markdown
// renderer. Server endpoints (/api/knowledge) land in Phase 7; the client is
// ready and degrades gracefully until then.

import { $, $$, el, esc } from "../util.js";
import { state } from "../state.js";
import * as api from "../api.js";
import { renderMarkdown } from "../md.js";
import { go } from "../router.js";

function docPage(title, path, backTo) {
  const wrap = el(`
    <div class="doc">
      <div class="detail-head">
        ${backTo ? `<button class="ghost" id="back">&larr; Back</button>` : ""}
        <h1>${esc(title)}</h1>
        <button class="ghost" id="raw" style="margin-left:auto">Raw</button>
      </div>
      <article class="md" id="md"><p class="note">Loading…</p></article>
    </div>`);
  if (backTo) $("#back", wrap).addEventListener("click", () => go(backTo));
  let raw = "";
  api.getKnowledgeFile(path).then((txt) => {
    raw = txt;
    $("#md", wrap).innerHTML = renderMarkdown(txt);
  }).catch(() => { $("#md", wrap).innerHTML = `<p class="note">Could not load ${esc(path)} (needs the Phase 7 server endpoint).</p>`; });
  let showingRaw = false;
  $("#raw", wrap).addEventListener("click", () => {
    showingRaw = !showingRaw;
    $("#md", wrap).innerHTML = showingRaw ? `<pre class="rawmd">${esc(raw)}</pre>` : renderMarkdown(raw);
    $("#raw", wrap).textContent = showingRaw ? "Rendered" : "Raw";
  });
  return wrap;
}

export function renderDesign() {
  const wrap = el(`<div></div>`);
  wrap.append(el(`<div class="subbar"><h1 class="page-title">Design philosophy</h1><a class="ghost" href="#/design-system" style="margin-left:auto">Design system →</a></div>`));
  wrap.append(docPage("From knowledge/design-philosophy.md", "knowledge/design-philosophy.md"));
  wrap.append(el(`<div style="margin-top:22px"></div>`));
  wrap.append(docPage("From brand/BRAND.md", "brand/BRAND.md"));
  return wrap;
}

const BP_TYPES = ["deck", "linkedin-carousel", "linkedin-post", "linkedin-article", "social-image", "youtube-thumbnail"];

export function renderBestPractices() {
  const wrap = el(`
    <div>
      <div class="subbar"><h1 class="page-title">Best practices</h1></div>
      <p class="note">Living docs: platform facts + how Oppr applies them + dated learnings. Updated when we learn something shipping.</p>
      <div class="grid">
        ${BP_TYPES.map((t) => `<div class="card kind-card" data-bp="${esc(t)}"><div class="body"><h3>${esc(t)}</h3><div class="actions"><button class="add-btn">Open</button></div></div></div>`).join("")}
      </div>
    </div>`);
  $$("[data-bp]", wrap).forEach((c) => c.addEventListener("click", () => go("/knowledge/best-practices/" + c.dataset.bp)));
  return wrap;
}

export function renderBestPractice(type) {
  return docPage(type, `knowledge/best-practices/${type}.md`, "/knowledge/best-practices");
}

export function renderRecipes() {
  const wrap = el(`<div><div class="subbar"><h1 class="page-title">Recipes</h1></div></div>`);
  const recipes = state.index.recipes || [];
  if (!recipes.length) { wrap.append(el(`<div class="loading">No recipes.</div>`)); return wrap; }
  for (const r of recipes) wrap.append(docPage(r.type, r.path));
  return wrap;
}

export function renderConfig() {
  const wrap = el(`
    <div>
      <div class="subbar"><h1 class="page-title">⚙ Config</h1></div>
      <p class="note">Read-only browser over the studio's knowledge files. This is "walk the folder without opening the folder".</p>
      <div class="config-layout">
        <div class="config-tree panel" id="tree"><p class="note">Loading…</p></div>
        <article class="md config-doc" id="doc"><p class="note">Pick a file.</p></article>
      </div>
    </div>`);
  api.getKnowledgeTree().then((data) => {
    const files = data.files || [];
    const tree = $("#tree", wrap);
    tree.innerHTML = `<ul class="plain tree-ul">${files.map((f) => `<li data-f="${esc(f)}" class="mono">${esc(f)}</li>`).join("")}</ul>`;
    $$("li[data-f]", tree).forEach((li) => li.addEventListener("click", async () => {
      $$("li[data-f]", tree).forEach((x) => x.classList.remove("sel"));
      li.classList.add("sel");
      const doc = $("#doc", wrap);
      doc.innerHTML = `<p class="note">Loading…</p>`;
      try {
        const txt = await api.getKnowledgeFile(li.dataset.f);
        doc.innerHTML = /\.md$/.test(li.dataset.f) ? renderMarkdown(txt) : `<pre class="rawmd">${esc(txt)}</pre>`;
      } catch { doc.innerHTML = `<p class="note">Could not load.</p>`; }
    }));
  }).catch(() => { $("#tree", wrap).innerHTML = `<p class="note">Config browser needs the Phase 7 server endpoint.</p>`; });
  return wrap;
}
