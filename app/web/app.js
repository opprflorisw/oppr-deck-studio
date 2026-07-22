// Oppr Deck Studio App — viewer + composer front-end (vanilla ES module).
//
// Flow: browse the library -> cherry-pick slides into a draft -> comment on
// each / insert new-slide instructions -> save the draft to decks/drafts/ and
// copy the one-line prompt to run in the Claude CLI. The app NEVER builds the
// deck; the CLI (via /deckbuilder) does, with its approval gates.

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Slide titles in meta are HTML entity strings (e.g. can&rsquo;t); render as text.
const decodeEntities = (s) => { const t = document.createElement("textarea"); t.innerHTML = s ?? ""; return t.value; };

const ENTITLEMENT_RANK = { public: 0, "named-customer": 1, "mutares-family": 1 };

const state = {
  index: null,
  view: "browse",
  browseTab: "slides",
  filter: { role: "", entitlement: "", q: "" },
  draft: loadDraft(),
};

// ---- draft persistence (working buffer in localStorage) --------------------
function blankDraft() {
  return {
    title: "", type: "", slug: "",
    intent: { audience: "", client: "", language: "en", entitlement: "public", goal: "", presenter: "" },
    vars: { deck_footer: "", cover_meta: "" },
    slides: [],
    source_deck: null,
  };
}
function loadDraft() {
  try { return { ...blankDraft(), ...JSON.parse(localStorage.getItem("oppr.draft") || "{}") }; }
  catch { return blankDraft(); }
}
function saveDraftLocal() {
  localStorage.setItem("oppr.draft", JSON.stringify(state.draft));
  $("#draft-count").textContent = state.draft.slides.length;
}

// ---- data lookups ----------------------------------------------------------
const slideById = (id) => state.index.slides.find((s) => s.id === id);
function draftClearanceRank() {
  const e = state.draft.intent.entitlement || "public";
  return ENTITLEMENT_RANK[e] ?? 0;
}
function slideExceedsClearance(entitlement) {
  return (ENTITLEMENT_RANK[entitlement] ?? 0) > draftClearanceRank();
}

// ---- toast -----------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

// ---- boot ------------------------------------------------------------------
async function boot() {
  try {
    const res = await fetch("/api/index");
    state.index = await res.json();
  } catch {
    $("#main").innerHTML = `<div class="loading">Could not load the library index. Is the server running?</div>`;
    return;
  }
  saveDraftLocal();
  $$("#tabs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#refresh-btn").addEventListener("click", refreshLibrary);
  render();
}

async function refreshLibrary() {
  toast("Re-scanning library…");
  await fetch("/api/refresh", { method: "POST" });
  const res = await fetch("/api/index");
  state.index = await res.json();
  render();
  toast("Library refreshed.");
}

