// Design system: every specimen rendered inline and scrollable (no click-through),
// grouped by foundations / blocks / patterns. Stays in the Library.

import { $, $$, el, esc } from "../util.js";
import { state } from "../state.js";

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
          <div class="ds-spec-label mono">${esc(s.name)}</div>
          <iframe class="ds-spec-frame" src="/repo/${esc(s.path)}" scrolling="no" loading="lazy"></iframe>
        </div>`);
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
