// Boot: load index, wire the shell (sidebar, search, compose, refresh), register
// routes, start the router.

import { $, toast } from "./util.js";
import * as api from "./api.js";
import { state, updateDraftCount, setDraft, blankDraft } from "./state.js";
import { route, setNotFound, startRouter, dispatch, go } from "./router.js";
import { renderSidebar, markActive } from "./sidebar.js";
import * as slides from "./views/slides.js";
import * as decks from "./views/decks.js";
import * as graphics from "./views/graphics.js";
import * as social from "./views/social.js";
import * as knowledge from "./views/knowledge.js";
import * as designsystem from "./views/design-system.js";
import * as draft from "./views/draft.js";
import { renderTray, toggleCompose } from "./compose.js";

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

  renderSidebar();
  updateDraftCount();
  renderTray();

  $("#refresh-btn").addEventListener("click", async () => {
    toast("Re-scanning…");
    await api.refresh();
    state.index = await api.getIndex();
    dispatch();
    toast("Library refreshed.");
  });
  $("#compose-toggle").addEventListener("click", () => toggleCompose());
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
  route("/slides", () => mount(slides.renderList()));
  route("/slides/:id", (id) => mount(slides.renderDetail(id)));
  route("/graphics", () => mount(graphics.renderList()));
  route("/graphics/:file", (f) => mount(graphics.renderDetail(f)));
  route("/design-system", () => mount(designsystem.render()));
  route("/decks", () => mount(decks.renderList()));
  route("/draft", () => mount(draft.render()));
  route("/social", () => mount(social.renderStudio()));
  route("/social/new/:kind", (kind) => mount(social.renderComposer(kind)));
  route("/social-out", () => mount(social.renderOutputs()));
  route("/knowledge/design", () => mount(knowledge.renderDesign()));
  route("/knowledge/best-practices", () => mount(knowledge.renderBestPractices()));
  route("/knowledge/best-practices/:type", (t) => mount(knowledge.renderBestPractice(t)));
  route("/knowledge/recipes", () => mount(knowledge.renderRecipes()));
  route("/config", () => mount(knowledge.renderConfig()));
  setNotFound(() => go("/slides"));

  window.addEventListener("hashchange", () => { renderSidebar(); });
  startRouter();
}

boot();
