// Paged slide viewer: step through a deck / draft / carousel one page at a time,
// with prev/next buttons, a page counter, a jump strip, and keyboard arrows.
//
// Each page renders a self-scaling document: the iframe fills the stage and a
// tiny inline script scales the slide to fit its own viewport, so there is no
// fragile outer measurement.

import { $, $$, el, esc } from "../util.js";
import { fillPreviewVars, fetchFragment, deckPageDoc } from "../preview.js";
import { pageHtmlFor } from "./carousel-build.js";
import { icon, ibtn } from "../icons.js";
import { go } from "../router.js";

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

// `onMove(index, delta)` turns the viewer into a place you can FIX the order,
// not only inspect it. You notice the problem on page 6; you fix it on page 6.
// It returns the fresh page list and where the moved slide ended up, so the
// caller stays the single owner of the order and the viewer never guesses.
export function openDeckViewer(pages, { title = "", pdf = null, image = null, pdfUrl = null, onEdit = null, onMove = null } = {}) {
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
          ${onMove ? `<span class="viewer-move">
            <button class="ghost sm mv-up" title="Move this slide earlier">&uarr; Earlier</button>
            <button class="ghost sm mv-dn" title="Move this slide later">&darr; Later</button>
          </span>` : ""}
          <div class="spacer"></div>
          ${onEdit ? `<button class="primary edit-here">${ibtn("compose", "Edit")}</button>` : ""}
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
  const strip = $(".viewer-strip", m);

  const paintStrip = () => {
    strip.innerHTML = pages.map((p, k) =>
      `<button class="vdot" data-i="${k}" title="${esc(p.label || "")}">${k + 1}</button>`).join("");
  };

  // A slow render must never overwrite a newer one: with reorder in the header
  // it is easy to move twice before the first page has drawn.
  let token = 0;
  const show = async () => {
    const mine = ++token;
    $(".viewer-count", m).textContent = `${i + 1} / ${pages.length}`;
    $(".prev", m).disabled = i === 0;
    $(".next", m).disabled = i === pages.length - 1;
    const up = $(".mv-up", m), dn = $(".mv-dn", m);
    if (up) up.disabled = i === 0;
    if (dn) dn.disabled = i === pages.length - 1;
    $$(".vdot", m).forEach((d, k) => d.classList.toggle("active", k === i));
    const active = $$(".vdot", m)[i];
    if (active) active.scrollIntoView({ block: "nearest", inline: "nearest" });
    const html = await pages[i].render();
    if (mine === token) iframe.srcdoc = html;
  };
  const move = (d) => { const n = Math.max(0, Math.min(pages.length - 1, i + d)); if (n !== i) { i = n; show(); } };

  // Reorder in place. The caller owns the order and hands back the new pages,
  // so the two views can never drift apart.
  const reorder = (d) => {
    const next = onMove(i, d);
    if (!next || !next.pages?.length) return;
    pages = next.pages;
    i = Math.max(0, Math.min(pages.length - 1, next.index ?? i));
    paintStrip();
    show();
  };

  $(".prev", m).addEventListener("click", () => move(-1));
  $(".next", m).addEventListener("click", () => move(1));
  $(".mv-up", m)?.addEventListener("click", () => reorder(-1));
  $(".mv-dn", m)?.addEventListener("click", () => reorder(1));
  strip.addEventListener("click", (e) => {
    const d = e.target.closest(".vdot");
    if (d) { i = +d.dataset.i; show(); }
  });

  const onKey = (e) => {
    // Alt+arrow moves the slide; plain arrows page through it. Same keys people
    // already use to reorder a list, and it cannot be hit by accident.
    if (e.altKey && onMove && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault(); return reorder(e.key === "ArrowLeft" ? -1 : 1);
    }
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    else if (e.key === "Escape") close();
  };
  const close = () => { m.remove(); document.removeEventListener("keydown", onKey); };
  $(".close", m).addEventListener("click", close);
  $(".edit-here", m)?.addEventListener("click", () => { close(); onEdit(i); });
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
  const html = await (await fetch(`/repo/${indexPath}`, { credentials: "same-origin" })).text();
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
  const html = await api.authedFetch(api.deckViewUrl(deckId, n)).then((r) => r.text());
  const { pages } = pagesFromHtml(html, `/deck-cache/${deckId}/v${n}/`);
  openDeckViewer(pages, {
    title,
    // Always offer the PDF: the endpoint prints on demand when this version has
    // never been printed, so there is no state where looking at a page leaves
    // you unable to take it.
    pdfUrl: api.deckPdfUrl(deckId, n),
    onEdit: () => go(`/deck/${deckId}/edit`),
  });
}

// A deck that does not exist yet: the builder's picks, in the builder's order,
// rendered from the live library with the deck's OWN footer, cover meta and page
// numbers. This is the "press View" surface — what you are about to publish,
// not an approximation of it.
export function recipePages(order, vars) {
  const total = String(order.length);
  return order.map((sid, i) => ({
    label: sid,
    render: async () =>
      scaledDocFromDoc(deckPageDoc(await fetchFragment(sid), { ...vars, total }, i)),
  }));
}

// Take a complete single-slide document and make it fit the viewer stage. The
// scaling shell needs head and body separately, so split once rather than
// duplicating deckPageDoc's head here and letting the two drift.
function scaledDocFromDoc(doc) {
  const d = new DOMParser().parseFromString(doc, "text/html");
  const head = [...d.head.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
  return scaledDoc(head, d.body.innerHTML, 1280, 720);
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
