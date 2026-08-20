// Design system: every specimen rendered inline and scrollable (no click-through),
// grouped by foundations / blocks / patterns. Stays in the Library.

import { $, $$, el, esc , backdropClose } from "../util.js";
import { state } from "../state.js";
import { icon } from "../icons.js";
import { downloadPanel } from "../download.js";

export function render() {
  const specs = state.index.design_system || [];
  const wrap = el(`
    <div>
      <div class="subbar">
        <a class="ghost" href="#/knowledge/philosophy" style="margin-left:auto">Design philosophy</a>
      </div>
      <p class="note">Every block specimen, rendered from the real stylesheets. A new slide or carousel composes only from these. Scroll to browse.</p>
      <div class="ds-jump" id="ds-jump"></div>
      <div id="ds-body"></div>
    </div>`);

  if (!specs.length) {
    $("#ds-body", wrap).innerHTML = `<div class="loading">No specimens indexed. Run the design-system build, then Refresh.</div>`;
    return wrap;
  }

  const groups = [...new Set(specs.map((s) => s.group))];
  $("#ds-jump", wrap).innerHTML = groups.map((g) => `<a href="#/design-system" data-jump="${esc(g)}">${esc(g)}</a>`).join("");
  const body = $("#ds-body", wrap);

  for (const g of groups) {
    const anchor = el(`<div class="ds-group" id="ds-${esc(g)}"></div>`);
    anchor.append(el(`<div class="section-head"><h2>${esc(g)}</h2><span class="section-count">${specs.filter((s) => s.group === g).length}</span></div>`));
    for (const s of specs.filter((x) => x.group === g)) {
      const card = el(`
        <div class="ds-spec">
          <div class="ds-spec-label mono">${esc(s.name)}
            <button class="ghost sm ds-dl" data-id="${esc(s.name)}" title="Download this block on its own">${icon("download", 14)}</button>
          </div>
          <iframe class="ds-spec-frame" src="/repo/${esc(s.path)}" scrolling="no" loading="lazy"></iframe>
        </div>`);
      $(".ds-dl", card).addEventListener("click", () => openBlockDownload(s.name));
      const frame = $("iframe", card);
      const fit = () => {
        try {
          const h = frame.contentDocument.body.scrollHeight;
          if (h) frame.style.height = h + "px";
        } catch {}
      };
      frame.addEventListener("load", () => { fit(); setTimeout(fit, 150); });
      anchor.append(card);
    }
    body.append(anchor);
  }

  $$("[data-jump]", wrap).forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const t = $("#ds-" + a.dataset.jump, wrap);
    if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  return wrap;
}

// A block specimen can be taken on its own: same exporter as a slide, so what
// you get is the block rendered from the real stylesheets, not a bare fragment.
function openBlockDownload(name) {
  const m = el(`<div class="modal"><div class="modal-box">
    <header><b>Download ${esc(name)}</b><button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body" id="dl-host"></div>
  </div></div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  $("#dl-host", m).append(downloadPanel("block", name));
  document.body.append(m);
}
