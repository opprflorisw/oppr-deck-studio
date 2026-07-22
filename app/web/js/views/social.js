// Social studio: pick an output type, compose it, browse built outputs.
// Phase 6 builds the real carousel/post composers; Phase 2 lays the shell.

import { $, $$, el, esc, decodeEntities } from "../util.js";
import { state } from "../state.js";
import { go } from "../router.js";
import { openPreview } from "./modal.js";

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
  // Carousel + post get real composers in Phase 6; this is the Phase 2 shell.
  const wrap = el(`
    <div>
      <div class="detail-head"><button class="ghost" id="back">&larr; Social studio</button><h1>${esc(meta.label)}</h1></div>
      <div class="panel" style="max-width:720px">
        <p class="note">The ${esc(meta.label)} composer arrives in Phase 6. It will save a social draft to
        <span class="mono">social/drafts/&lt;slug&gt;/draft.json</span> and hand off with
        <span class="mono">/deckbuilder build social &lt;slug&gt;</span>.</p>
        <p class="note">Best practice for this format: <a href="#/knowledge/best-practices/linkedin-${esc(kind)}">knowledge / best-practices</a>.</p>
      </div>
    </div>`);
  $("#back", wrap).addEventListener("click", () => go("/social"));
  return wrap;
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
            ${o.pdf ? `<a class="ghost" href="/repo/${esc(o.pdf)}" target="_blank">PDF</a>` : ""}
            ${o.index ? `<button class="ghost prev">Preview</button>` : ""}
            ${o.post ? `<button class="ghost post">Post text</button>` : ""}
          </div>
        </div>
      </div>`);
    if (o.index) $(".prev", row).addEventListener("click", () => openPreview(`/repo/${o.index}`, o.slug));
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
