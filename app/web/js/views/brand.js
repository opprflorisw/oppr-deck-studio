// Brand: the shareable logo kit. Lives in the Library because it is a library
// element like the slides and the icon set — the difference is that this one is
// meant to leave the building, so every asset here is safe to hand to someone
// outside Oppr without a font install or a caveat.
//
// The whole view is driven by brand/kit/kit.json, which tools/build-brand-kit.py
// writes alongside the assets and the standalone page. Nothing about the kit is
// described twice: add a file to the generator and it appears here.

import { $, $$, el, esc, toast } from "../util.js";
import { icon } from "../icons.js";
import * as api from "../api.js";

const KIT = "/repo/brand/kit";

export function render() {
  const wrap = el(`
    <div>
      <div class="subbar">
        <div class="filters">
          <a class="ghost accent" href="${KIT}/oppr-brand-kit.zip" download>${icon("download", 15)}<span>Download the brand kit</span></a>
          <a class="ghost" href="${KIT}/index.html" target="_blank" rel="noopener">${icon("open", 15)}<span>Open the full page</span></a>
        </div>
      </div>
      <p class="note">The Oppr logo, ready to share. The <b>outlined</b> wordmarks are paths
        rather than live text, so they render identically for someone with no brand font
        installed. Click any file to download it. Built by
        <span class="mono">tools/build-brand-kit.py</span>.</p>
      <p class="note">This is the logo on its own. <b>Design kit</b>, above, is the whole
        visual system in one zip: this brand kit plus the icon set, every design-system
        specimen and the fonts, with an offline viewer. That is the one to send someone
        who has to design something.</p>
      <div id="bk-body"><div class="loading">Loading the brand kit…</div></div>
    </div>`);

  load($("#bk-body", wrap));
  return wrap;
}

async function load(host) {
  let kit;
  try {
    const res = await api.authedFetch(`${KIT}/kit.json`);
    if (!res.ok) throw new Error(String(res.status));
    kit = await res.json();
  } catch {
    host.innerHTML = `<div class="loading">No brand kit found. Run
      <span class="mono">python tools/build-brand-kit.py</span>, then Refresh.</div>`;
    return;
  }

  host.innerHTML = "";
  for (const group of kit.groups) host.append(groupBlock(group, kit));
  host.append(clearSpaceBlock(kit));
  host.append(coloursBlock(kit));
  host.append(typeBlock(kit));
}

// One heading + its cards + a download row per file. A PNG is listed under the
// asset it was actually rendered from (kit.json records that), so the originals
// never appear to offer PNGs that were made from the outlined files.
function groupBlock(group, kit) {
  const tag = group.recommended
    ? `<span class="bk-tag bk-tag--rec">use this</span>`
    : `<span class="bk-tag bk-tag--leg">legacy</span>`;
  const node = el(`
    <div class="bk-group">
      <div class="section-head"><h2>${esc(group.title)}${tag}</h2></div>
      <p class="bk-note">${esc(group.note)}</p>
      <div class="bk-cards"></div>
    </div>`);

  const cards = $(".bk-cards", node);
  for (const item of group.items) {
    const pngs = (kit.png || []).filter((p) => p.from === item.file);
    const card = el(`
      <div class="bk-card">
        <div class="bk-stage ${item.bg === "ink" ? "bk-stage--ink" : ""}">
          <img src="${KIT}/assets/${esc(item.file)}" alt="${esc(item.label)}">
        </div>
        <div class="bk-meta">
          <div class="bk-label">${esc(item.label)}</div>
          <div class="bk-files">
            <a class="bk-pill" href="${KIT}/assets/${esc(item.file)}" download>${esc(item.file)}</a>
            ${pngs.map((p) => `<a class="bk-pill bk-pill--png" href="${KIT}/assets/${esc(p.file)}" download>${p.w}px</a>`).join("")}
          </div>
        </div>
      </div>`);
    cards.append(card);
  }
  return node;
}

function clearSpaceBlock(kit) {
  const { tight_box: box, clear_space: clear } = kit.wordmark;
  const shown = 220;
  const pad = (clear / box.w) * shown;
  const node = el(`
    <div class="bk-group">
      <div class="section-head"><h2>Clear space</h2></div>
      <p class="bk-note">Keep at least the height of the <b>o</b> clear on every side.
        The dashed line is the minimum, not a border to draw.</p>
      <div class="bk-cards">
        <div class="bk-card">
          <div class="bk-stage">
            <span class="bk-clear" style="padding:${pad.toFixed(1)}px">
              <img src="${KIT}/assets/wordmark-light-outline.svg" alt="" style="width:${shown}px;display:block">
            </span>
          </div>
        </div>
      </div>
    </div>`);
  return node;
}

function coloursBlock(kit) {
  const node = el(`
    <div class="bk-group">
      <div class="section-head"><h2>Colours</h2></div>
      <p class="bk-note">One accent per element. No gradients, and no shadows on the mark.
        Click a value to copy it.</p>
      <div class="bk-swatches">
        ${kit.colours.map((c) => `
          <button class="bk-swatch" data-hex="${esc(c.hex)}">
            <span class="bk-chip" style="background:${esc(c.hex)}"></span>
            <span class="bk-swatch-t">
              <b class="mono">${esc(c.name)}</b>
              <span class="mono">${esc(c.hex)}</span>
              <em>${esc(c.note)}</em>
            </span>
          </button>`).join("")}
      </div>
    </div>`);
  $$("[data-hex]", node).forEach((b) => b.addEventListener("click", () => {
    navigator.clipboard.writeText(b.dataset.hex);
    toast(`Copied ${b.dataset.hex}`);
  }));
  return node;
}

function typeBlock(kit) {
  const w = kit.wordmark;
  return el(`
    <div class="bk-group">
      <div class="section-head"><h2>Type &amp; geometry</h2></div>
      <p class="bk-note"><b>Archivo</b> ${w.weight}, lowercase, letter-spacing -0.04em for the
        wordmark. <b>JetBrains Mono</b> for eyebrows, labels and numbers. Keep the wordmark
        lowercase and the terracotta period intact.</p>
      <p class="bk-spec mono">
        Wordmark &middot; Archivo ${w.weight} at ${w.font_size}px, letter-spacing ${w.letter_spacing}<br>
        Outlined artboard &middot; ${w.tight_box.w} &times; ${w.tight_box.h} units, cropped to the mark<br>
        Clear space &middot; ${w.clear_space} units (the height of the o)
      </p>
    </div>`);
}
