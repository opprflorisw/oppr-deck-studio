// Social studio: pick an output type, compose it, browse built outputs.
// Phase 6 builds the real carousel/post composers; Phase 2 lays the shell.

import { $, $$, el, esc, decodeEntities, slugify, toast, todayISO } from "../util.js";
import { state } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { assembledViewer, carouselComposerViewer } from "./viewer.js";
import { PATTERNS, blankPage } from "./carousel-build.js";

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
      <div class="subbar"><h1 class="page-title">Social studio</h1>
        <a class="ghost" href="#/social-out" style="margin-left:auto">Built outputs →</a></div>
      <p class="note">Everything here is <b>public</b> by definition — no named-customer material. Pick what to make; the CLI builds it via <span class="mono">/deckbuilder</span>.</p>
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

export function renderOutputs() {
  const outs = (state.index.social || []);
  const wrap = el(`<div><div class="subbar"><h1 class="page-title">Social output</h1></div></div>`);
  if (!outs.length) { wrap.append(el(`<div class="loading">No social outputs indexed yet.</div>`)); return wrap; }
  for (const o of outs) {
    const row = el(`
      <div class="deck-row">
        <div class="head">
          <h3>${esc(o.slug)}</h3>
          <span class="badge">${esc(o.channel)}</span>
          <span class="tags">${esc(o.kind || "")}</span>
          <div class="spacer">
            ${o.index ? `<button class="ghost prev">Preview</button>` : ""}
            ${o.pdf ? `<a class="ghost" href="/repo/${esc(o.pdf)}" download>Download PDF</a>` : ""}
            ${o.post ? `<button class="ghost post">Post text</button>` : ""}
          </div>
        </div>
      </div>`);
    if (o.index) $(".prev", row).addEventListener("click", () => assembledViewer(o.index, o.slug, o.pdf));
    if (o.post) $(".post", row).addEventListener("click", async () => {
      const t = await (await fetch(`/repo/${o.post}`)).text();
      openPreviewText(o.slug + " — post text", t);
    });
    wrap.append(row);
  }
  return wrap;
}

function openPreviewText(title, text) {
  const m = el(`<div class="modal"><div class="box"><header><b>${esc(title)}</b><div class="spacer"></div><button class="ghost close">Close</button></header><pre class="posttext">${esc(text)}</pre></div></div>`);
  $(".close", m).addEventListener("click", () => m.remove());
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
  document.body.append(m);
}
