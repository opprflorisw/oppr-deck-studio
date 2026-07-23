// The persistent left navigation.

import { $, $$ } from "./util.js";
import { current } from "./router.js";

const NAV = [
  { group: "Library", items: [
    { path: "/slides", label: "Slides" },
    { path: "/graphics", label: "Graphics" },
    { path: "/design-system", label: "Design system" },
  ]},
  { group: "Create", items: [
    { path: "/draft", label: "Deck drafts", badge: true },
    { path: "/social", label: "Social studio" },
  ]},
  { group: "Output", items: [
    { path: "/decks", label: "Decks" },
    { path: "/social-out", label: "Social output" },
  ]},
  { group: "Knowledge", items: [
    { path: "/knowledge", label: "Knowledge" },
  ]},
];

export function renderSidebar() {
  const aside = $("#sidebar");
  const path = current();
  aside.innerHTML = `
    <div class="side-brand"><span class="wm">oppr<b>.</b></span><span class="side-app">Deck Studio</span></div>
    <nav>
      ${NAV.map((g) => `
        ${g.group ? `<div class="side-group">${g.group}</div>` : `<div class="side-sep"></div>`}
        ${g.items.map((it) => `
          <a href="#${it.path}" class="side-link ${path === it.path || path.startsWith(it.path + "/") ? "active" : ""}" data-path="${it.path}">
            <span>${it.label}</span>
            ${it.badge ? `<span class="side-badge" data-draft-count>0</span>` : ""}
          </a>`).join("")}
      `).join("")}
    </nav>`;
}

export function markActive() {
  const path = current();
  $$(".side-link").forEach((a) => {
    const p = a.dataset.path;
    a.classList.toggle("active", path === p || path.startsWith(p + "/"));
  });
}
