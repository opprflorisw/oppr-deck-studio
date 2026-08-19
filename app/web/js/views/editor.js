// The fine-tuning editor. Loads an ARTIFACT version — deck, carousel or social
// image, they are one model since Deck Studio 2.0 — into a
// SAME-ORIGIN iframe (served from the local cache) and edits the final DOM with
// three bounded verbs — text in place, layout nudges, image swaps. Every save
// is a new version; the server re-validates that the change is structure-
// preserving (text/attribute only) and rejects anything else with a CLI prompt.
//
// One authoritative document lives in the iframe. Pages are shown one at a time
// by scaling the container and scrolling to the active section. The canvas size
// comes from the artifact's page_format, so a 4:5 carousel scales correctly.
// Saving serializes the entire document, so every page's edits are captured.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";

// Page geometry per format, in CSS pixels. Deck Studio 2.0: the editor is no
// longer deck-only, so the canvas size comes from the artifact's page_format
// instead of being hardcoded to 16:9. These must match templates/deck.css and
// templates/linkedin.css @page, and verifylib.PAGE_FORMATS.
const PAGE_SIZES = {
  "deck-16x9": [1280, 720],
  "linkedin-4x5": [1080, 1350],
  "square-1x1": [1080, 1080],
  "hero-1200x627": [1200, 627],
};
const DEFAULT_PAGE = PAGE_SIZES["deck-16x9"];

// A deck wraps its pages in .deck; a carousel/image wraps them in .carousel.
const PAGE_CONTAINER = ".deck, .carousel";

const NUDGE = ["margin-top", "margin-bottom", "margin-left", "margin-right", "padding-top", "padding-bottom", "gap", "font-size", "line-height", "max-width"];

