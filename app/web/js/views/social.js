// Social studio: pick an output type, compose it, browse built outputs.
// Phase 6 builds the real carousel/post composers; Phase 2 lays the shell.

import { $, $$, el, esc, decodeEntities, slugify, toast, todayISO } from "../util.js";
import { state } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { assembledViewer, assembledPages, carouselComposerViewer } from "./viewer.js";
import { PATTERNS, blankPage } from "./carousel-build.js";
import { icon } from "../icons.js";
import { openPostEditor } from "../postedit.js";

const KINDS = [
  { kind: "carousel", label: "LinkedIn carousel", desc: "4:5 document post, 6–10 pages", ready: true },
  { kind: "post", label: "LinkedIn post", desc: "post text with a 140-char hook", ready: true },
  { kind: "article", label: "LinkedIn article", desc: "long-form + hero image", ready: false },
  { kind: "image", label: "Social image", desc: "1080×1080 / 1200×627", ready: false },
  { kind: "youtube-thumbnail", label: "YouTube thumbnail", desc: "1280×720", ready: false },
];

export function renderStudio() {
  const wrap = el(`
    <div>
      <p class="note">Everything here is <b>public</b> by definition — no named-customer material. Pick what to make; the CLI builds it via <span class="mono">/deckbuilder</span>. Built outputs live under <a href="#/output/social">Output → Social output</a>.</p>
      <div class="grid">
        ${KINDS.map((k) => `
          <div class="card kind-card" data-kind="${esc(k.kind)}">
            <div class="body">
              <h3>${esc(k.label)}</h3>
              <p class="note">${esc(k.desc)}</p>
              <div class="actions"><button class="add-btn">${k.ready ? "Compose" : "Brief only"}</button></div>
            </div>
          </div>`).join("")}
      </div>
    </div>`);
  $$("[data-kind]", wrap).forEach((c) => c.addEventListener("click", () => go("/social/new/" + c.dataset.kind)));
  return wrap;
}

export function renderComposer(kind) {
  const meta = KINDS.find((k) => k.kind === kind);
  if (!meta) return el(`<div class="loading">Unknown type: ${esc(kind)}</div>`);
  if (kind === "carousel") return carouselComposer();
  if (kind === "post") return postComposer();
  // article / image / thumbnail: brief-only for v2.
  return briefComposer(meta);
}

// ---- carousel composer ------------------------------------------------------
function carouselComposer() {
  const d = { kind: "carousel", channel: "linkedin", title: "", intent: { audience: "", goal: "" },
    pages: [blankPage("hook"), blankPage("point"), blankPage("cta")] };
  const wrap = el(`
    <div>
      <div class="detail-head"><button class="ghost" id="back">&larr; Social studio</button><h1>LinkedIn carousel</h1>
        <button class="ghost" id="preview" style="margin-left:auto">Preview all</button></div>
      <p class="note">Public only. 6–10 pages, 4:5. Compose the pages, then save a social draft and build it via <span class="mono">/deckbuilder</span>.</p>
      <div class="composer">
        <div class="panel">
          <h2>Carousel intent</h2>
          <div class="field"><label>Working title</label><input id="c-title" placeholder="operators-are-the-sensor"></div>
          <div class="field"><label>Audience</label><input id="c-aud" placeholder="operational owners, plant directors"></div>
          <div class="field"><label>Goal</label><textarea id="c-goal" placeholder="the one action (e.g. book a data analysis)"></textarea></div>
          <div class="field"><label>Add page</label>
            <select id="c-add">${PATTERNS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}</select>
            <button class="ghost" id="c-addbtn" style="margin-top:6px">+ Add page</button></div>
        </div>
        <div class="strip-col"><div id="pages"></div>
          ${saveBar()}
        </div>
      </div>
    </div>`);
  const bind = (id, fn) => $(id, wrap).addEventListener("input", (e) => fn(e.target.value));
  bind("#c-title", (v) => (d.title = v));
  bind("#c-aud", (v) => (d.intent.audience = v));
  bind("#c-goal", (v) => (d.intent.goal = v));
  $("#c-addbtn", wrap).addEventListener("click", () => { d.pages.push(blankPage($("#c-add", wrap).value)); renderPages(); });
  $("#back", wrap).addEventListener("click", () => go("/social"));
  $("#preview", wrap).addEventListener("click", () => carouselComposerViewer(d.pages, "Carousel preview"));

  const renderPages = () => {
    const host = $("#pages", wrap);
    host.innerHTML = "";
    d.pages.forEach((pg, i) => host.append(pageCard(pg, i, d, renderPages)));
  };
  renderPages();
  wireSave(wrap, () => d, () => d.pages.length >= 3);
  return wrap;
}