function setView(v) {
  state.view = v;
  $$("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  render();
}

function render() {
  const main = $("#main");
  if (state.view === "browse") main.innerHTML = "", main.append(renderBrowse());
  else if (state.view === "draft") main.innerHTML = "", main.append(renderDraft());
  else main.innerHTML = "", main.append(renderHandoff());
}

// ===== BROWSE ===============================================================
function renderBrowse() {
  const wrap = document.createElement("div");
  const subbar = document.createElement("div");
  subbar.className = "subbar";
  subbar.innerHTML = `
    <div class="subtabs">
      <button data-t="slides" class="${state.browseTab === "slides" ? "active" : ""}">Slides <span class="tags">${state.index.slides.length}</span></button>
      <button data-t="decks" class="${state.browseTab === "decks" ? "active" : ""}">Decks</button>
      <button data-t="images" class="${state.browseTab === "images" ? "active" : ""}">Images <span class="tags">${state.index.images.length}</span></button>
    </div>`;
  $$("button", subbar).forEach((b) => b.addEventListener("click", () => { state.browseTab = b.dataset.t; render(); }));

  if (state.browseTab === "slides") subbar.append(slideFilters());
  wrap.append(subbar);

  if (state.browseTab === "slides") wrap.append(renderSlideGrid());
  else if (state.browseTab === "decks") wrap.append(renderDecks());
  else wrap.append(renderImages());
  return wrap;
}

function slideFilters() {
  const roles = [...new Set(state.index.slides.map((s) => s.role).filter(Boolean))];
  const f = document.createElement("div");
  f.className = "filters";
  f.innerHTML = `
    <input type="search" id="q" placeholder="Search title, tags, id…" value="${esc(state.filter.q)}">
    <select id="role"><option value="">All roles</option>${roles.map((r) => `<option ${state.filter.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
    <select id="ent">
      <option value="">Any clearance</option>
      <option value="public" ${state.filter.entitlement === "public" ? "selected" : ""}>public</option>
      <option value="named-customer" ${state.filter.entitlement === "named-customer" ? "selected" : ""}>named-customer</option>
      <option value="mutares-family" ${state.filter.entitlement === "mutares-family" ? "selected" : ""}>mutares-family</option>
    </select>`;
  $("#q", f).addEventListener("input", (e) => { state.filter.q = e.target.value; refreshGrid(); });
  $("#role", f).addEventListener("change", (e) => { state.filter.role = e.target.value; refreshGrid(); });
  $("#ent", f).addEventListener("change", (e) => { state.filter.entitlement = e.target.value; refreshGrid(); });
  return f;
}
function refreshGrid() {
  const old = $(".grid");
  if (old) old.replaceWith(renderSlideGrid());
}

function filteredSlides() {
  const q = state.filter.q.trim().toLowerCase();
  return state.index.slides.filter((s) => {
    if (state.filter.role && s.role !== state.filter.role) return false;
    if (state.filter.entitlement && s.entitlement !== state.filter.entitlement) return false;
    if (q) {
      const hay = (s.id + " " + decodeEntities(s.title) + " " + (s.tags || []).join(" ") + " " + s.role).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderSlideGrid() {
  const grid = document.createElement("div");
  grid.className = "grid";
  const inDraft = new Set(state.draft.slides.filter((s) => s.source !== "new").map((s) => s.id));
  for (const s of filteredSlides()) {
    const card = document.createElement("div");
    card.className = "card";
    const added = inDraft.has(s.id);
    card.innerHTML = `
      <div class="thumb" style="${s.thumb ? `background-image:url('/repo/${esc(s.thumb)}')` : ""}"></div>
      <div class="body">
        <h3>${esc(decodeEntities(s.title))}</h3>
        <div class="meta-row">
          ${s.role ? `<span class="chip">${esc(s.role)}</span>` : ""}
          <span class="badge ${esc(s.entitlement)}">${esc(s.entitlement)}</span>
        </div>
        <div class="tags">${(s.tags || []).slice(0, 5).map(esc).join(" · ")}</div>
        <div class="actions">
          <button class="add-btn ${added ? "added" : ""}">${added ? "Added ✓  (add again)" : "+ Add to draft"}</button>
        </div>
      </div>`;
    $(".add-btn", card).addEventListener("click", () => addSlide(s.id));
    grid.append(card);
  }
  if (!grid.children.length) grid.innerHTML = `<div class="loading">No slides match those filters.</div>`;
  return grid;
}

function renderDecks() {
  const box = document.createElement("div");
  const section = (label, decks) => {
    if (!decks.length) return;
    const h = document.createElement("h2");
    h.style.cssText = "font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:6px 0 12px";
    h.textContent = label;
    box.append(h);
    for (const d of decks) box.append(deckRow(d));
  };
  section("Canonical masters", state.index.decks.canonical);
  section("Frozen variants", state.index.decks.variants);
  return box;
}

function deckRow(d) {
  const row = document.createElement("div");
  row.className = "deck-row";
  const thumbFor = (id) => { const s = slideById(id); return s && s.thumb ? `/repo/${s.thumb}` : ""; };
  row.innerHTML = `
    <div class="head">
      <h3>${esc(decodeEntities(d.title))}</h3>
      <span class="badge">${esc(d.type || "—")}</span>
      <span class="tags">${d.slides.length} slides</span>
      <div class="spacer">
        ${d.index ? `<button class="ghost prev">Preview</button>` : ""}
        <button class="ghost clone">Start draft from this</button>
      </div>
    </div>
    <div class="filmstrip">
      ${d.slides.map((id) => `<div class="frame"><img src="${thumbFor(id)}" alt=""><div class="cap">${esc(id)}</div></div>`).join("")}
    </div>`;
  if (d.index) $(".prev", row).addEventListener("click", () => openPreview(`/repo/${d.index}`, decodeEntities(d.title)));
  $(".clone", row).addEventListener("click", () => cloneDeckToDraft(d));
  return row;
}

function renderImages() {
  const grid = document.createElement("div");
  grid.className = "grid";
  for (const im of state.index.images) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="thumb ${im.orientation === "portrait" ? "portrait" : ""}" style="background-image:url('/repo/${esc(im.src)}')"></div>
      <div class="body">
        <h3 style="font-weight:600;font-size:13px">${esc(im.description || im.file)}</h3>
        <div class="meta-row">
          <span class="chip">${esc(im.type || "image")}</span>
          <span class="badge ${esc(im.entitlement || "public")}">${esc(im.entitlement || "public")}</span>
        </div>
        <div class="tags">${(im.tags || []).slice(0, 6).map(esc).join(" · ")}</div>
      </div>`;
    grid.append(card);
  }
  return grid;
}

// ===== DRAFT (composer) =====================================================
function addSlide(id) {
  const s = slideById(id);
  if (!s) return;
  state.draft.slides.push({ source: s.used_in && s.used_in.length ? "library" : "library", id: s.id, role: s.role, title: s.title, thumb: s.thumb, comment: "" });
  saveDraftLocal();
  if (state.view === "browse") { refreshGrid(); toast(`Added "${decodeEntities(s.title)}"`); }
  else render();
}
function cloneDeckToDraft(d) {
  if (state.draft.slides.length && !confirm("Replace the current draft with this deck's slides?")) return;
  state.draft = blankDraft();
  state.draft.title = decodeEntities(d.title) + " (variant)";
  state.draft.type = d.type;
  state.draft.vars = { ...d.vars };
  state.draft.intent.entitlement = (d.allowed_entitlements || ["public"]).includes("mutares-family") ? "mutares-family"
    : (d.allowed_entitlements || ["public"]).includes("named-customer") ? "named-customer" : "public";
  state.draft.source_deck = d.path;
  for (const id of d.slides) {
    const s = slideById(id);
    state.draft.slides.push({ source: "library", id, role: s ? s.role : "", title: s ? s.title : id, thumb: s ? s.thumb : null, comment: "" });
  }
  saveDraftLocal();
  setView("draft");
  toast("Draft started from " + decodeEntities(d.title));
}

function renderDraft() {
  const wrap = document.createElement("div");
  wrap.className = "composer";
  wrap.append(draftMetaPanel(), draftStrip());
  return wrap;
}

function draftMetaPanel() {
  const p = document.createElement("div");
  p.className = "panel";
  const d = state.draft;
  const recipeOpts = ["", ...state.index.recipes.map((r) => r.type)];
  p.innerHTML = `
    <h2>Deck intent</h2>
    <div class="field"><label>Working title</label><input id="d-title" value="${esc(d.title)}"></div>
    <div class="field"><label>Type / recipe</label>
      <select id="d-type">${recipeOpts.map((t) => `<option value="${esc(t)}" ${d.type === t ? "selected" : ""}>${esc(t || "— none —")}</option>`).join("")}</select></div>
    <div class="field"><label>Audience</label><input id="d-aud" value="${esc(d.intent.audience)}" placeholder="company, role, what they know"></div>
    <div class="field"><label>Named client (optional)</label><input id="d-client" value="${esc(d.intent.client)}" placeholder="leave blank for a public deck"></div>
    <div class="field"><label>Language</label>
      <select id="d-lang">${["en", "fr", "de", "nl"].map((l) => `<option ${d.intent.language === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="field"><label>Entitlement clearance</label>
      <select id="d-ent">
        <option value="public" ${d.intent.entitlement === "public" ? "selected" : ""}>public</option>
        <option value="named-customer" ${d.intent.entitlement === "named-customer" ? "selected" : ""}>named-customer</option>
        <option value="mutares-family" ${d.intent.entitlement === "mutares-family" ? "selected" : ""}>mutares-family</option>
      </select>
      <span class="hint">Slides above this clearance are flagged.</span></div>
    <div class="field"><label>Goal &amp; emphasis</label><textarea id="d-goal" placeholder="the one action the audience should take">${esc(d.intent.goal)}</textarea></div>
    <div class="field"><label>Presenter (Oppr side)</label><input id="d-pres" value="${esc(d.intent.presenter)}"></div>
    <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
    <div class="field"><label>deck_footer</label><input id="d-foot" value="${esc(d.vars.deck_footer)}" placeholder="Operator Intelligence &middot; …"></div>
    <div class="field"><label>cover_meta</label><input id="d-cover" value="${esc(d.vars.cover_meta)}" placeholder="Teaser &middot; July 2026 &middot; …"></div>
  `;
  const bind = (id, fn) => $(id, p).addEventListener("input", (e) => { fn(e.target.value); saveDraftLocal(); });
  bind("#d-title", (v) => (d.title = v));
  bind("#d-type", (v) => (d.type = v));
  bind("#d-aud", (v) => (d.intent.audience = v));
  bind("#d-client", (v) => (d.intent.client = v));
  bind("#d-lang", (v) => (d.intent.language = v));
  $("#d-ent", p).addEventListener("change", (e) => { d.intent.entitlement = e.target.value; saveDraftLocal(); redrawStrip(); });
  bind("#d-goal", (v) => (d.intent.goal = v));
  bind("#d-pres", (v) => (d.intent.presenter = v));
  bind("#d-foot", (v) => (d.vars.deck_footer = v));
  bind("#d-cover", (v) => (d.vars.cover_meta = v));
  return p;
}

function redrawStrip() {
  const old = $(".strip-wrap");
  if (old) old.replaceWith(draftStrip());
}

function draftStrip() {
  const box = document.createElement("div");
  box.className = "strip-wrap";
  if (!state.draft.slides.length) {
    box.innerHTML = `<div class="empty-draft">Your draft is empty. Go to <b>Browse</b> and add slides, or start from an existing deck.</div>`;
    return box;
  }
  const strip = document.createElement("div");
  strip.className = "strip";
  state.draft.slides.forEach((slot, i) => {
    strip.append(insertRow(i));
    strip.append(slotEl(slot, i));
  });
  strip.append(insertRow(state.draft.slides.length));
  box.append(strip);
  return box;
}

function insertRow(i) {
  const row = document.createElement("div");
  row.className = "insert-row";
  row.innerHTML = `<button>+ Insert new slide here</button>`;
  $("button", row).addEventListener("click", () => {
    state.draft.slides.splice(i, 0, { source: "new", id: "", role: "", title: "", brief: "" });
    saveDraftLocal(); redrawStrip();
  });
  return row;
}

function slotEl(slot, i) {
  const el = document.createElement("div");
  const isNew = slot.source === "new";
  const warn = !isNew && slideExceedsClearance((slideById(slot.id) || {}).entitlement || "public");
  el.className = "slot" + (isNew ? " new" : "") + (warn ? " warn" : "");
  el.draggable = true;
  el.dataset.i = i;

  if (isNew) {
    el.innerHTML = `
      <div class="handle" title="drag to reorder">⋮⋮</div>
      <div class="new-thumb">New</div>
      <div class="info">
        <div class="meta-row">
          <input class="new-id" placeholder="proposed id (e.g. payback-200-plant)" value="${esc(slot.id)}" style="font-family:var(--mono);font-size:12px;padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)">
          <select class="new-role" style="padding:5px 7px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)">
            <option value="">role…</option>${state.index.roles.map((r) => `<option ${slot.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        </div>
        <textarea class="brief" placeholder="Describe the new slide: what it should show, the message, any numbers.">${esc(slot.brief || "")}</textarea>
      </div>
      <button class="rm" title="remove">✕</button>`;
    $(".new-id", el).addEventListener("input", (e) => { slot.id = e.target.value; saveDraftLocal(); });
    $(".new-role", el).addEventListener("change", (e) => { slot.role = e.target.value; saveDraftLocal(); });
    $(".brief", el).addEventListener("input", (e) => { slot.brief = e.target.value; saveDraftLocal(); });
  } else {
    el.innerHTML = `
      <div class="handle" title="drag to reorder">⋮⋮</div>
      <div>${slot.thumb ? `<img class="mini" src="/repo/${esc(slot.thumb)}" alt="">` : `<div class="new-thumb">${esc(slot.id)}</div>`}<div class="idx">${esc(slot.id)}</div></div>
      <div class="info">
        <div class="title">${esc(decodeEntities(slot.title || slot.id))} ${warn ? `<span class="warn-text">· exceeds clearance</span>` : ""}</div>
        <textarea class="comment" placeholder="Comment: what to change on this slide (leave blank to reuse as-is).">${esc(slot.comment || "")}</textarea>
      </div>
      <button class="rm" title="remove">✕</button>`;
    $(".comment", el).addEventListener("input", (e) => { slot.comment = e.target.value; saveDraftLocal(); });
  }
  $(".rm", el).addEventListener("click", () => { state.draft.slides.splice(i, 1); saveDraftLocal(); redrawStrip(); });

  el.addEventListener("dragstart", (e) => { el.classList.add("dragging"); e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));
  el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("over"); });
  el.addEventListener("dragleave", () => el.classList.remove("over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault(); el.classList.remove("over");
    const from = Number(e.dataTransfer.getData("text/plain"));
    const to = i;
    if (from === to || Number.isNaN(from)) return;
    const [moved] = state.draft.slides.splice(from, 1);
    state.draft.slides.splice(to, 0, moved);
    saveDraftLocal(); redrawStrip();
  });
  return el;
}

// ===== HANDOFF ==============================================================
function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 50) || "untitled";
}

