// Icons: browse the reusable Oppr icon set (library/icons/), preview in the
// brand colours, and copy the {{icon:NAME}} token for use in a slide.

import { $, $$, el, esc, toast } from "../util.js";
import { state } from "../state.js";

const COLORS = [
  { id: "accent", label: "Accent", css: "var(--accent)" },
  { id: "machine", label: "Machine", css: "var(--machine)" },
  { id: "verified", label: "Verified", css: "var(--verified)" },
  { id: "ink", label: "Ink", css: "var(--ink)" },
];
let iColor = localStorage.getItem("oppr.iconColor") || "accent";
let iQ = "";

export function render() {
  const icons = state.index.icons || [];
  const wrap = el(`
    <div>
      <div class="subbar">
        <h1 class="page-title">Icons</h1>
        <div class="filters">
          <input type="search" id="iq" placeholder="Filter…" value="${esc(iQ)}">
          <div class="colorswitch">${COLORS.map((c) => `<button data-color="${c.id}" class="${c.id === iColor ? "active" : ""}" title="${c.label}"><span style="background:${c.css}"></span></button>`).join("")}</div>
        </div>
      </div>
      <p class="note">The reusable line-icon set. Use one in a slide with <span class="mono">{{icon:name}}</span> (the build inlines it); colour it with a brand role. Click an icon to copy its token. See <span class="mono">library/icons/CLAUDE.md</span>.</p>
      <div id="i-body"></div>
    </div>`);
  if (!icons.length) {
    $("#i-body", wrap).innerHTML = `<div class="loading">No icons indexed. Run the build, then Refresh.</div>`;
    return wrap;
  }
  $$("[data-color]", wrap).forEach((b) => b.addEventListener("click", () => {
    iColor = b.dataset.color; localStorage.setItem("oppr.iconColor", iColor);
    $$("[data-color]", wrap).forEach((x) => x.classList.toggle("active", x === b));
    applyColor(wrap);
  }));
  $("#iq", wrap).addEventListener("input", (e) => { iQ = e.target.value; renderBody($("#i-body", wrap)); });
  renderBody($("#i-body", wrap));
  return wrap;
}

function applyColor(wrap) {
  const css = COLORS.find((c) => c.id === iColor).css;
  $$(".iconlib-cell", wrap).forEach((c) => (c.style.color = css));
}

function renderBody(container) {
  const icons = state.index.icons || [];
  const q = iQ.trim().toLowerCase();
  const filtered = icons.filter((ic) => {
    if (!q) return true;
    return (ic.name + " " + ic.category + " " + (ic.keywords || []).join(" ") + " " + (ic.description || "")).toLowerCase().includes(q);
  });
  const css = COLORS.find((c) => c.id === iColor).css;
  container.innerHTML = "";
  const cats = [...new Set(filtered.map((i) => i.category))];
  for (const cat of cats) {
    const inCat = filtered.filter((i) => i.category === cat);
    container.append(el(`<div class="section-head"><h2>${esc(cat)}</h2><span class="section-count">${inCat.length}</span></div>`));
    const grid = el(`<div class="icon-grid">${inCat.map((ic) => `
      <button class="iconlib-cell" data-name="${esc(ic.name)}" title="${esc(ic.description || "")}" style="color:${css}">
        <span class="iconlib-svg">${ic.svg}</span>
        <span class="iconlib-name mono">${esc(ic.name)}</span>
        <span class="iconlib-token mono">{{icon:${esc(ic.name)}}}</span>
      </button>`).join("")}</div>`);
    $$("[data-name]", grid).forEach((b) => b.addEventListener("click", () => {
      navigator.clipboard.writeText(`{{icon:${b.dataset.name}}}`);
      toast(`Copied {{icon:${b.dataset.name}}}`);
    }));
    container.append(grid);
  }
  if (!filtered.length) container.innerHTML = `<div class="loading">No icons match.</div>`;
}
