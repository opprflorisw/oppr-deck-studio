// The artifact note: one line you write about a deck or a post so you can find
// it again later.
//
// Written and read in the list, because a note you have to open the artifact to
// read cannot help you decide which artifact to open. Edited in place rather
// than in a modal for the same reason: it is one line about one row. Saving it
// does not make a version — it is a label on the artifact, not content in it.
//
// Its own module rather than a helper inside the list view, because the deck
// page uses it too and the two must behave identically.

import { $, esc, toast } from "./util.js";
import { icon } from "./icons.js";
import * as api from "./api.js";

export function mountNote(root, d, { placeholder = "Add a note…" } = {}) {
  const slot = $(".row-note", root);
  if (!slot) return;

  const show = () => {
    const empty = !d.note;
    slot.innerHTML = `<button class="notetext ${empty ? "is-empty" : ""}" title="${empty ? "Click to add a note" : "Click to edit"}">
      ${icon("compose", 13)}<span>${esc(empty ? placeholder : d.note)}</span></button>`;
    $("button", slot).addEventListener("click", (e) => { e.stopPropagation(); edit(); });
  };

  const edit = () => {
    slot.innerHTML = `<input class="noteinput" type="text" maxlength="500" placeholder="${esc(placeholder)}" value="${esc(d.note || "")}">`;
    const input = $("input", slot);
    input.addEventListener("click", (e) => e.stopPropagation());
    // Enter and blur both commit, Escape abandons. `done` stops the blur that
    // follows Enter from committing a second time.
    let done = false;
    const commit = async (save) => {
      if (done) return;
      done = true;
      const next = input.value.trim();
      if (!save || next === (d.note || "")) return show();
      d.note = next;
      show();
      try { await api.patchDeck(d.id, { note: next }); }
      catch (err) { toast(err.message || "could not save the note"); }
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") commit(true);
      if (e.key === "Escape") commit(false);
    });
    input.addEventListener("blur", () => commit(true));
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  show();
}