function pageCard(pg, i, d, rerender) {
  const pat = PATTERNS.find((p) => p.id === pg.pattern);
  const card = el(`
    <div class="slot" style="grid-template-columns:30px 1fr auto">
      <div class="handle">${i + 1}</div>
      <div class="info">
        <div class="meta-row"><span class="chip">${esc(pat.label)}</span>
          <button class="ghost mini-btn up">↑</button><button class="ghost mini-btn down">↓</button></div>
        ${pat.fields.map((f) => f === "body" || f === "sub"
          ? `<textarea data-f="${f}" placeholder="${f}">${esc(pg[f] || "")}</textarea>`
          : `<input data-f="${f}" placeholder="${f}" value="${esc(pg[f] || "")}">`).join("")}
      </div>
      <button class="rm" title="remove">✕</button>
    </div>`);
  $$("[data-f]", card).forEach((inp) => inp.addEventListener("input", () => { pg[inp.dataset.f] = inp.value; }));
  $(".rm", card).addEventListener("click", () => { d.pages.splice(i, 1); rerender(); });
  $(".up", card).addEventListener("click", () => { if (i > 0) { [d.pages[i - 1], d.pages[i]] = [d.pages[i], d.pages[i - 1]]; rerender(); } });
  $(".down", card).addEventListener("click", () => { if (i < d.pages.length - 1) { [d.pages[i + 1], d.pages[i]] = [d.pages[i], d.pages[i + 1]]; rerender(); } });
  return card;
}

// ---- post composer ----------------------------------------------------------
function postComposer() {
  const d = { kind: "post", channel: "linkedin", title: "", post: { hook: "", body: "", cta: "", hashtags: "" } };
  const wrap = el(`
    <div>
      <div class="detail-head"><button class="ghost" id="back">&larr; Social studio</button><h1>LinkedIn post</h1></div>
      <div class="panel" style="max-width:720px">
        <div class="field"><label>Working title / slug</label><input id="p-title"></div>
        <div class="field"><label>Hook <span class="hint" id="hookcount">0 / 140</span></label>
          <textarea id="p-hook" placeholder="Lands in the first ~140 chars (mobile 'see more' fold)."></textarea></div>
        <div class="field"><label>Body</label><textarea id="p-body" style="min-height:120px" placeholder="2–3 short paragraphs. Single blank line between them."></textarea></div>
        <div class="field"><label>CTA</label><input id="p-cta" placeholder="link goes in the first comment, not here"></div>
        <div class="field"><label>Hashtags (0–3)</label><input id="p-tags" placeholder="#manufacturing #operationalexcellence"></div>
        <p class="note">Unicode bold only for 1–3 short phrases, never numbers/keywords. See <a href="#/knowledge/best-practices/linkedin-post">best practices</a>.</p>
        ${saveBar()}
      </div>
    </div>`);
  const bind = (id, fn) => $(id, wrap).addEventListener("input", (e) => fn(e.target.value));
  bind("#p-title", (v) => (d.title = v));
  bind("#p-hook", (v) => { d.post.hook = v; const c = $("#hookcount", wrap); c.textContent = `${v.length} / 140`; c.className = "hint" + (v.length > 140 ? " warn-text" : ""); });
  bind("#p-body", (v) => (d.post.body = v));
  bind("#p-cta", (v) => (d.post.cta = v));
  bind("#p-tags", (v) => (d.post.hashtags = v));
  $("#back", wrap).addEventListener("click", () => go("/social"));
  wireSave(wrap, () => d, () => d.post.hook.trim().length > 0);
  return wrap;
}

