// Boot: load index, wire the shell (sidebar, search, compose, refresh), register
// routes, start the router.

import { $, toast } from "./util.js";
import { ibtn } from "./icons.js";
import * as api from "./api.js";
import { state, loadBackend } from "./state.js";
import { route, setNotFound, startRouter, dispatch, go } from "./router.js";
import { renderSidebar, markActive } from "./sidebar.js";
import { areaById, areaPath } from "./areas.js";
import { renderArea } from "./views/area.js";
import * as slides from "./views/slides.js";
import * as graphics from "./views/graphics.js";
import * as artifacts from "./views/artifacts.js";
import * as customers from "./views/customers.js";
import * as deck from "./views/deck.js";
import * as editor from "./views/editor.js";
import * as knowledge from "./views/knowledge.js";
import * as research from "./views/research.js";
import * as designsystem from "./views/design-system.js";
import * as iconsView from "./views/icons-view.js";

// Which body each area/tab renders. The area frame supplies the title + tabbar.
// (Customers is a home area with no tabs — routed directly, not through here.)
const RENDER = {
  library: {
    slides: () => slides.renderList(),
    graphics: () => graphics.renderList(),
    icons: () => iconsView.render(),
    "design-system": () => designsystem.render(),
  },
  // Tab-less area: the value is the render function itself, not a tab table.
  decks: () => artifacts.renderDecks(),
  social: {
    all: () => artifacts.renderSocial("all"),
    carousel: () => artifacts.renderSocial("carousel"),
    "job-description": () => artifacts.renderSocial("job-description"),
    post: () => artifacts.renderSocial("post"),
  },
  research: {
    brain: () => research.renderBody("brain"),
    runs: () => research.renderBody("runs"),
    posts: () => research.renderBody("posts"),
    performance: () => research.renderBody("performance"),
  },
  knowledge: {
    philosophy: () => knowledge.renderBody("philosophy"),
    "best-practices": (sub) => knowledge.renderBody("best-practices", sub),
    recipes: () => knowledge.renderBody("recipes"),
    config: () => knowledge.renderBody("config"),
  },
};

const areaTab = (id) => areaPath(areaById(id));

const areaRoute = (mount) => (areaId, tabId, sub) => {
  const area = areaById(areaId);
  const table = RENDER[areaId];
  if (!area.tabs) return mount(renderArea(area, null, table, sub)); // table IS the renderer
  const render = table[tabId] || table[area.tabs[0].id];
  const tab = table[tabId] ? tabId : area.tabs[0].id;
  mount(renderArea(area, tab, render, sub));
};

const main = () => $("#main");

function mount(node) {
  const m = main();
  m.innerHTML = "";
  m.append(node);
  markActive();
  m.scrollTop = 0;
}

async function boot() {
  try {
    state.index = await api.getIndex();
  } catch {
    main().innerHTML = `<div class="loading">Could not load the library index. Is the server running?</div>`;
    return;
  }
  // Decks + customers come from the backend; a failure here is non-fatal (the
  // library/social/knowledge areas still work — deck areas show an offline panel).
  await loadBackend(api);

  renderSidebar();

  $("#refresh-btn").innerHTML = ibtn("refresh", "Refresh");
  const composeToggle = $("#compose-toggle");
  if (composeToggle) composeToggle.remove(); // composing moved to the CLI

  $("#refresh-btn").addEventListener("click", async () => {
    toast("Refreshing…");
    await api.refresh();
    state.index = await api.getIndex();
    await loadBackend(api);
    dispatch();
    toast("Refreshed.");
  });
  $("#sidebar-toggle").addEventListener("click", () => {
    document.getElementById("app").classList.toggle("side-collapsed");
  });
  const search = $("#global-search");
  search.addEventListener("input", () => {
    state.filter.q = search.value;
    if (!location.hash.startsWith("#/slides")) go("/slides");
    else dispatch();
  });

  // Routes
  const area = areaRoute(mount);

  // Customers — the home (list + detail + new-customer intake; no tabbar).
  route("/customers", () => mount(customers.renderList()));
  route("/customers/new", () => mount(customers.renderNew()));
  route("/customers/:slug", (slug) => mount(customers.renderDetail(slug)));

  // Deck detail + editor (backend decks; standalone pages, no tabbar).
  route("/deck/:id", (id) => deck.renderDetail(id, mount));
  route("/deck/:id/edit", (id) => editor.render(id, mount));

  // Area pages (title + tabs + body).
  route("/decks", () => area("decks"));            // single page, no tabs
  route("/social/:tab", (tab) => area("social", tab));
  route("/library/:tab", (tab) => area("library", tab));
  route("/research/:tab", (tab) => area("research", tab));
  route("/knowledge/:tab", (tab) => area("knowledge", tab));
  route("/knowledge/best-practices/:type", (t) => area("knowledge", "best-practices", t));
  // Bare area path -> first (or remembered) tab.
  route("/social", () => go(areaTab("social")));
  route("/library", () => go(areaTab("library")));
  route("/research", () => go(areaTab("research")));
  route("/knowledge", () => go(areaTab("knowledge")));

  // Legacy / short routes keep working and render the same area frame.
  route("/slides", () => area("library", "slides"));
  route("/graphics", () => area("library", "graphics"));
  route("/icons", () => area("library", "icons"));
  route("/design-system", () => area("library", "design-system"));
  route("/output/masters", () => go("/decks"));     // Output was split into
  route("/output/social", () => go("/social/all")); // Decks + Social output
  route("/output", () => go("/decks"));
  route("/social-out", () => go("/social/all"));
  route("/config", () => go("/knowledge/config"));

  // Detail / drill-down pages (standalone, no tabbar).
  route("/research/runs/:slug", (slug) => mount(research.renderRun(slug)));
  route("/slides/:id", (id) => mount(slides.renderDetail(id)));
  route("/graphics/:file", (f) => mount(graphics.renderDetail(f)));

  setNotFound(() => go("/customers"));

  // The app → CLI handover. Wherever the app hands you a prompt to run in the
  // CLI, clicking it copies it. The wall between "app changes and ships" and
  // "CLI creates" is real, so crossing it should take one click, not a careful
  // retype of a slug. One delegated listener covers every prompt box there is.
  document.addEventListener("click", async (e) => {
    const box = e.target.closest?.(".prompt-box");
    if (!box) return;
    const code = box.querySelector("code");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent.trim());
      const was = box.dataset.hint;
      box.dataset.hint = "copied";
      setTimeout(() => { box.dataset.hint = was || ""; }, 1400);
    } catch { /* clipboard blocked; the text is still selectable */ }
  });

  window.addEventListener("hashchange", renderSidebar);
  if (!location.hash) location.hash = "/customers";
  startRouter();
}

boot();
