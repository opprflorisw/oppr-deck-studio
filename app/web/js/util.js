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

export const ENTITLEMENT_RANK = { public: 0, "named-customer": 1, "mutares-family": 1 };
export const todayISO = () => new Date().toISOString().slice(0, 10);
