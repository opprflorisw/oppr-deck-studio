// Recording that a deck went out (2026-08-20).
//
// This used to be a browser `prompt()` on the customer page — the one native
// dialog left in the app. It could take exactly one string, so the note and the
// date the endpoint already accepts were unreachable, and it lived only on the
// customer page: the moment you actually send a deck is right after downloading
// the PDF on the DECK page, where there was no way to record it at all.
//
// A send is an EVENT pinned to (deck, version). That is what makes "they have
// v1, we are on v3" answerable, so the version is stated here rather than
// assumed, and an older version can be chosen when the PDF you attached to that
// mail was not today's.

import { $, el, esc, decodeEntities, toast, todayISO, backdropClose } from "./util.js";
import * as api from "./api.js";
import { icon, ibtn } from "./icons.js";

// deck: needs id, title, current_version_n. onDone() runs after a successful
// record, so the caller can refresh whatever list it is showing.
export function openRecordSent(deck, onDone) {
  const cur = deck.current_version_n || 1;
  // Versions newest first: the one you just downloaded is the one you sent,
  // almost always, so it is the default and the top of the list.
  const versions = Array.from({ length: cur }, (_, i) => cur - i);

  const m = el(`
    <div class="modal">
      <div class="modal-box">
        <header><b>Record that it went out</b>
          <div class="spacer"></div>
          <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
        <div class="modal-body">
          <p class="note">${esc(decodeEntities(deck.title))}</p>
          <div class="field"><label for="rs-who">Who did it go to?</label>
            <input id="rs-who" type="text" maxlength="200" placeholder="Name, or the company's team">
          </div>
          <div class="field"><label for="rs-note">Note (optional)</label>
            <input id="rs-note" type="text" maxlength="500" placeholder="After the plant visit, with the pricing page">
          </div>
          <div class="rs-row">
            <div class="field"><label for="rs-when">When</label>
              <input id="rs-when" type="date" value="${esc(todayISO())}"></div>
            <div class="field"><label for="rs-ver">Which version</label>
              <select id="rs-ver">${versions.map((n) =>
                `<option value="${n}">v${n}${n === cur ? " (current)" : ""}</option>`).join("")}</select></div>
          </div>
          <p class="note">Pinned to the version, so later you can tell whether what they hold is
            still what the deck says.</p>
          <div class="modal-actions">
            <button class="primary" id="rs-save">${ibtn("save", "Record it")}</button>
          </div>
        </div>
      </div>
    </div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  m.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  $("#rs-save", m).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const n = Number($("#rs-ver", m).value);
    const when = $("#rs-when", m).value;
    try {
      await api.recordSend(deck.id, {
        recipient: $("#rs-who", m).value.trim(),
        note: $("#rs-note", m).value.trim(),
        version_n: n,
        // Midday, so a date typed here lands on that date in every timezone
        // rather than sliding to the day before.
        sent_at: when ? new Date(`${when}T12:00:00`).toISOString() : undefined,
      });
      close();
      toast(`Recorded: v${n} sent.`);
      onDone?.();
    } catch (err) {
      toast(err.message || "could not record it");
      btn.disabled = false;
    }
  });

  document.body.append(m);
  setTimeout(() => $("#rs-who", m).focus(), 30);
}
