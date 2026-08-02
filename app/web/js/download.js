// Downloading a single library element (Deck Studio 2.0).
//
// The Library could show a slide or a design-system block but never hand you
// one. This is the shared control that does, used by the slide detail and the
// design-system view.
//
// Formats, and what each is actually for:
//   HTML  one self-contained file, assets inlined as data: URIs. Opens anywhere,
//         offline. This is the useful one — a raw fragment renders unstyled and
//         still full of {{placeholders}}.
//   PNG   dropping into a document, a mail, a chat.
//   PDF   a one-page handout, printed by the same browser a deck build uses.
//
// Entitlement is enforced server-side: an element pulling imagery above public
// clearance comes back 403 and is offered again only with explicit consent.

import { el, esc, toast } from "./util.js";
import { icon } from "./icons.js";
import { authedFetch } from "./api.js";

const FORMATS = [
  { id: "html", label: "HTML", hint: "one self-contained file" },
  { id: "png", label: "PNG", hint: "for a doc or a mail" },
  { id: "pdf", label: "PDF", hint: "one-page handout" },
];

async function fetchExport(kind, id, format, allow) {
  const qs = new URLSearchParams({ kind, id, format });
  if (allow) qs.set("allow", allow);
  const res = await authedFetch(`/api/library/export?${qs}`);
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch {}
    const err = new Error(body.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  const disp = res.headers.get("Content-Disposition") || "";
  const name = (/filename="([^"]+)"/.exec(disp) || [])[1] || `oppr_${id}.${format}`;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return name;
}

// Pull the clearance slugs out of the server's refusal so the retry can name
// exactly them, rather than asking the user to type a slug they cannot see.
function slugsFromRefusal(message) {
  const found = new Set();
  for (const m of String(message).matchAll(/:\s*([a-z0-9-]+)\s*$/gm)) {
    if (m[1] && m[1] !== "public") found.add(m[1]);
  }
  return [...found];
}

export function downloadPanel(kind, id) {
  const box = el(`<div class="panel">
    <h2>Download</h2>
    <div class="dl-row">${FORMATS.map((f) =>
      `<button class="ghost dl-btn" data-fmt="${f.id}" title="${esc(f.hint)}">${f.label}</button>`).join("")}</div>
    <p class="note" id="dl-note">Exports this element on its own, styled and self-contained.</p>
  </div>`);

  box.querySelectorAll(".dl-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fmt = btn.dataset.fmt;
      const note = box.querySelector("#dl-note");
      btn.disabled = true;
      note.textContent = fmt === "html" ? "Building…" : "Rendering…";
      try {
        const name = await fetchExport(kind, id, fmt, "");
        note.textContent = `Downloaded ${name}`;
      } catch (e) {
        if (e.status === 403) {
          const slugs = slugsFromRefusal(e.message);
          note.innerHTML = "";
          note.append(clearanceGate(kind, id, fmt, slugs, note));
        } else {
          note.textContent = e.message || "export failed";
        }
      } finally {
        btn.disabled = false;
      }
    });
  });
  return box;
}

// The element carries customer-cleared imagery. Say whose, and make taking it
// out a deliberate act rather than a silent one.
function clearanceGate(kind, id, fmt, slugs, note) {
  const wrap = el(`<span>
    <b>Held back.</b> This element uses imagery cleared for
    <span class="mono">${esc(slugs.join(", ") || "a customer")}</span>, so it is not public.
    <button class="ghost sm" id="dl-anyway">Download anyway</button>
  </span>`);
  wrap.querySelector("#dl-anyway").addEventListener("click", async () => {
    try {
      const name = await fetchExport(kind, id, fmt, slugs.join(","));
      note.textContent = `Downloaded ${name} — customer-cleared, do not publish.`;
      toast("Contains customer-cleared imagery. Not for social.");
    } catch (e2) { note.textContent = e2.message || "export failed"; }
  });
  return wrap;
}
