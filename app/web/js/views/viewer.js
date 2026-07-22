// Paged slide viewer: step through a deck / draft / carousel one page at a time,
// with prev/next buttons, a page counter, a jump strip, and keyboard arrows.
//
// Each page renders a self-scaling document: the iframe fills the stage and a
// tiny inline script scales the slide to fit its own viewport, so there is no
// fragile outer measurement.

import { $, $$, el, esc } from "../util.js";
import { fillPreviewVars, fetchFragment } from "../preview.js";
import { pageHtmlFor } from "./carousel-build.js";

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

export function openDeckViewer(pages, { title = "", pdf = null } = {}) {
  if (!pages.length) return;
  let i = 0;

  const m = el(`
    <div class="modal viewer">
      <div class="viewer-box">
        <header>
          <b>${esc(title)}</b>
          <span class="viewer-count mono"></span>
          <div class="spacer"></div>
          ${pdf ? `<a class="ghost" href="/repo/${esc(pdf)}" download>Download PDF</a>` : ""}
          <button class="ghost close">Close</button>
        </header>
        <div class="viewer-body">
          <button class="navbtn prev" title="Previous (left arrow)" aria-label="Previous">&#8249;</button>
          <div class="viewer-stage"><iframe class="viewer-frame" scrolling="no"></iframe></div>
          <button class="navbtn next" title="Next (right arrow)" aria-label="Next">&#8250;</button>
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

// Split an assembled deck/carousel index.html into one self-scaling page each.
export async function assembledViewer(indexPath, title, pdf = null) {
  const html = await (await fetch(`/repo/${indexPath}`)).text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headTags = [...doc.head.querySelectorAll('link[rel="stylesheet"], style')].map((l) => l.outerHTML).join("");
  const dir = indexPath.replace(/[^/]+$/, "");
  const head = `<base href="/repo/${dir}">${headTags}`;
  // Use the container's actual class list so a carousel--square (or any modifier)
  // survives; fall back to the deck frame.
  const containerEl = doc.querySelector(".carousel") || doc.querySelector(".deck");
  const containerClass = containerEl ? containerEl.getAttribute("class") : "deck";
  const isCarousel = !!containerEl && containerEl.classList.contains("carousel");
  const isSquare = !!containerEl && containerEl.classList.contains("carousel--square");
  const sections = containerEl ? [...containerEl.children].filter((c) => c.tagName === "SECTION") : [];
  const [w, h] = isSquare ? [1080, 1080] : isCarousel ? [1080, 1350] : [1280, 720];
  const pages = sections.map((sec, i) => ({
    label: sec.id || String(i + 1),
    render: () => scaledDoc(head, `<div class="${containerClass}">${sec.outerHTML}</div>`, w, h),
  }));
  openDeckViewer(pages, { title, pdf });
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
