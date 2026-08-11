// Boot: load index, wire the shell (sidebar, search, compose, refresh), register
// routes, start the router.

import { $, toast } from "./util.js";
import { ibtn } from "./icons.js";
import * as api from "./api.js";
import { state, loadBackend } from "./state.js";
import { route, setNotFound, startRouter, dispatch, go } from "./router.js";
import { renderSidebar, markActive } from "./sidebar.js";
import { areaById, areaPath } from "./areas.js";
import { requireMember, currentMember, signOut } from "./auth.js";
import { renderArea } from "./views/area.js";
import * as slides from "./views/slides.js";
import * as graphics from "./views/graphics.js";
import * as artifacts from "./views/artifacts.js";
import * as accounts from "./views/accounts.js";
import * as customers from "./views/customers.js";
import * as deck from "./views/deck.js";
import * as editor from "./views/editor.js";
import * as knowledge from "./views/knowledge.js";
import * as settings from "./views/settings.js";
import * as research from "./views/research.js";
import * as designsystem from "./views/design-system.js";
import * as iconsView from "./views/icons-view.js";
import * as brand from "./views/brand.js";
import * as builder from "./views/builder.js";

// Which body each area/tab renders. The area frame supplies the title + tabbar.
// (Customers is a home area with no tabs — routed directly, not through here.)
const RENDER = {
  library: {
    slides: () => slides.renderList(),
    graphics: () => graphics.renderList(),
    icons: () => iconsView.render(),
    "design-system": () => designsystem.render(),
    brand: () => brand.render(),
  },
  // Tab-less area: the value is the render function itself, not a tab table.
  decks: () => artifacts.renderDecks(),
  // builder is routed directly (it mounts itself and loads async), not through
  // the area frame, so it has no entry here.
  accounts: () => accounts.render(),
  settings: {
    connect: () => settings.renderBody("connect"),
    files: () => settings.renderBody("files"),
  },
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
  // Nothing renders until we know who this is. The server refuses every /api
  // call without a member anyway; this is what turns that refusal into a sign-in
  // screen instead of a wall of failed requests.
  const member = await requireMember(document.getElementById("app"));
  if (!member) return;

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

  // Who you are signed in as, and the way out.
  const who = document.createElement("div");
  who.className = "whoami";
  who.innerHTML = `<a class="ghost sm" href="#/accounts" title="Accounts">
      <span class="avatar sm">${(member.full_name || member.email)[0].toUpperCase()}</span>
      <span>${member.email}</span><span class="badge">${member.role}</span></a>
    <button class="ghost sm" id="signout">Sign out</button>`;
  document.querySelector(".topstrip-right")?.prepend(who);
  document.getElementById("signout")?.addEventListener("click", signOut);
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
  // The builder is a workspace bound to a DECK, so the deck is in the route.
  // That is what makes "a version can only come from an existing deck" a
  // structural fact rather than a dropdown someone can misuse.
  route("/build", () => builder.renderChooser(mount));
  route("/build/new", () => builder.renderNew(mount));      // before /build/:id
  route("/build/draft/:id", (id) => builder.renderWorkspace(mount, { localId: id }));
  route("/build/:id", (id) => builder.renderWorkspace(mount, { deckId: id }));
  route("/builder", () => go("/build"));           // the old single-page builder
  route("/accounts", () => area("accounts"));
  route("/settings/:tab", (tab) => area("settings", tab));
  route("/social/:tab", (tab) => area("social", tab));
  route("/library/:tab", (tab) => area("library", tab));
  route("/research/:tab", (tab) => area("research", tab));
  // Before /knowledge/:tab — first match wins, and Config moved to Settings.
  route("/knowledge/config", () => go("/settings/files"));
  route("/knowledge/:tab", (tab) => area("knowledge", tab));
  route("/knowledge/best-practices/:type", (t) => area("knowledge", "best-practices", t));
  // Bare area path -> first (or remembered) tab.
  route("/social", () => go(areaTab("social")));
  route("/library", () => go(areaTab("library")));
  route("/research", () => go(areaTab("research")));
  route("/knowledge", () => go(areaTab("knowledge")));
  route("/settings", () => go(areaTab("settings")));  // was Knowledge's Config tab

  // Legacy / short routes keep working and render the same area frame.
  route("/slides", () => area("library", "slides"));
  route("/graphics", () => area("library", "graphics"));
  route("/icons", () => area("library", "icons"));
  route("/design-system", () => area("library", "design-system"));
  route("/brand", () => area("library", "brand"));
  route("/output/masters", () => go("/decks"));     // Output was split into
  route("/output/social", () => go("/social/all")); // Decks + Social output
  route("/output", () => go("/decks"));
  route("/social-out", () => go("/social/all"));
  route("/config", () => go("/settings/files"));   // Config is now Studio files

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

  // Area bars and detail headers stick BELOW the top strip, so they need its
  // real height. Measured, not hardcoded: the strip is taller once the
  // signed-in email is in it, and a guessed offset leaves a visible seam of
  // scrolling content between the two bars.
  const syncTopbarHeight = () => {
    const h = document.getElementById("topstrip")?.offsetHeight;
    if (h) document.documentElement.style.setProperty("--topbar-h", `${h}px`);
  };
  syncTopbarHeight();
  window.addEventListener("resize", syncTopbarHeight);
  if (window.ResizeObserver) new ResizeObserver(syncTopbarHeight).observe($("#topstrip"));

  window.addEventListener("hashchange", renderSidebar);
  // The rail's "decks behind" count comes from the backend slice, which lands
  // after the first paint. Redraw once it arrives.
  document.addEventListener("oppr:backend-loaded", renderSidebar);
  if (!location.hash) location.hash = "/customers";
  startRouter();
}

boot();
