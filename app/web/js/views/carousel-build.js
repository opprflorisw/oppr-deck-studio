// Build carousel page HTML from a page spec, mirroring the documented
// templates/linkedin.css blocks. Used for the live preview and as the shape the
// social draft stores; the server generates the same HTML when it builds.

import { esc } from "../util.js";

export const PATTERNS = [
  { id: "hook", label: "Hook", fields: ["eyebrow", "headline", "sub"] },
  { id: "point", label: "Point", fields: ["num", "headline", "body"] },
  { id: "stat", label: "Stat", fields: ["num", "headline", "stat", "body"] },
  { id: "cta", label: "CTA (ink)", fields: ["headline", "body", "handle"] },
];

export function blankPage(id) {
  const p = { pattern: id };
  (PATTERNS.find((x) => x.id === id)?.fields || []).forEach((f) => (p[f] = ""));
  if (id === "cta") p.handle = "oppr.ai";
  return p;
}

export function pageHtmlFor(p, i, total) {
  const wm = `<span class="wm">oppr<b>.</b></span>`;
  const dot = `<span class="pagedot">${String(i + 1).padStart(2, "0")}</span>`;
  const e = (s) => esc(s || "");
  if (p.pattern === "hook") {
    return `<section class="lpage lpage--hook">${wm}
      ${p.eyebrow ? `<p class="eyebrow">${e(p.eyebrow)}</p>` : ""}
      <h1>${e(p.headline)}</h1>
      ${p.sub ? `<p class="sub">${e(p.sub)}</p>` : ""}${dot}</section>`;
  }
  if (p.pattern === "stat") {
    return `<section class="lpage lpage--point">${wm}
      ${p.num ? `<p class="num">${e(p.num)}</p>` : ""}
      <h2>${e(p.headline)}</h2>
      ${p.stat ? `<div class="lstat">${e(p.stat)}</div>` : ""}
      ${p.body ? `<p>${e(p.body)}</p>` : ""}${dot}</section>`;
  }
  if (p.pattern === "cta") {
    return `<section class="lpage lpage--cta">${wm}
      <h2>${e(p.headline)}</h2>
      ${p.body ? `<p>${e(p.body)}</p>` : ""}
      ${p.handle ? `<div class="handle">${e(p.handle)}</div>` : ""}${dot}</section>`;
  }
  // point
  return `<section class="lpage lpage--point">${wm}
    ${p.num ? `<p class="num">${e(p.num)}</p>` : ""}
    <h2>${e(p.headline)}</h2>
    ${p.body ? `<p>${e(p.body)}</p>` : ""}${dot}</section>`;
}

export function carouselHtml(pages) {
  const body = pages.map((p, i) => pageHtmlFor(p, i, pages.length)).join("\n");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/repo/templates/linkedin.css"></head>
<body><div class="carousel">${body}</div></body></html>`;
}

// A single scaled 4:5 page for inline preview.
export function pagePreviewDoc(page, i, total) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/repo/templates/linkedin.css">
<style>body{margin:0}.carousel{padding:0;gap:0}</style></head>
<body><div class="carousel">${pageHtmlFor(page, i, total)}</div></body></html>`;
}