export async function render(id, mount) {
  mount(el(`<div class="loading">Opening editor…</div>`));
  let data;
  try { data = await api.getDeck(id); }
  catch { return mount(el(`<div class="loading">Backend not reachable. <a href="#/output/masters">Back</a></div>`)); }
  const deck = data.deck;
  const n = deck.current_version_n;
  const [SLIDE_W, SLIDE_H] = PAGE_SIZES[deck.page_format] || DEFAULT_PAGE;
  const pageWord = deck.kind && deck.kind !== "deck" ? "page" : "slide";

  const wrap = el(`
    <div class="editor">
      <div class="editor-bar">
        <button class="ghost icon-only" id="back" title="Back">${icon("prev")}</button>
        <b class="editor-title">${esc(decodeEntities(deck.title))}</b>
        <span class="tags mono">v${n}</span>
        <span class="editor-dirty" id="dirty" hidden>unsaved changes</span>
        <div class="spacer"></div>
        <span class="editor-hint note">Click text to edit · select an element to nudge or swap</span>
        <button class="ghost" id="html" title="Edit this ${pageWord}'s HTML directly">${ibtn("code", "HTML")}</button>
        <button class="ghost" id="discard">${ibtn("close", "Discard")}</button>
        <button class="ghost" id="regen" disabled title="Save first">${ibtn("refresh", "Regenerate")}</button>
        <button class="primary" id="save" disabled>${ibtn("save", "Save version")}</button>
      </div>
      <div class="editor-strip" id="strip"></div>
      <div class="editor-main">
        <div class="editor-stage" id="stage">
          <iframe id="frame" class="editor-frame"></iframe>
        </div>
        <aside class="editor-inspect" id="inspect">
          <p class="note">Select an element in the ${pageWord} to edit it.</p>
        </aside>
        <aside class="editor-source" id="source" hidden>
          <div class="src-head">
            <b>HTML · <span id="src-which">${pageWord} 1</span></b>
            <button class="ghost icon-only" id="src-close" title="Close">${icon("close")}</button>
          </div>
          <p class="note">The live HTML of this ${pageWord}. Edit and Apply to see it
            immediately; Save version writes it as a new version.</p>
          <textarea id="src-text" spellcheck="false"></textarea>
          <div id="src-verdict" class="src-verdict"></div>
          <div class="src-actions">
            <button class="ghost" id="src-revert">Revert</button>
            <button class="primary" id="src-apply">Apply</button>
          </div>
        </aside>
      </div>
    </div>`);

  const st = { dirty: false, active: 0, sections: [], selected: null, edits: { text: 0, nudge: 0, image: 0, html: 0 } };
  const frame = $("#frame", wrap);
  const stage = $("#stage", wrap);
  const inspect = $("#inspect", wrap);

  const markDirty = () => {
    st.dirty = true;
    $("#dirty", wrap).hidden = false;
    $("#save", wrap).disabled = false;
  };

  $("#back", wrap).addEventListener("click", () => leave(() => go("/deck/" + id)));
  $("#discard", wrap).addEventListener("click", () => leave(() => render(id, mount), true));
  $("#save", wrap).addEventListener("click", () => save());
  $("#regen", wrap).addEventListener("click", () => go("/deck/" + id));
  $("#html", wrap).addEventListener("click", () => toggleSource());
  $("#src-close", wrap).addEventListener("click", () => toggleSource(false));
  $("#src-revert", wrap).addEventListener("click", () => loadSource());
  $("#src-apply", wrap).addEventListener("click", () => applySource());

  // ---- HTML source editing --------------------------------------------------
  //
  // The three WYSIWYG verbs cover most fine-tuning, but not everything you can
  // see is reachable by clicking it. This shows the active page's real HTML and
  // writes it straight back into the live document.
  //
  // The wall still holds: the server re-checks every save, so a structural
  // change is rejected there. Rather than let you find that out after typing,
  // the verdict line below the box says so as you type.
  const srcPanel = () => $("#source", wrap);

  function toggleSource(force) {
    const panel = srcPanel();
    const show = force === undefined ? panel.hidden : force;
    panel.hidden = !show;
    $("#inspect", wrap).hidden = show;
    $("#html", wrap).classList.toggle("active", show);
    if (show) loadSource();
  }

  function activeSection() {
    return st.sections[st.active] || null;
  }

  function loadSource() {
    const sec = activeSection();
    if (!sec) return;
    $("#src-which", wrap).textContent = `${pageWord} ${st.active + 1}`;
    $("#src-text", wrap).value = formatHtml(sec.outerHTML);
    $("#src-text", wrap).dataset.original = sec.outerHTML;
    verdict();
  }

  // Compare the tag skeleton of what is typed against what is there. This is the
  // same question the server's fingerprint asks, answered early and locally.
  function verdict() {
    const box = $("#src-verdict", wrap);
    const text = $("#src-text", wrap).value;
    const original = $("#src-text", wrap).dataset.original || "";
    let parsed;
    try {
      parsed = new DOMParser().parseFromString(text, "text/html").body.firstElementChild;
    } catch { parsed = null; }
    if (!parsed) {
      box.className = "src-verdict bad";
      box.textContent = "That is not valid HTML yet.";
      return false;
    }
    const same = skeleton(parsed.outerHTML) === skeleton(original);
    box.className = "src-verdict " + (same ? "ok" : "warn");
    box.textContent = same
      ? "Text and attributes only. This will save."
      : "This changes the structure, so the save will be refused and sent to the CLI.";
    return true;
  }
  $("#src-text", wrap).addEventListener("input", verdict);

  function applySource() {
    const sec = activeSection();
    if (!sec || !verdict()) return;
    const text = $("#src-text", wrap).value;
    const parsed = new DOMParser().parseFromString(text, "text/html").body.firstElementChild;
    if (!parsed) return toast("Could not parse that HTML.");
    const doc = idoc();
    const imported = doc.importNode(parsed, true);
    sec.replaceWith(imported);
    // The node list is now stale — re-read it from the live document.
    const deckEl = doc.querySelector(PAGE_CONTAINER);
    st.sections = [...deckEl.children].filter((c) => c.tagName === "SECTION");
    st.selected = null;
    st.edits.html++;
    markDirty();
    layout();
    showSlide(st.active);
    loadSource();
    toast("Applied.");
  }

  function leave(then, force) {
    if (st.dirty && !force && !confirm("Discard unsaved changes?")) return;
    then();
  }

  // Load the materialized version (the /view URL materializes then redirects to
  // the same-origin cache index.html).
  frame.src = api.deckViewUrl(id, n);
  frame.addEventListener("load", () => setup());

  function idoc() { return frame.contentDocument; }

  function setup() {
    const doc = idoc();
    if (!doc) return;
    const deckEl = doc.querySelector(PAGE_CONTAINER);
    if (!deckEl) { inspect.innerHTML = `<p class="note">Could not read this artifact: no .deck or .carousel container.</p>`; return; }
    st.sections = [...deckEl.children].filter((c) => c.tagName === "SECTION");

    // scale the whole deck so one slide fills the stage; scroll to the active one
    injectEditorStyle(doc);
    layout();
    buildStrip();
    wireSelection(doc);
    showSlide(0);
    window.addEventListener("resize", layout);
  }

  function layout() {
    const doc = idoc(); if (!doc) return;
    const deckEl = doc.querySelector(PAGE_CONTAINER);
    // Fit BOTH dimensions. Scaling on width alone was fine while every artifact
    // was 16:9, but a 4:5 carousel is taller than it is wide, so a width-only
    // scale renders it at full height and it overflows the stage.
    const scale = Math.min(
      1,
      (stage.clientWidth - 40) / SLIDE_W,
      (stage.clientHeight - 40) / SLIDE_H,
    );
    deckEl.style.transformOrigin = "top left";
    deckEl.style.transform = `scale(${scale})`;
    doc.body.style.height = `${SLIDE_H * st.sections.length * scale}px`;
    doc.__scale = scale;
    scrollToActive();
  }

  function scrollToActive() {
    const doc = idoc(); if (!doc || !doc.__scale) return;
    doc.documentElement.scrollTop = st.active * SLIDE_H * doc.__scale;
  }

  function buildStrip() {
    const strip = $("#strip", wrap);
    strip.innerHTML = st.sections.map((s, i) =>
      `<button class="ed-dot ${i === 0 ? "active" : ""}" data-i="${i}" title="${esc(s.getAttribute("data-slide-id") || i + 1)}">${i + 1}<span class="ed-of" data-of="${i}" hidden>!</span></button>`).join("");
    $$(".ed-dot", strip).forEach((b) => b.addEventListener("click", () => showSlide(+b.dataset.i)));
  }

  function showSlide(i) {
    st.active = i;
    $$(".ed-dot", wrap).forEach((d, k) => d.classList.toggle("active", k === i));
    scrollToActive();
    checkOverflow();
  }

  function wireSelection(doc) {
    doc.addEventListener("click", (e) => {
      const target = e.target.closest("*");
      if (!target || target === doc.body || (target.classList.contains("deck") || target.classList.contains("carousel"))) return;
      select(target);
    }, true);
  }

  function select(node) {
    const doc = idoc();
    if (st.selected) st.selected.classList.remove("__ed-sel");
    st.selected = node;
    node.classList.add("__ed-sel");
    renderInspector(node);
  }

  function renderInspector(node) {
    const tag = node.tagName.toLowerCase();
    const slot = node.getAttribute("data-slot");
    const isImg = tag === "img";
    const isText = isTextEditable(node);
    inspect.innerHTML = `
      <div class="insp-crumb mono">${esc(breadcrumb(node))}</div>
      ${slot ? `<div class="insp-slot">slot: ${esc(slot)}</div>` : ""}
      ${isText ? `<button class="ghost full" id="edit-text">${ibtn("compose", "Edit text")}</button>` : ""}
      ${isImg ? `<button class="ghost full" id="swap-img">${ibtn("image", "Swap image")}</button>` : ""}
      <div class="section-head"><h3>Nudge</h3></div>
      <div class="insp-nudge" id="nudge"></div>
    `;
    if (isText) $("#edit-text", inspect).addEventListener("click", () => beginTextEdit(node));
    if (isImg) $("#swap-img", inspect).addEventListener("click", () => swapImage(node));
    const nb = $("#nudge", inspect);
    for (const prop of NUDGE) nb.append(nudgeControl(node, prop));
  }

  function nudgeControl(node, prop) {
    const cur = node.style.getPropertyValue(prop) || "";
    const c = el(`<div class="nudge-row"><label>${esc(prop)}</label>
      <button class="ghost icon-only dn">−</button><span class="nudge-val mono">${esc(cur || "·")}</span><button class="ghost icon-only up">+</button></div>`);
    const step = (dir, big) => {
      const unit = prop === "line-height" ? "" : "px";
      let val = parseFloat(node.style.getPropertyValue(prop));
      if (isNaN(val)) {
        const cs = frame.contentWindow.getComputedStyle(node);
        val = parseFloat(cs.getPropertyValue(prop)) || 0;
      }
      const inc = prop === "line-height" ? 0.05 : (big ? 12 : 4);
      val = clampProp(prop, val + dir * inc);
      node.style.setProperty(prop, prop === "line-height" ? String(val) : val + "px");
      $(".nudge-val", c).textContent = node.style.getPropertyValue(prop);
      st.edits.nudge++; markDirty(); checkOverflow();
    };
    $(".up", c).addEventListener("click", (e) => step(1, e.shiftKey));
    $(".dn", c).addEventListener("click", (e) => step(-1, e.shiftKey));
    return c;
  }

  function beginTextEdit(node) {
    node.setAttribute("contenteditable", "true");
    node.classList.add("__ed-editing");
    node.focus();
    // place caret at end
    const doc = idoc();
    const range = doc.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = frame.contentWindow.getSelection();
    sel.removeAllRanges(); sel.addRange(range);

    const onKey = (e) => { if (e.key === "Enter") e.preventDefault(); }; // no newlines -> no injected tags
    const onPaste = (e) => {
      e.preventDefault();
      const text = (e.clipboardData || frame.contentWindow.clipboardData).getData("text").replace(/[\r\n]+/g, " ");
      doc.execCommand("insertText", false, text.replace(/—/g, "–"));
    };
    const onInput = () => {
      if (node.textContent.includes("—")) {
        node.textContent = node.textContent.replace(/—/g, "–");
        toast("em dash replaced (brand rule)");
      }
      st.edits.text++; markDirty();
    };
    const finish = () => {
      node.removeAttribute("contenteditable");
      node.classList.remove("__ed-editing");
      node.removeEventListener("keydown", onKey);
      node.removeEventListener("paste", onPaste);
      node.removeEventListener("input", onInput);
      node.removeEventListener("blur", finish);
      checkOverflow();
    };
    node.addEventListener("keydown", onKey);
    node.addEventListener("paste", onPaste);
    node.addEventListener("input", onInput);
    node.addEventListener("blur", finish);
  }

  async function swapImage(node) {
    const allowed = new Set([...(deck.allowed_entitlements || []), "public"]);
    const pick = await imagePicker(allowed);
    if (!pick) return;
    try {
      const out = await api.registerDeckAsset(id, "brand/img/" + pick, n);
      // out.filename is "assets/<file>"; the agent dropped it into this version's cache
      node.setAttribute("src", out.filename);
      st.edits.image++; markDirty(); checkOverflow();
      toast("Image swapped.");
    } catch (e) { toast(e.message || "swap failed"); }
  }

  function imagePicker(allowed) {
    return new Promise((resolve) => {
      const imgs = (state.index.images || []).filter((im) => allowed.has(im.entitlement || "public"));
      const m = el(`<div class="modal"><div class="modal-box">
        <header><b>Swap image</b><button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
        <div class="modal-body"><div class="img-picker">${imgs.map((im) =>
          `<button class="img-pick" data-file="${esc(im.file)}"><img src="/repo/brand/img/${esc(im.file)}" alt="" loading="lazy"><span class="note">${esc(im.file.split("/").pop())}</span></button>`).join("")}</div></div>
      </div></div>`);
      const done = (v) => { m.remove(); resolve(v); };
      $(".close", m).addEventListener("click", () => done(null));
      m.addEventListener("click", (e) => { if (e.target === m) done(null); });
      $$(".img-pick", m).forEach((b) => b.addEventListener("click", () => done(b.dataset.file)));
      document.body.append(m);
    });
  }

  function checkOverflow() {
    const doc = idoc(); if (!doc) return;
    st.sections.forEach((sec, i) => {
      const over = sec.scrollHeight > sec.clientHeight + 2 || sec.scrollWidth > sec.clientWidth + 2;
      const badge = $(`.ed-of[data-of="${i}"]`, wrap);
      if (badge) badge.hidden = !over;
    });
    const overAny = st.sections.some((s) => s.scrollHeight > s.clientHeight + 2);
    $(".editor-hint", wrap).classList.toggle("warn", overAny);
  }

  async function save() {
    const doc = idoc();
    // strip every editor-only artefact before serializing, so the saved document
    // is structurally identical to the stored version (the server enforces this).
    doc.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    doc.querySelectorAll(".__ed-sel, .__ed-editing").forEach((n) => n.classList.remove("__ed-sel", "__ed-editing"));
    // an element that had no class but got a selection class now has class="" —
    // drop it, or the fingerprint would see an added `class` attribute.
    doc.querySelectorAll("[class]").forEach((n) => { if (!n.getAttribute("class").trim()) n.removeAttribute("class"); });
    // Same for style: the layout code sets and clears body/container styles, and
    // an emptied style="" is an added attribute as far as the fingerprint is
    // concerned — and pure noise in the saved document.
    doc.querySelectorAll("[style]").forEach((n) => { if (!n.getAttribute("style").trim()) n.removeAttribute("style"); });
    const styleTag = doc.getElementById("__ed-style");
    if (styleTag) styleTag.remove();
    const deckEl = doc.querySelector(PAGE_CONTAINER);
    const savedTransform = deckEl.style.transform; deckEl.style.transform = "";
    const savedH = doc.body.style.height; doc.body.style.height = "";
    st.selected = null;

    const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

    // restore live view styles
    injectEditorStyle(doc);
    deckEl.style.transform = savedTransform; doc.body.style.height = savedH;

    const parts = [];
    if (st.edits.text) parts.push(`text ×${st.edits.text}`);
    if (st.edits.nudge) parts.push(`nudge ×${st.edits.nudge}`);
    if (st.edits.image) parts.push(`image ×${st.edits.image}`);
    if (st.edits.html) parts.push(`html ×${st.edits.html}`);
    const note = parts.join(", ") || "fine-tune";
    try {
      const out = await api.saveDeckVersion(id, html, note);
      st.dirty = false; $("#dirty", wrap).hidden = true;
      $("#save", wrap).disabled = true; $("#regen", wrap).disabled = false; $("#regen", wrap).title = "";
      toast(`Saved v${out.n}.`);
      await loadBackend(api);
    } catch (e) {
      if (e.message && /structural/i.test(e.message)) return structuralModal();
      toast(e.message || "save failed");
    }
  }

  function structuralModal() {
    const m = el(`<div class="modal"><div class="modal-box">
      <header><b>This change needs the CLI</b><button class="ghost icon-only close">${icon("close")}</button></header>
      <div class="modal-body">
        <p>The edit changed the slide's structure — an element was added, removed, or restyled beyond a nudge.
        Editing here covers text, spacing and image swaps; the shape of a slide belongs to the slide,
        and changing it would change every deck that uses it.</p>
        <p class="note">Undo the structural part and save just the text and spacing.
        If the slide itself needs to change, an owner does that in the library.</p>
      </div>
    </div></div>`);
    const close = () => m.remove();
    $(".close", m).addEventListener("click", close);
    m.addEventListener("click", (e) => { if (e.target === m) close(); });
    document.body.append(m);
  }

  mount(wrap);
}

