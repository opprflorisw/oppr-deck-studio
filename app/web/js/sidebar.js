// The persistent left navigation: one icon button per area. Sub-views live as
// tabs on the area page, not here. Each button opens the area on its remembered
// tab.

import { $, $$ } from "./util.js";
import { current } from "./router.js";
import { AREAS, areaPath } from "./areas.js";
import { icon } from "./icons.js";

export function renderSidebar() {
  const aside = $("#sidebar");
  const path = current();
  aside.innerHTML = `
    <div class="side-brand"><span class="wm">oppr<b>.</b></span><span class="side-app">Deck Studio</span></div>
    <nav>
      ${AREAS.map((a) => {
        const active = path === `/${a.id}` || path.startsWith(`/${a.id}/`) || isAlias(a.id, path);
        const hasBadge = (a.tabs || []).some((t) => t.badge);
        return `
          <a href="#${areaPath(a)}" class="side-link ${active ? "active" : ""}" data-area="${a.id}">
            <span class="side-ic">${icon(a.icon, 18)}</span>
            <span class="side-label">${a.title}</span>
            ${hasBadge ? `<span class="side-badge" data-draft-count>0</span>` : ""}
          </a>`;
      }).join("")}
    </nav>`;
}

export function markActive() {
  const path = current();
  $$(".side-link").forEach((a) => {
    const id = a.dataset.area;
    a.classList.toggle("active", path === `/${id}` || path.startsWith(`/${id}/`) || isAlias(id, path));
  });
}

// Short/legacy routes (e.g. /slides, /draft) still light up their area button.
const ALIASES = {
  library: ["/slides", "/graphics", "/icons", "/design-system"],
  decks: ["/output/masters"],
  social: ["/social-out", "/output/social"],
  knowledge: ["/knowledge", "/config"],
};
function isAlias(id, path) {
  return (ALIASES[id] || []).some((p) => path === p || path.startsWith(p + "/"));
}