function renderHandoff() {
  const wrap = document.createElement("div");
  wrap.className = "handoff";
  const d = state.draft;
  const date = new Date().toISOString().slice(0, 10);
  const defaultSlug = d.slug || `${date}_${slugify(d.intent.client || d.title || "draft")}`;

  const newCount = d.slides.filter((s) => s.source === "new").length;
  const commentCount = d.slides.filter((s) => s.source !== "new" && (s.comment || "").trim()).length;
  const warnCount = d.slides.filter((s) => s.source !== "new" && slideExceedsClearance((slideById(s.id) || {}).entitlement || "public")).length;

  wrap.innerHTML = `
    <div class="panel">
      <h2>Hand off to the CLI</h2>
      <p class="note">The app saves your draft under <code>decks/drafts/</code>. It does <b>not</b> build the deck — you run one line in the Claude CLI, which shows a plan, asks for your approval, then assembles, builds the PDF and verifies it.</p>
      <div class="field"><label>Draft slug</label><input id="h-slug" value="${esc(defaultSlug)}"></div>
      <p class="note">
        ${d.slides.length} slides · ${d.slides.length - newCount} reused · ${newCount} new · ${commentCount} with comments
        ${warnCount ? ` · <span class="warn-text">${warnCount} above clearance</span>` : ""}
      </p>
      ${warnCount ? `<p class="note warn-text">Some slides exceed the draft's entitlement clearance. The CLI will refuse to ship them unless the deck is cleared. Raise the clearance in the Draft tab, or remove those slides.</p>` : ""}
      <button class="primary" id="h-save" ${d.slides.length ? "" : "disabled"}>Save draft to repo</button>
      <div id="h-result" style="margin-top:16px"></div>
    </div>
    <div class="panel" style="margin-top:18px">
      <h2>Existing drafts</h2>
      <ul class="draft-list" id="h-list"><li class="note">Loading…</li></ul>
    </div>`;

  $("#h-save", wrap).addEventListener("click", async () => {
    const slug = slugify($("#h-slug", wrap).value);
    d.slug = slug; saveDraftLocal();
    const res = await fetch(`/api/drafts/${encodeURIComponent(slug)}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
    });
    const out = await res.json();
    if (!res.ok) { toast(out.error || "save failed"); return; }
    $("#h-result", wrap).innerHTML = `
      <p class="note">Saved to <code>decks/drafts/${esc(slug)}/draft.json</code>. Run this in the Claude CLI:</p>
      <div class="prompt-box"><code>${esc(out.prompt)}</code><button id="h-copy">Copy</button></div>`;
    $("#h-copy", wrap).addEventListener("click", () => { navigator.clipboard.writeText(out.prompt); toast("Copied."); });
    loadDraftList(wrap);
    toast("Draft saved.");
  });

  loadDraftList(wrap);
  return wrap;
}