function briefComposer(meta) {
  const d = { kind: meta.kind, channel: meta.kind === "youtube-thumbnail" ? "youtube" : "linkedin", title: "", intent: { brief: "" } };
  const wrap = el(`
    <div>
      <div class="detail-head"><button class="ghost" id="back">&larr; Social studio</button><h1>${esc(meta.label)}</h1></div>
      <div class="panel" style="max-width:720px">
        <p class="note">Brief-only for v2: describe it, save a social draft, and <span class="mono">/deckbuilder</span> builds it (its template lands with first use).</p>
        <div class="field"><label>Working title / slug</label><input id="b-title"></div>
        <div class="field"><label>Brief</label><textarea id="b-brief" style="min-height:140px" placeholder="What it should show, the message, any numbers."></textarea></div>
        ${saveBar()}
      </div>
    </div>`);
  $("#b-title", wrap).addEventListener("input", (e) => (d.title = e.target.value));
  $("#b-brief", wrap).addEventListener("input", (e) => (d.intent.brief = e.target.value));
  $("#back", wrap).addEventListener("click", () => go("/social"));
  wireSave(wrap, () => d, () => (d.intent.brief || "").trim().length > 0);
  return wrap;
}

// ---- shared save/handoff ----------------------------------------------------
function saveBar() {
  return `
    <div class="panel handoff-panel">
      <div class="field inline"><label>Slug</label><input id="s-slug"></div>
      <button class="primary" id="s-save">Save social draft</button>
      <div id="s-result" style="margin-top:12px"></div>
    </div>`;
}

function wireSave(wrap, getD, valid) {
  const slugEl = $("#s-slug", wrap);
  slugEl.value = `${todayISO()}_draft`;
  const d = getD();
  $("#s-save", wrap).addEventListener("click", async () => {
    const base = d.title ? slugify(d.title) : "draft";
    const slug = slugify(slugEl.value || `${todayISO()}_${base}`);
    if (!valid()) { toast("Add some content first."); return; }
    try {
      const out = await api.putSocialDraft(slug, d);
      $("#s-result", wrap).innerHTML = `
        <p class="note">Saved to <span class="mono">social/drafts/${esc(slug)}/draft.json</span>. Run in the CLI:</p>
        <div class="prompt-box"><code>${esc(out.prompt)}</code><button id="s-copy">Copy</button></div>`;
      $("#s-copy", wrap).addEventListener("click", () => { navigator.clipboard.writeText(out.prompt); toast("Copied."); });
      toast("Social draft saved.");
    } catch (err) { toast(err.message || "save failed"); }
  });
}

let outFilter = localStorage.getItem("oppr.outFilter") || "all"; // all | draft | posted
let outCategory = "all"; // the active Social output tab, set by the router
let statusCache = {};

export function renderOutputs(category = "all") {
  outCategory = category;
  const wrap = el(`
    <div class="social-out">
      <div class="subbar">
        <div class="viewswitch" id="out-filter"></div>
      </div>
      <div id="out-body"><div class="loading">Loading…</div></div>
    </div>`);
  hydrateOutputs(wrap);
  return wrap;
}

async function hydrateOutputs(wrap) {
  try { statusCache = await api.getSocialStatus(); } catch { statusCache = {}; }
  const body = $("#out-body", wrap);
  renderFilterBar(wrap);
  if (!items().length) {
    body.innerHTML = `<div class="loading">Nothing in this category yet.</div>`;
    return;
  }
  paintList(body, items(), wrap);
}

// Outputs in the ACTIVE CATEGORY, with their publish status attached (default
// draft). An output with no declared category falls back to its artifact shape,
// so an un-tagged piece still lands somewhere sensible.
const items = () => (state.index.social || [])
  .filter((o) => outCategory === "all" || (o.category || o.kind) === outCategory)
  .map((o) => ({ ...o, _st: normStatus(statusCache[o.slug]) }));
