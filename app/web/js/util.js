// Small shared helpers.

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Slide titles in meta are HTML entity strings (e.g. can&rsquo;t); render as text.
export function decodeEntities(s) {
  const t = document.createElement("textarea");
  t.innerHTML = s ?? "";
  return t.value;
}

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 50) || "untitled";
}

// Create an element from an HTML string (single root).
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

// Clearance slugs offered in the UI. Per customer since 2026-08-01: the old
// public|named-customer|mutares-family buckets let one customer's deck carry
// another customer's material. Derived from the image manifest at runtime so a
// new customer needs no code change; this is only the fallback ordering.
export const ENTITLEMENTS = ["public", "mutares", "holliday", "venator", "attero",
  "keeeper", "omniplast", "sonneborn", "host", "selo", "wavin"];
export const todayISO = () => new Date().toISOString().slice(0, 10);

// Close a modal when the backdrop is CLICKED — not when a click merely ends
// there. Dragging a text selection out of the box fires a click whose target is
// the backdrop, which used to close the modal mid-selection and lose the work
// in it. A close is only a close when the press started on the backdrop too.
export function backdropClose(m, close) {
  let down = false;
  m.addEventListener("mousedown", (e) => { down = e.target === m; });
  m.addEventListener("click", (e) => {
    if (e.target === m && down) close();
    down = false;
  });
}
