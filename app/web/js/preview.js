// Live slide preview: wrap a raw fragment in the deck shell, fill preview vars,
// render it in a scaled iframe so a full 16:9 slide fits a column.

import { el } from "./util.js";

const PREVIEW_VARS = {
  asset: "/repo/",
  deck_footer: "Operator Intelligence &middot; Preview",
  total: "10",
  cover_meta: "Preview &nbsp;&middot;&nbsp; 2026 &nbsp;&middot;&nbsp; oppr.ai",
};

export function previewDoc(fragment) {
  let body = fragment;
  for (const [k, v] of Object.entries(PREVIEW_VARS)) body = body.split("{{" + k + "}}").join(v);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/repo/templates/deck.css">
<link rel="stylesheet" href="/repo/templates/showcase.css">
<style>html,body{margin:0;background:transparent}</style></head>
<body><div class="deck">${body}</div></body></html>`;
}

// fragmentSource: a string or a Promise<string>. width: rendered CSS px.
export function previewFrame(fragmentSource, width = 640) {
  const scale = width / 1280;
  const wrap = el(`<div class="preview-wrap" style="width:${width}px;height:${720 * scale}px"></div>`);
  const iframe = document.createElement("iframe");
  iframe.className = "slide-preview";
  iframe.setAttribute("width", "1280");
  iframe.setAttribute("height", "720");
  iframe.setAttribute("scrolling", "no");
  iframe.style.transform = `scale(${scale})`;
  iframe.style.transformOrigin = "top left";
  wrap.append(iframe);
  Promise.resolve(fragmentSource).then((frag) => { iframe.srcdoc = previewDoc(frag); });
  return wrap;
}

export const fetchFragment = (id) =>
  fetch(`/repo/library/slides/${encodeURIComponent(id)}/slide.html`).then((r) => r.text());
