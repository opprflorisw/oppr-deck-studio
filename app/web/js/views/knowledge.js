// Knowledge: one page, four tabs — Design philosophy / Best practices / Recipes
// / Config. (Design system stays in the Library.)

import { $, $$, el, esc } from "../util.js";
import { state } from "../state.js";
import * as api from "../api.js";
import { renderMarkdown } from "../md.js";
import { go } from "../router.js";

const TABS = [
  { id: "philosophy", label: "Design philosophy" },
  { id: "best-practices", label: "Best practices" },
  { id: "recipes", label: "Recipes" },
  { id: "config", label: "Config" },
];
const BP_TYPES = ["deck", "linkedin-carousel", "linkedin-post", "linkedin-article", "social-image", "youtube-thumbnail"];

// entry point used by all /knowledge routes
export function renderKnowledge(tab = "philosophy", sub = "") {
  const wrap = el(`
    <div>
      <div class="subbar">
        <h1 class="page-title">Knowledge</h1>
        <div class="tabbar" style="margin-left:auto">
          ${TABS.map((t) => `<button data-tab="${t.id}" class="${t.id === tab ? "active" : ""}">${esc(t.label)}</button>`).join("")}
        </div>
      </div>
      <div id="k-body"></div>
    </div>`);
  $$("[data-tab]", wrap).forEach((b) => b.addEventListener("click", () => go("/knowledge/" + b.dataset.tab)));
  const body = $("#k-body", wrap);
  if (tab === "philosophy") body.append(philosophy());
  else if (tab === "best-practices") body.append(bestPractices(sub));
  else if (tab === "recipes") body.append(recipes());
  else body.append(config());
  return wrap;
}

// renders a markdown doc into a target, with a Raw toggle
function mountDoc(target, path, heading) {
  const box = el(`<div class="doc">${heading ? `<h3 class="doc-h">${esc(heading)}</h3>` : ""}<article class="md"><p class="note">Loading…</p></article></div>`);
  const art = $(".md", box);
  api.getKnowledgeFile(path).then((txt) => { art.innerHTML = renderMarkdown(txt); })
    .catch(() => { art.innerHTML = `<p class="note">Could not load ${esc(path)}.</p>`; });
  target.append(box);
}

function philosophy() {
  const box = el(`<div></div>`);
  mountDoc(box, "knowledge/design-philosophy.md");
  const sep = el(`<div class="doc-sep"><a class="ghost" href="#/design-system">Open the design system</a></div>`);
  box.append(sep);
  mountDoc(box, "brand/BRAND.md", "brand/BRAND.md");
  return box;
}

function bestPractices(sel) {
  const active = BP_TYPES.includes(sel) ? sel : BP_TYPES[0];
  const box = el(`
    <div>
      <div class="pillrow">${BP_TYPES.map((t) => `<button class="pill ${t === active ? "active" : ""}" data-bp="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <div id="bp-doc"></div>
    </div>`);
  $$("[data-bp]", box).forEach((b) => b.addEventListener("click", () => go("/knowledge/best-practices/" + b.dataset.bp)));
  mountDoc($("#bp-doc", box), `knowledge/best-practices/${active}.md`);
  return box;
}

function recipes() {
  const box = el(`<div></div>`);
  const recs = state.index.recipes || [];
  if (!recs.length) { box.innerHTML = `<div class="loading">No recipes.</div>`; return box; }
  for (const r of recs) mountDoc(box, r.path, r.type);
  return box;
}

function config() {
  const box = el(`
    <div>
      <p class="note">Read-only browser over the studio's knowledge files. Walk the folder without opening the folder.</p>
      <div class="config-layout">
        <div class="config-tree panel" id="tree"><p class="note">Loading…</p></div>
        <article class="md config-doc" id="doc"><p class="note">Pick a file.</p></article>
      </div>
    </div>`);
  api.getKnowledgeTree().then((data) => {
    const files = data.files || [];
    const tree = $("#tree", box);
    tree.innerHTML = `<ul class="plain tree-ul">${files.map((f) => `<li data-f="${esc(f)}" class="mono">${esc(f)}</li>`).join("")}</ul>`;
    $$("li[data-f]", tree).forEach((li) => li.addEventListener("click", async () => {
      $$("li[data-f]", tree).forEach((x) => x.classList.remove("sel"));
      li.classList.add("sel");
      const doc = $("#doc", box);
      doc.innerHTML = `<p class="note">Loading…</p>`;
      try {
        const txt = await api.getKnowledgeFile(li.dataset.f);
        doc.innerHTML = /\.md$/.test(li.dataset.f) ? renderMarkdown(txt) : `<pre class="rawmd">${esc(txt)}</pre>`;
      } catch { doc.innerHTML = `<p class="note">Could not load.</p>`; }
    }));
  }).catch(() => { $("#tree", box).innerHTML = `<p class="note">Config browser unavailable.</p>`; });
  return box;
}