async function loadDraftList(wrap) {
  const ul = $("#h-list", wrap);
  try {
    const { drafts } = await (await fetch("/api/drafts")).json();
    if (!drafts.length) { ul.innerHTML = `<li class="note">No saved drafts yet.</li>`; return; }
    ul.innerHTML = "";
    for (const dr of drafts) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="grow"><b>${esc(dr.title)}</b> <span class="slug">${esc(dr.slug)}</span> · ${dr.slides} slides</span>
        <button class="ghost load">Load</button><button class="ghost del">Delete</button>`;
      $(".load", li).addEventListener("click", async () => {
        const d = await (await fetch(`/api/drafts/${encodeURIComponent(dr.slug)}`)).json();
        state.draft = { ...blankDraft(), ...d };
        saveDraftLocal(); setView("draft"); toast("Loaded " + dr.slug);
      });
      $(".del", li).addEventListener("click", async () => {
        if (!confirm(`Delete draft "${dr.slug}"?`)) return;
        await fetch(`/api/drafts/${encodeURIComponent(dr.slug)}`, { method: "DELETE" });
        loadDraftList(wrap); toast("Deleted.");
      });
      ul.append(li);
    }
  } catch { ul.innerHTML = `<li class="note">Could not load drafts.</li>`; }
}

// ===== preview modal ========================================================
function openPreview(src, title) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="box"><header><b>${esc(title)}</b><div class="spacer"></div><button class="ghost close">Close</button></header><iframe src="${esc(src)}"></iframe></div>`;
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  document.body.append(m);
}

boot();
