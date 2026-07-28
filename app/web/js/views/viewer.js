// Paged slide viewer: step through a deck / draft / carousel one page at a time,
// with prev/next buttons, a page counter, a jump strip, and keyboard arrows.
//
// Each page renders a self-scaling document: the iframe fills the stage and a
// tiny inline script scales the slide to fit its own viewport, so there is no
// fragile outer measurement.

import { $, $$, el, esc } from "../util.js";
import { fillPreviewVars, fetchFragment } from "../preview.js";
import { pageHtmlFor } from "./carousel-build.js";
import { icon, ibtn } from "../icons.js";

// Wrap body content in a shell that scales its slide/section to fit the iframe.
export function scaledDoc(headExtra, bodyInner, w, h) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">${headExtra}
<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}
#fw{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#fi{transform-origin:center center}</style></head>
<body><div id="fw"><div id="fi">${bodyInner}</div></div>
<script>(function(){var fi=document.getElementById('fi');
function fit(){var e=fi.querySelector('section')||fi.firstElementChild;
var ww=(e&&e.offsetWidth)||${w},hh=(e&&e.offsetHeight)||${h};
var s=Math.min(window.innerWidth/ww,window.innerHeight/hh);
fi.style.transform='scale('+s+')';}
window.addEventListener('resize',fit);
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}
setTimeout(fit,20);setTimeout(fit,120);fit();})();</script>
</body></html>`;
}

export function openDeckViewer(pages, { title = "", pdf = null, image = null, pdfUrl = null } = {}) {
  if (!pages.length) return;
  let i = 0;

  // `pdf`/`image` are repo-relative (served under /repo/); `pdfUrl` is an already
  // absolute URL (a backend deck version's PDF endpoint).
  const pdfHref = pdfUrl ? esc(pdfUrl) : pdf ? `/repo/${esc(pdf)}` : null;
  const m = el(`
    <div class="modal viewer">
      <div class="viewer-box">
        <header>
          <b>${esc(title)}</b>
          <span class="viewer-count mono"></span>
          <div class="spacer"></div>
          ${pdfHref ? `<a class="ghost" href="${pdfHref}" download>${ibtn("download", "PDF")}</a>` : ""}
          ${image ? `<a class="ghost" href="/repo/${esc(image)}" download>${ibtn("download", "PNG")}</a>` : ""}
          <button class="ghost icon-only close" title="Close (Esc)">${icon("close")}</button>
        </header>
        <div class="viewer-body">
          <button class="navbtn prev" title="Previous (left arrow)" aria-label="Previous">${icon("prev", 30)}</button>
          <div class="viewer-stage"><iframe class="viewer-frame" scrolling="no"></iframe></div>
          <button class="navbtn next" title="Next (right arrow)" aria-label="Next">${icon("next", 30)}</button>
        </div>
        <div class="viewer-strip">${pages.map((p, k) => `<button class="vdot" data-i="${k}" title="${esc(p.label || "")}">${k + 1}</button>`).join("")}</div>
      </div>
    </div>`);

  const iframe = $(".viewer-frame", m);
  const show = async () => {
    $(".viewer-count", m).textContent = `${i + 1} / ${pages.length}`;
    $(".prev", m).disabled = i === 0;
    $(".next", m).disabled = i === pages.length - 1;
    $$(".vdot", m).forEach((d, k) => d.classList.toggle("active", k === i));
    const active = $$(".vdot", m)[i];
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
    iframe.srcdoc = await pages[i].render();
  };
  const move = (d) => { const n = Math.max(0, Math.min(pages.length - 1, i + d)); if (n !== i) { i = n; show(); } };

  $(".prev", m).addEventListener("click", () => move(-1));
  $(".next", m).addEventListener("click", () => move(1));
  $$(".vdot", m).forEach((d) => d.addEventListener("click", () => { i = +d.dataset.i; show(); }));

  const onKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "Escape") close();
  };
  const close = () => { m.remove(); document.removeEventListener("keydown", onKey); };
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });
  document.addEventListener("keydown", onKey);

  document.body.append(m);
  show();
}

// ---- page builders ----------------------------------------------------------

// Split an assembled deck/carousel document into one self-scaling page each,
// given its HTML and the base href its assets resolve against. Returns
// { pages, w, h } — pages have { label, render() } and share page size.
export function pagesFromHtml(html, baseHref) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headTags = [...doc.head.querySelectorAll('link[rel="stylesheet"], style')].map((l) => l.outerHTML).join("");
  const head = `<base href="${baseHref}">${headTags}`;
  const containerEl = doc.querySelector(".carousel") || doc.querySelector(".deck");
  const containerClass = containerEl ? containerEl.getAttribute("class") : "deck";
  const isCarousel = !!containerEl && containerEl.classList.contains("carousel");
  const isSquare = !!containerEl && containerEl.classList.contains("carousel--square");
  const sections = containerEl ? [...containerEl.children].filter((c) => c.tagName === "SECTION") : [];
  const [w, h] = isSquare ? [1080, 1080] : isCarousel ? [1080, 1350] : [1280, 720];
  const pages = sections.map((sec, i) => ({
    label: sec.getAttribute("data-slide-id") || sec.id || String(i + 1),
    render: () => scaledDoc(head, `<div class="${containerClass}">${sec.outerHTML}</div>`, w, h),
  }));
  return { pages, w, h };
}

export async function assembledPages(indexPath) {
  const html = await (await fetch(`/repo/${indexPath}`)).text();
  return pagesFromHtml(html, `/repo/${indexPath.replace(/[^/]+$/, "")}`);
}

// `pdf` for a deck or carousel, `image` for a single social image: whichever the
// output actually ships is the one the viewer offers to download.
export async function assembledViewer(indexPath, title, pdf = null, image = null) {
  const { pages } = await assembledPages(indexPath);
  openDeckViewer(pages, { title, pdf, image });
}

// Preview a BACKEND deck version: fetching the /view URL materializes the
// version into the cache (so assets resolve) and returns its index.html.
export async function deckVersionViewer(api, deckId, n, title, hasPdf = false) {
  const html = await fetch(api.deckViewUrl(deckId, n)).then((r) => r.text());
  const { pages } = pagesFromHtml(html, `/deck-cache/${deckId}/v${n}/`);
  openDeckViewer(pages, { title, pdfUrl: hasPdf ? api.deckPdfUrl(deckId, n) : null });
}

// A draft deck: library slides render live; new-slide slots show a placeholder.
export function draftViewer(draft, title) {
  const head = `<link rel="stylesheet" href="/repo/templates/deck.css"><link rel="stylesheet" href="/repo/templates/showcase.css">`;
  const pages = draft.slides.map((slot) => {
    if (slot.source === "new") return { label: "new", render: () => scaledDoc("", placeholderInner(slot), 1280, 720) };
    return { label: slot.id, render: async () => scaledDoc(head, `<div class="deck">${fillPreviewVars(await fetchFragment(slot.id))}</div>`, 1280, 720) };
  });
  if (pages.length) openDeckViewer(pages, { title: title || "Draft preview" });
}

function placeholderInner(slot) {
  return `<section style="width:1280px;height:720px;background:#f2f2ed;color:#15201e;font-family:Arial,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 120px;box-sizing:border-box">
    <div style="font-family:monospace;letter-spacing:.1em;text-transform:uppercase;color:#a65032;font-weight:700;font-size:22px;margin-bottom:18px">New slide</div>
    ${slot.role ? `<div style="font-family:monospace;color:#5f6965;font-size:20px;margin-bottom:24px">role: ${esc(slot.role)}${slot.id ? " &middot; id: " + esc(slot.id) : ""}</div>` : ""}
    <div style="font-size:34px;line-height:1.4">${esc(slot.brief || "(no instruction yet)")}</div>
  </section>`;
}

// The carousel composer's live pages (client-built, not yet on disk).
export function carouselComposerViewer(pageSpecs, title) {
  if (!pageSpecs.length) return;
  const head = `<link rel="stylesheet" href="/repo/templates/linkedin.css">`;
  const pages = pageSpecs.map((pg, i) => ({
    label: pg.pattern,
    render: () => scaledDoc(head, `<div class="carousel">${pageHtmlFor(pg, i, pageSpecs.length)}</div>`, 1080, 1350),
  }));
  openDeckViewer(pages, { title: title || "Carousel preview" });
}