const isPosted = (i) => i._st.status === "posted";

function normStatus(s) {
  if (!s) return { status: "draft", posted_date: "", url: "", archived: false };
  return { status: s.status === "posted" ? "posted" : "draft", posted_date: s.posted_date || "", url: s.url || "", archived: s.archived === true };
}
const isArchived = (i) => i._st.archived;
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

// Archived items are out of the working views entirely; that is the point of
// archiving. They stay reachable under their own tab.
function counts() {
  const live = items().filter((i) => !isArchived(i));
  return {
    all: live.length,
    posted: live.filter(isPosted).length,
    draft: live.filter((i) => !isPosted(i)).length,
    archived: items().filter(isArchived).length,
  };
}

function renderFilterBar(wrap) {
  const bar = $("#out-filter", wrap);
  const c = counts();
  bar.innerHTML = [["all", "All"], ["draft", "Draft"], ["posted", "Posted"], ["archived", "Archived"]]
    .map(([v, l]) => `<button data-of="${v}" class="${outFilter === v ? "active" : ""}">${l}<span class="of-count">${c[v]}</span></button>`).join("");
  $$("[data-of]", bar).forEach((b) => b.addEventListener("click", () => {
    outFilter = b.dataset.of; localStorage.setItem("oppr.outFilter", outFilter);
    $$("[data-of]", bar).forEach((x) => x.classList.toggle("active", x === b));
    paintList($("#out-body", wrap), items(), wrap);
  }));
}

function paintList(body, list, wrap) {
  const filtered = list.filter((i) =>
    outFilter === "archived" ? isArchived(i)
    : isArchived(i) ? false
    : outFilter === "posted" ? isPosted(i)
    : outFilter === "draft" ? !isPosted(i)
    : true);
  body.innerHTML = "";
  if (!filtered.length) {
    // The status filter is sticky (localStorage), so a piece can be perfectly
    // present and still invisible because "Posted" or "Archived" is selected.
    // Say so, and offer the one click back rather than leaving a dead end.
    const total = list.length;
    if (total && outFilter !== "all") {
      const msg = el(`<div class="empty"><p>Nothing here under <b>${esc(outFilter)}</b>, but this category has ${total} item${total > 1 ? "s" : ""}.</p><button class="ghost" id="show-all">Show all</button></div>`);
      $("#show-all", msg).addEventListener("click", () => {
        outFilter = "all"; localStorage.setItem("oppr.outFilter", "all");
        renderFilterBar(wrap); paintList(body, items(), wrap);
      });
      body.append(msg);
    } else {
      body.innerHTML = `<div class="loading">Nothing in this category yet.</div>`;
    }
    return;
  }
  for (const o of filtered) body.append(outputRow(o, wrap));
}

