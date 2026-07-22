// Version history for a slide fragment (git-backed). The server endpoint lands
// in Phase 3; until then this panel degrades gracefully.

import { $, $$, el, esc } from "../util.js";
import * as api from "../api.js";
import { previewFrame, fetchFragment } from "../preview.js";

export function historySection(id) {
  const box = el(`
    <div class="panel history">
      <h2>Version history</h2>
      <div id="hist-list"><p class="note">Loading history…</p></div>
      <div id="hist-preview"></div>
    </div>`);

  api.slideHistory(id).then((data) => {
    const commits = data.commits || [];
    const listEl = $("#hist-list", box);
    if (!commits.length) { listEl.innerHTML = `<p class="note">Only one version so far.</p>`; return; }
    listEl.innerHTML = `
      <p class="note">${commits.length} commit(s) touch this slide. Click one to preview that version.</p>
      <ul class="hist-ul">
        ${commits.map((c, i) => `
          <li data-hash="${esc(c.hash)}">
            <span class="hist-date mono">${esc(c.date)}</span>
            <span class="hist-subj">${esc(c.subject)}</span>
            <span class="hist-hash mono">${esc(c.hash.slice(0, 7))}</span>
            ${i === 0 ? `<span class="chip sm">current</span>` : ""}
          </li>`).join("")}
      </ul>
      <label class="compare-toggle"><input type="checkbox" id="cmp"> compare with current</label>`;
    $$("li[data-hash]", box).forEach((li) => li.addEventListener("click", () => {
      $$("li[data-hash]", box).forEach((x) => x.classList.remove("sel"));
      li.classList.add("sel");
      showVersion(box, id, li.dataset.hash);
    }));
  }).catch(() => {
    $("#hist-list", box).innerHTML = `<p class="note">History is unavailable (needs the git-backed server endpoint).</p>`;
  });

  return box;
}

function showVersion(box, id, hash) {
  const col = $("#hist-preview", box);
  col.innerHTML = "";
  const compare = $("#cmp", box)?.checked;
  const old = api.slideVersion(id, hash);
  if (compare) {
    const row = el(`<div class="compare-row"></div>`);
    const a = el(`<div><div class="cmp-label">this version</div></div>`);
    const b = el(`<div><div class="cmp-label">current</div></div>`);
    a.append(previewFrame(old, 340));
    b.append(previewFrame(fetchFragment(id), 340));
    row.append(a, b);
    col.append(row);
  } else {
    col.append(previewFrame(old, 560));
  }
}
