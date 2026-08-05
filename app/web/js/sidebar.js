// The persistent left navigation: one link per area, in named groups. Sub-views
// live as tabs on the area page, not here. Each link opens the area on its
// remembered tab.
//
// Seven equal links read as one undifferentiated list, so nothing told you that
// Accounts is a different kind of destination from Decks. The groups come from
// areas.js (`group`), and the two administrative pages (`foot: true`) are pinned
// to the bottom of the rail with a rule above them, the way a settings drawer
// sits under an app rather than inside its flow.

import { $, $$ } from "./util.js";
import { current } from "./router.js";
import { AREAS, NAV_GROUPS, areaPath } from "./areas.js";
import { icon } from "./icons.js";
import { state } from "./state.js";

// Decks whose current version is behind a library slide. Read at render time,
// not pushed in once: the rail is rebuilt on every navigation, so a value set
// from outside would be wiped by the next route change.
const behindCount = () =>
  (state.backend?.decks || []).filter((d) => (d.behind || []).length).length;

export function renderSidebar() {
  const aside = $("#sidebar");
  const path = current();

  const link = (a) => {
    const active = path === `/${a.id}` || path.startsWith(`/${a.id}/`) || isAlias(a.id, path);
    const hasBadge = (a.tabs || []).some((t) => t.badge);
    return `
      <a href="#${areaPath(a)}" class="side-link ${active ? "active" : ""}" data-area="${a.id}">
        <span class="side-ic">${icon(a.icon, 18)}</span>
        <span class="side-label">${a.title}</span>
        ${hasBadge ? `<span class="side-badge" data-draft-count>0</span>` : ""}
        ${a.id === "decks" && behindCount()
          ? `<span class="side-badge side-badge--behind" data-behind-count
                   title="${behindCount()} deck(s) would differ if rebuilt now">${behindCount()}</span>`
          : ""}
      </a>`;
  };

  const groups = NAV_GROUPS.map((g) => {
    const items = AREAS.filter((a) => !a.foot && a.group === g.id);
    if (!items.length) return "";
    return `<div class="side-group">${g.title}</div>${items.map(link).join("")}`;
  }).join("");

  // Anything without a group still shows, above the named sections, rather than
  // disappearing because someone forgot to label it.
  const loose = AREAS.filter((a) => !a.foot && !a.group).map(link).join("");
  const foot = AREAS.filter((a) => a.foot).map(link).join("");

  aside.innerHTML = `
    <div class="side-brand"><span class="wm">oppr<b>.</b></span><span class="side-app">Deck Studio</span></div>
    <nav class="side-nav">
      <div class="side-main">${loose}${groups}</div>
      <div class="side-foot">${foot}</div>
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
  library: ["/slides", "/graphics", "/icons", "/design-system", "/brand"],
  build: ["/builder"],
  decks: ["/output/masters"],
  social: ["/social-out", "/output/social"],
  knowledge: ["/knowledge"],
  settings: ["/config", "/knowledge/config"],
};
function isAlias(id, path) {
  return (ALIASES[id] || []).some((p) => path === p || path.startsWith(p + "/"));
}