// Same shape as a deck row: title + status + icon actions + a filmstrip.
function outputRow(o, wrap) {
  const row = el(`
    <div class="deck-row" data-slug="${esc(o.slug)}">
      <div class="head">
        <h3>${esc(o.slug)}</h3>
        <span class="badge">${esc(o.channel)}</span>
        <span class="tags">${esc(o.kind || "")}</span>
        <span class="status-wrap"></span>
        <div class="spacer">
          ${o.index ? `<button class="ghost icon-only prev" title="Preview">${icon("preview")}</button>` : ""}
          ${o.pdf ? `<a class="ghost icon-only" href="/repo/${esc(o.pdf)}" download title="Download PDF">${icon("download")}</a>` : ""}
          ${o.image ? `<a class="ghost icon-only" href="/repo/${esc(o.image)}" download title="Download PNG">${icon("download")}</a>` : ""}
          ${o.post ? `<button class="ghost icon-only post" title="Post text">${icon("text")}</button>` : ""}
          <button class="ghost icon-only cfg" title="Post status &amp; link">${icon("settings")}</button>
          ${o._st.archived
            ? `<button class="ghost arch restore" title="Put this back in the working list">${icon("clone", 14)} Restore</button>`
            : `<button class="ghost icon-only arch" title="Archive">${icon("layers")}</button>`}
          <button class="ghost icon-only danger del" title="Delete output">${icon("trash")}</button>
        </div>
      </div>
      ${o.index ? `<div class="filmstrip live" data-strip><span class="note">Loading preview…</span></div>` : ""}
    </div>`);
  renderStatusBadge($(".status-wrap", row), o._st);
  if (o.index) {
    $(".prev", row).addEventListener("click", () => assembledViewer(o.index, o.slug, o.pdf, o.image));
    hydrateStrip($("[data-strip]", row), o);
  }
  if (o.post) $(".post", row).addEventListener("click", async () => {
    const t = await (await fetch(`/repo/${o.post}`)).text();
    openPostEditor(o.slug + " — post text", t);
  });
  $(".cfg", row).addEventListener("click", () => toggleStatusEditor(o, row, wrap));

  $(".arch", row).addEventListener("click", async () => {
    const next = !o._st.archived;
    try {
      const r = await api.putSocialStatus(o.slug, { ...o._st, archived: next });
      statusCache[o.slug] = r.entry;
      toast(next ? "Archived." : "Restored.");
      renderFilterBar(wrap);
      paintList($("#out-body", wrap), items(), wrap);
    } catch (err) { toast(err.message || "could not archive"); }
  });

  $(".del", row).addEventListener("click", () => confirmDelete(o, wrap));
  return row;
}