// ---- helpers ----------------------------------------------------------------

function injectEditorStyle(doc) {
  if (doc.getElementById("__ed-style")) return;
  const s = doc.createElement("style");
  s.id = "__ed-style";
  s.textContent = `
    .__ed-sel { outline: 2px solid #a65032 !important; outline-offset: 1px; cursor: text; }
    .__ed-editing { outline: 2px dashed #a65032 !important; }
    * { cursor: default; }
    p,h1,h2,h3,h4,span,li,td,th,div { cursor: pointer; }`;
  doc.head.appendChild(s);
}

function isTextEditable(node) {
  const tag = node.tagName.toLowerCase();
  if (["img", "svg", "section", "html", "body"].includes(tag)) return false;
  const kids = [...node.children];
  return kids.every((c) => ["b", "i", "em", "strong", "span", "br"].includes(c.tagName.toLowerCase()));
}

function breadcrumb(node) {
  const parts = [];
  let n = node;
  while (n && !(n.classList.contains("deck") || n.classList.contains("carousel")) && parts.length < 4) {
    parts.unshift(n.tagName.toLowerCase());
    n = n.parentElement;
  }
  return parts.join(" › ");
}

// The tag skeleton: element names and nesting, with all text and attribute
// VALUES dropped. Two documents with the same skeleton differ only in content,
// which is exactly what the server's save gate allows.
function skeleton(html) {
  return (html.match(/<\/?[a-zA-Z][^\s/>]*/g) || []).join("").toLowerCase();
}

// Put each tag on its own line so the source is readable in a textarea. Purely
// cosmetic: it is re-parsed before anything is applied, so the indentation never
// reaches the saved document.
function formatHtml(html) {
  const out = [];
  let depth = 0;
  for (const part of html.replace(/>\s*</g, ">\n<").split("\n")) {
    const line = part.trim();
    if (!line) continue;
    if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
    out.push("  ".repeat(depth) + line);
    const opens = /^<[^/!]/.test(line) && !/\/>$/.test(line) && !/<\/[a-zA-Z]/.test(line)
      && !/^<(br|img|input|hr|meta|link|source)\b/i.test(line);
    if (opens) depth++;
  }
  return out.join("\n");
}

function clampProp(prop, v) {
  if (prop === "font-size") return Math.max(9, Math.min(120, v));
  if (prop === "line-height") return Math.max(0.9, Math.min(2, v));
  return Math.max(-200, Math.min(2000, v));
}
