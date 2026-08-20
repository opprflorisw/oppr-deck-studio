// Rename an artifact: the title, and the middle of its filename (2026-08-20).
//
// There were two of these — one on the deck page with a live filename preview
// and the master naming rules, one on the publication page without the preview.
// Same dialog, same endpoint, already drifting: exactly the shape that ends with
// two answers to one question. This is the single implementation, and what
// varies by kind is stated rather than forked.
//
// The split of ownership is the point: the title is yours entirely, the filename
// is yours in the MIDDLE only. The date, the `oppr` token and the client slug
// stay system-owned because verify FAILs a PDF that is missing them, and a
// rename must never be able to defeat a gate.

import { $, el, esc, decodeEntities, toast, backdropClose } from "./util.js";
import { loadBackend } from "./state.js";
import * as api from "./api.js";
import { icon } from "./icons.js";

// An article ships no file at all — its long form is copied into LinkedIn's
// editor — so offering to name a download would be naming something that never
// exists.
const SHIPS_A_FILE = (deck) => deck.kind !== "article";

// The filename the backend will build, mirrored here so you see the result
// before you commit to it. Same rule as `pdfNameFor` on the server.
function previewName(deck, core) {
  const clean = String(core || "").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");
  if (deck.is_master) return `oppr_${clean || deck.type}.pdf`;
  const dm = /^(\d{4}-\d{2}-\d{2})[_-](.+)$/.exec(deck.slug);
  const parts = [];
  if (dm) parts.push(dm[1]);
  parts.push("oppr");
  const body = clean || (dm ? dm[2] : deck.slug);
  if (body && body !== "oppr") parts.push(body);
  if (deck.client_slug && !parts.join("-").includes(deck.client_slug)) parts.push(deck.client_slug);
  return parts.join("_") + ".pdf";
}

// deck: the artifact row. onDone() runs after a successful rename.
export function openRename(deck, onDone) {
  const named = SHIPS_A_FILE(deck);
  const m = el(`
    <div class="modal">
      <div class="modal-box">
        <header><b>Rename</b>
          <div class="spacer"></div>
          <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
        <div class="modal-body">
          <div class="field"><label for="r-title">Title</label>
            <input id="r-title" type="text" value="${esc(decodeEntities(deck.title))}" maxlength="200"></div>
          <div class="field"><label for="r-core">Filename</label>
            <input id="r-core" type="text" value="${esc(deck.pdf_core || "")}"
                   placeholder="leave empty to derive from the slug"></div>
          ${named
            ? `<p class="note">Result: <span class="mono" id="r-preview"></span></p>
               <p class="note">You choose the middle segment. The date, <span class="mono">oppr</span>
                 and the client slug stay automatic, because verify fails a file that is missing them.</p>`
            : `<p class="note">An article ships no file — its text is copied into LinkedIn's article
                 editor — so the filename only shows up if it is ever exported.</p>`}
          <div class="modal-actions"><button class="primary" id="r-save">Save</button></div>
        </div>
      </div>
    </div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  if (named) {
    const paint = () => { $("#r-preview", m).textContent = previewName(deck, $("#r-core", m).value); };
    $("#r-core", m).addEventListener("input", paint);
    // Painted up front, not only after the first keystroke: the dialog must show
    // the resulting name before you touch anything.
    paint();
  }

  $("#r-save", m).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const out = await api.renameDeck(deck.id, {
        title: $("#r-title", m).value,
        pdf_core: $("#r-core", m).value,
      });
      close();
      await loadBackend(api);
      toast(named && out.pdf_name ? `Renamed. The file will be ${out.pdf_name}` : "Renamed.");
      onDone?.();
    } catch (err) {
      toast(err.message || "rename failed");
      btn.disabled = false;
    }
  });

  document.body.append(m);
  setTimeout(() => $("#r-title", m).focus(), 30);
}