// Deleting a built output removes the folder, the PDF and the post text from
// disk for good. Archive is the reversible option, so the dialog offers it right
// there and makes the destructive path the deliberate one: the slug has to be
// typed before the button turns on.
function confirmDelete(o, wrap) {
  const m = el(`
    <div class="modal">
      <div class="box confirm">
        <header><b>Delete this output?</b><div class="spacer"></div><button class="ghost close">Close</button></header>
        <div class="confirm-body">
          <p>This permanently removes <code>${esc(o.path)}</code> and everything in it: the built ${o.image && !o.pdf ? "PNG" : "PDF"}, <code>index.html</code>, the post text and the brief.</p>
          <p class="warn-text"><b>This cannot be undone from the app.</b> If the folder was never committed to git, it is not recoverable at all.</p>
          <p class="note">Want it out of your way instead? <button class="ghost inline-arch">Archive it</button> keeps the files and hides the row.</p>
          <label class="field"><span>Type the slug to confirm</span>
            <input type="text" class="confirm-slug" placeholder="${esc(o.slug)}" autocomplete="off" spellcheck="false">
          </label>
        </div>
        <footer class="confirm-foot">
          <button class="ghost cancel">Cancel</button>
          <button class="danger go" disabled>Delete permanently</button>
        </footer>
      </div>
    </div>`);
  const input = $(".confirm-slug", m), go = $(".go", m);
  input.addEventListener("input", () => { go.disabled = input.value.trim() !== o.slug; });
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  $(".cancel", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  $(".inline-arch", m).addEventListener("click", async () => {
    try {
      const r = await api.putSocialStatus(o.slug, { ...o._st, archived: true });
      statusCache[o.slug] = r.entry;
      close(); toast("Archived.");
      renderFilterBar(wrap);
      paintList($("#out-body", wrap), items(), wrap);
    } catch (err) { toast(err.message || "could not archive"); }
  });
  go.addEventListener("click", async () => {
    go.disabled = true;
    try {
      const r = await api.deleteSocialOutput(o.channel, o.slug);
      // The server rebuilt app/index.json, so pull it back in. Dropping the row
      // from the in-memory copy alone is not enough: index.json is a cache, and
      // a stale entry would put the row straight back on the next reload.
      try { Object.assign(state.index, await api.getIndex()); }
      catch { state.index.social = (state.index.social || []).filter((x) => x.slug !== o.slug); }
      delete statusCache[o.slug];
      close();
      toast(r.removed === false ? "Row cleared (folder was already gone)." : "Deleted.");
      renderFilterBar(wrap);
      paintList($("#out-body", wrap), items(), wrap);
    } catch (err) { toast(err.message || "delete failed"); go.disabled = false; }
  });
  document.body.append(m);
  input.focus();
}

function renderStatusBadge(host, st) {
  if (st.status === "posted") {
    const d = st.posted_date ? " · " + st.posted_date : "";
    host.innerHTML = st.url
      ? `<a class="pill-status posted" href="${esc(safeUrl(st.url))}" target="_blank" rel="noopener noreferrer" title="Open the post">Posted${esc(d)} ${icon("open", 12)}</a>`
      : `<span class="pill-status posted">Posted${esc(d)}</span>`;
  } else {
    host.innerHTML = `<span class="pill-status draft">Draft</span>`;
  }
  if (st.archived) host.insertAdjacentHTML("beforeend", ` <span class="pill-status archived">Archived</span>`);
}

// A small inline editor: mark posted, set the date, paste the post link.
function toggleStatusEditor(o, row, wrap) {
  const open = $(".status-editor", row);
  if (open) { open.remove(); return; }
  const st = o._st;
  const ed = el(`
    <div class="status-editor">
      <label class="chk"><input type="checkbox" class="se-posted" ${st.status === "posted" ? "checked" : ""}> Posted</label>
      <div class="field inline"><label>On</label><input type="date" class="se-date" value="${esc(st.posted_date || "")}"></div>
      <div class="field inline grow"><label>Link</label><input type="url" class="se-url" placeholder="https://www.linkedin.com/posts/…" value="${esc(st.url || "")}"></div>
      <button class="primary se-save">Save</button>
      <button class="ghost se-cancel">Cancel</button>
      <span class="se-msg note"></span>
    </div>`);
  $(".head", row).after(ed);
  const chk = $(".se-posted", ed), date = $(".se-date", ed);
  chk.addEventListener("change", () => { if (chk.checked && !date.value) date.value = todayISO(); });
  $(".se-cancel", ed).addEventListener("click", () => ed.remove());
  $(".se-save", ed).addEventListener("click", async () => {
    const url = ($(".se-url", ed).value || "").trim();
    if (url && !/^https?:\/\//i.test(url)) { $(".se-msg", ed).textContent = "Link must start with http:// or https://"; return; }
    const payload = { status: chk.checked ? "posted" : "draft", posted_date: date.value || "", url };
    try {
      const r = await api.putSocialStatus(o.slug, payload);
      statusCache[o.slug] = r.entry;
      o._st = normStatus(r.entry);
      renderStatusBadge($(".status-wrap", row), o._st);
      ed.remove();
      renderFilterBar(wrap); // counts changed
      // drop the row if it no longer matches the active filter
      if (!(outFilter === "all" || (outFilter === "posted") === isPosted(o))) row.remove();
      toast("Saved.");
    } catch (err) { $(".se-msg", ed).textContent = err.message || "save failed"; }
  });
}

// Build a live filmstrip: each page as a small self-scaling iframe. Clicking any
// frame opens the paged viewer at that output.
async function hydrateStrip(host, o) {
  try {
    const { pages, w, h } = await assembledPages(o.index);
    if (!pages.length) { host.innerHTML = `<span class="note">No pages.</span>`; return; }
    host.innerHTML = "";
    const fw = Math.round(112 * (w / h)); // frame width from the page aspect ratio
    pages.forEach((pg, i) => {
      const frame = el(`<button class="frame live" style="width:${fw}px" title="Open — page ${i + 1}"><iframe scrolling="no" tabindex="-1"></iframe><div class="cap">${i + 1}</div></button>`);
      frame.querySelector("iframe").srcdoc = pg.render();
      frame.addEventListener("click", () => assembledViewer(o.index, o.slug, o.pdf, o.image));
      host.append(frame);
    });
  } catch { host.innerHTML = `<span class="note">Preview unavailable.</span>`; }
}

