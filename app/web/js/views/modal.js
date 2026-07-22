// Shared full-screen preview modal (iframe onto an assembled deck / output).

import { $, el, esc } from "../util.js";

export function openPreview(src, title) {
  const m = el(`
    <div class="modal">
      <div class="box">
        <header><b>${esc(title)}</b><div class="spacer"></div><button class="ghost close">Close</button></header>
        <iframe src="${esc(src)}"></iframe>
      </div>
    </div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  document.addEventListener("keydown", function esc2(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc2); } });
  document.body.append(m);
}
