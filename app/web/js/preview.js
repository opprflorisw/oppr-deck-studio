// Live slide preview: wrap a raw fragment in the deck shell, fill preview vars,
// render it in a scaled iframe so a full 16:9 slide fits a column.

import { el } from "./util.js";

const PREVIEW_VARS = {
  asset: "/repo/",
  deck_footer: "Operator Intelligence &middot; Preview",
  total: "10",
  cover_meta: "Preview &nbsp;&middot;&nbsp; 2026 &nbsp;&middot;&nbsp; oppr.ai",
};

export function fillVars(fragment, vars) {
  let body = fragment;
  for (const [k, v] of Object.entries(vars)) body = body.split("{{" + k + "}}").join(v ?? "");
  return body;
}

export function fillPreviewVars(fragment) {
  return fillVars(fragment, PREVIEW_VARS);
}

// A preview of a slide AS IT WILL PRINT: the deck's own footer and cover meta,
// the real total, and the real page number. The page number is a CSS counter on
// `.deck` (deck.css), so seeding the counter is what makes slide 7 say 07 / 11
// instead of every preview claiming to be page one.
export function deckPageDoc(fragment, vars, index) {
  const filled = fillVars(fragment, { asset: "/repo/", ...vars });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/repo/templates/deck.css">
<link rel="stylesheet" href="/repo/templates/showcase.css">
<style>${ONE_SLIDE}</style></head>
<body><div class="deck" style="counter-reset: slide ${Number(index) || 0}">${filled}</div></body></html>`;
}

// deck.css gives `.deck` 28px of vertical padding and a 28px gap ON SCREEN, so
// it reads as a scroll of separate sheets. A preview frame is exactly one slide
// at exactly 1280x720, so that padding pushed the slide down and clipped its
// footer off the bottom. Neutralise it here rather than in deck.css: the
// scrolling deck view still wants the gap.
const ONE_SLIDE = `html,body{margin:0;background:transparent}
.deck{padding:0!important;gap:0!important;display:block!important}
.slide{box-shadow:none!important}`;

export function previewDoc(fragment) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/repo/templates/deck.css">
<link rel="stylesheet" href="/repo/templates/showcase.css">
<style>${ONE_SLIDE}</style></head>
<body><div class="deck">${fillPreviewVars(fragment)}</div></body></html>`;
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

// `{{icon:NAME}}` is inlined at ASSEMBLY time by deckstudio.inline_icons, so a
// built deck and its catalog thumbnails have always been right. The app renders
// the raw fragment, which meant every live preview showed the literal token
// instead of the icon. Expand it here, the same way, from the same files.
const iconCache = new Map();
const ICON_RE = /\{\{\s*icon:([\w-]+)\s*\}\}/g;

async function inlineIcons(html) {
  const names = [...new Set([...html.matchAll(ICON_RE)].map((m) => m[1]))];
  const missing = names.filter((n) => !iconCache.has(n));
  await Promise.all(missing.map(async (n) => {
    try {
      const r = await fetch(`/repo/library/icons/${encodeURIComponent(n)}.svg`,
                            { credentials: "same-origin" });
      iconCache.set(n, r.ok ? (await r.text()).trim() : "");
    } catch { iconCache.set(n, ""); }
  }));
  // An unknown icon is a hard error at assembly. Here it leaves the token
  // visible rather than silently rendering a gap, so the problem is obvious.
  return html.replace(ICON_RE, (tok, n) => iconCache.get(n) || tok);
}

// A slide-shaped explanation, so a failed fetch looks like a failed fetch
// instead of the server's error body typeset as the slide. "sign in first" set
// in 200px serif was, briefly, a real page in a real preview.
const fragmentError = (id, what) => `
  <section class="slide" style="display:flex;flex-direction:column;justify-content:center;gap:14px">
    <p class="eyebrow" style="color:var(--accent)">This page could not be loaded</p>
    <h2 style="font-size:34px;max-width:24ch">${what}</h2>
    <p class="subcopy" style="max-width:60ch">The slide itself is fine. This is the
      preview failing to fetch <code>${id}</code>. Reload the page; if it keeps
      happening, sign out and back in.</p>
  </section>`;

// Everything that previews a library slide goes through this, so this is the
// one place the fragment becomes renderable.
export async function fetchFragment(id) {
  let r;
  try {
    r = await fetch(`/repo/library/slides/${encodeURIComponent(id)}/slide.html`,
                    { credentials: "same-origin" });
  } catch {
    return fragmentError(id, "The app could not be reached.");
  }
  // Never render a non-200 body: /repo answers 401 with "sign in first" and 404
  // with "Not found", and both used to be typeset straight into the deck.
  if (!r.ok) {
    return fragmentError(id, r.status === 401
      ? "Your session expired while this preview was open."
      : r.status === 404 ? "That slide is not in the library."
      : `The server answered ${r.status}.`);
  }
  return inlineIcons(await r.text());
}
