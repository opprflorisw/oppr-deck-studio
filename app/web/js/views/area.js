// The area frame: an icon + title on the left, the area's tabs on the right, and
// the active tab's body below. Every tabbed section (Library / Create / Output /
// Knowledge) renders through this, so they all look and behave the same. The
// active tab is remembered per area, so clicking a sidebar button reopens where
// you left off.

import { $, $$, el, esc } from "../util.js";
import { icon } from "../icons.js";
import { go } from "../router.js";
import { updateDraftCount } from "../state.js";

// area: metadata from areas.js. renderBody(sub) returns the active tab's node.
// An area with no tabs (Decks) renders the same frame minus the tabbar, so a
// single-page area still gets the area title and identical chrome.
export function renderArea(area, activeId, renderBody, sub) {
  const tab = area.tabs ? (area.tabs.find((t) => t.id === activeId) || area.tabs[0]) : null;
  if (tab) localStorage.setItem("oppr.tab." + area.id, tab.id);
  const wrap = el(`
    <div>
      <div class="subbar area-bar">
        <div class="area-title">${icon(area.icon, 20)}<h1 class="page-title">${esc(area.title)}</h1></div>
        ${area.tabs ? `<div class="tabbar area-tabs">
          ${area.tabs.map((t) => `<button data-tab="${t.id}" class="${t.id === tab.id ? "active" : ""}">${t.icon ? icon(t.icon, 15) : ""}<span>${esc(t.label)}</span>${t.badge ? `<span class="tab-badge" data-draft-count>0</span>` : ""}</button>`).join("")}
        </div>` : ""}
        ${area.action ? `<a class="ghost accent area-action" href="${esc(area.action.href)}"
             ${area.action.download ? `download="${esc(area.action.download)}"` : ""}
             title="${esc(area.action.title || "")}">${icon(area.action.icon || "download", 15)}<span>${esc(area.action.label)}</span></a>` : ""}
      </div>
      <div class="area-body"></div>
    </div>`);
  $$("[data-tab]", wrap).forEach((b) => b.addEventListener("click", () => go(`/${area.id}/${b.dataset.tab}`)));
  $(".area-body", wrap).append(renderBody(sub));
  updateDraftCount();
  return wrap;
}
