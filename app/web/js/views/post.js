// A LinkedIn publication, on one page (2026-08-20).
//
// One post on LinkedIn is up to three things: the SHORT form (the post copy),
// the LONG form (the article body, pasted into LinkedIn's own article editor),
// and the VISUAL that ships with either (a one-page image, or a carousel PDF
// for a document post). The old UI scattered those over three surfaces — an
// article row, a separate `-hero` image row, and a Post text button — and then
// dressed the whole thing in a deck's clothes: a version timeline, Make master,
// Personalize, and a Download PDF that handed over a seven-page print of a
// reading document nobody will ever send.
//
// This page is the social artifact's home instead of deck.js. What changed:
//
// - **No version timeline.** A post is not a deck: once it is out, it is out.
//   Every save underneath is still an immutable `deck_versions` row (the one
//   artifact model is untouched; the storage did not change), but the page
//   shows one current thing you view, update, post and remove — not a history
//   to manage.
// - **The right download per kind.** A carousel offers its PDF, because a PDF
//   is what LinkedIn takes for a document post. An image and a post visual
//   offer a full-resolution PNG. An article offers NO file at all: its long
//   form is copied, with formatting, into LinkedIn's article editor.
// - **The hero is a facet, not a sibling.** `publish-article.py` published each
//   article's 1200x627 visual as its own row named `<slug>-hero`. That row now
//   renders inside its article's page as "the visual", and the social lists
//   hide it, so one publication reads as one thing.
// - **Posted is on the page.** The same publish_log entry the list's checkbox
//   writes, with the date and the post's link, where you finish the work.

import { $, $$, el, esc, decodeEntities, toast, todayISO , backdropClose } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { deckVersionViewer } from "./viewer.js";
import { postEditorPanel } from "../postedit.js";
import { mountNote } from "../note.js";
import { offlinePanel } from "./deck.js";

export { SOCIAL_KINDS } from "../areas.js";

// What each kind is, in the words the page uses. `visual` says what the
// shipping file is; article has none — its deliverable is text.
const KIND_WORDS = {
  carousel: { label: "Carousel", visual: "The pages, downloaded as the PDF LinkedIn takes for a document post." },
  image: { label: "Image", visual: "One page, downloaded as a full-resolution PNG." },
  article: { label: "Article", visual: "The one-page visual that goes out with the post or the article." },
  post: { label: "Post", visual: "The one-page visual that goes out with the post." },
};

// The `-hero` image row an article was published beside. Pairing is by the slug
// convention publish-article.py used; a publication without one simply has no
// visual yet.
const heroFor = (deck) =>
  (state.backend.decks || []).find((d) => d.kind === "image" && d.slug === `${deck.slug}-hero`);

export async function renderDetail(id, mount) {
  mount(el(`<div class="loading">Loading…</div>`));
  let data;
  try { data = await api.getDeck(id); }
  catch { return mount(offlinePanel("Post")); }
  const { deck } = data;
  const cur = deck.current_version_n;
  // page_count is a fact about the current VERSION; the deck row does not carry
  // it. Without this a ten-page carousel showed a one-page strip.
  deck.page_count = data.versions?.find((v) => v.n === cur)?.page_count || deck.page_count || 1;
  const words = KIND_WORDS[deck.kind] || KIND_WORDS.post;
  const hero = deck.kind === "article" || deck.kind === "post" ? heroFor(deck) : null;
  // The visual lives on its own row for a paired article, and on this row for
  // a carousel or an image. One variable, so every control below agrees.
  const vis = hero || deck;
  const visCur = hero ? hero.current_version_n : cur;

  let log = {};
  try { log = await api.getSocialStatus(); } catch { /* posted bar says so */ }

  const wrap = el(`
    <div>
      <div class="detail-head">
        <button class="ghost" id="back">${ibtn("prev", "Back")}</button>
      </div>
      <div class="deck-detail-head">
        <div class="deck-id">
          <div class="row-title">
            <button class="star-btn ${deck.starred ? "on" : ""}" id="star"
                    aria-pressed="${deck.starred ? "true" : "false"}"
                    title="${deck.starred ? "Starred — click to remove" : "Star this so it sorts first"}">${icon("star", 18)}</button>
            <h1>${esc(decodeEntities(deck.title))}</h1>
          </div>
          <div class="cust-meta">
            <span class="badge">${esc(words.label)}</span>
            ${deck.archived ? `<span class="pill-status draft">removed</span>` : ""}
            <span class="mono note">${esc(deck.slug)}</span>
          </div>
          <div class="row-note detail-note"></div>
        </div>
        <div class="deck-actions">
          <button class="ghost" id="rename">${ibtn("compose", "Rename")}</button>
          <button class="ghost ${deck.archived ? "" : "danger"}" id="remove"
                  title="${deck.archived
                    ? "Bring it back into the lists"
                    : "Take it out of every list. Nothing is deleted; it can be brought back."}">
            ${deck.archived ? ibtn("history", "Bring back") : ibtn("trash", "Remove")}</button>
        </div>
      </div>

      <div id="posted-bar"></div>

      <div class="tabbar facet-tabs" id="facet-tabs"></div>
      <div class="facet-body" id="facet-body"></div>
    </div>`);

  mountNote(wrap, deck, { placeholder: "Add a note (shown in the overview)…" });
  $("#back", wrap).addEventListener("click", () => history.length > 1 ? history.back() : go("/social/all"));
  $("#star", wrap).addEventListener("click", async (e) => {
    const next = !deck.starred;
    deck.starred = next;
    e.currentTarget.classList.toggle("on", next);
    try { await api.patchDeck(deck.id, { starred: next }); await loadBackend(api); }
    catch (err) { deck.starred = !next; e.currentTarget.classList.toggle("on", !next); toast(err.message); }
  });
  $("#rename", wrap).addEventListener("click", () => openRename(deck, () => renderDetail(id, mount)));
  $("#remove", wrap).addEventListener("click", async () => {
    const next = !deck.archived;
    try {
      await api.patchDeck(deck.id, { archived: next });
      await loadBackend(api);
      toast(next ? "Removed from the lists. Nothing is deleted — Bring back undoes it." : "Back in the lists.");
      renderDetail(id, mount);
    } catch (e) { toast(e.message || "could not change that"); }
  });

  $("#posted-bar", wrap).append(postedBar(deck, log[deck.slug]));

  // The facets as TABS, one visible at a time: cover, short form, and for an
  // article the long form twice -- as the rendered document, and as plain text
  // ready for LinkedIn's article editor. A panel is built the first time its
  // tab opens (the article iframe should not load while you are looking at the
  // cover) and kept, so switching back is instant and edits survive the switch.
  const tabs = [
    { id: "cover", icon: "image", label: deck.kind === "carousel" ? "Pages" : "Cover",
      make: () => visualPanel(deck, vis, visCur, hero) },
    { id: "short", icon: "text", label: "Short form",
      make: () => shortPanel(deck) },
    ...(deck.kind === "article" ? [
      { id: "html", icon: "book", label: "Long form · HTML",
        make: () => longPanel(deck, cur) },
      { id: "text", icon: "copy", label: "Long form · text",
        make: () => textPanel(deck, cur) },
    ] : []),
  ];
  const bar = $("#facet-tabs", wrap);
  const body = $("#facet-body", wrap);
  const built = new Map();
  const open = (id) => {
    const t = tabs.find((x) => x.id === id) || tabs[0];
    $$("button", bar).forEach((b) => b.classList.toggle("active", b.dataset.facet === t.id));
    if (!built.has(t.id)) built.set(t.id, t.make());
    body.replaceChildren(built.get(t.id));
  };
  for (const t of tabs) {
    const b = el(`<button data-facet="${t.id}">${icon(t.icon, 15)}<span>${esc(t.label)}</span></button>`);
    b.addEventListener("click", () => open(t.id));
    bar.append(b);
  }
  open("cover");

  mount(wrap);
}

// ------------------------------------------------------------------- posted

// The same publish_log entry as the list's checkbox, with the two facts worth
// keeping once it is out: when, and the link to the live post. Saved on change,
// like every other small fact in the app.
function postedBar(deck, entry) {
  const posted = entry?.status === "posted";
  const box = el(`
    <div class="posted-bar ${posted ? "is-on" : ""}">
      <label class="posted-check">
        <input type="checkbox" ${posted ? "checked" : ""}>
        <b>${posted ? "Posted" : "Not posted yet"}</b>
      </label>
      <label class="posted-field">on
        <input type="date" value="${esc(entry?.posted_date || "")}" ${posted ? "" : "disabled"}></label>
      <label class="posted-field posted-url">link
        <input type="url" placeholder="https://www.linkedin.com/…" value="${esc(entry?.url || "")}" ${posted ? "" : "disabled"}></label>
      ${posted && entry?.url ? `<a class="ghost sm" href="${esc(entry.url)}" target="_blank" rel="noopener">${ibtn("open", "Open the post")}</a>` : ""}
    </div>`);

  const check = $("input[type=checkbox]", box);
  const date = $("input[type=date]", box);
  const url = $("input[type=url]", box);
  const save = async () => {
    try {
      const r = await api.putSocialStatus(deck.slug, {
        status: check.checked ? "posted" : "draft",
        posted_date: check.checked ? (date.value || todayISO()) : "",
        url: check.checked ? url.value.trim() : "",
      });
      box.replaceWith(postedBar(deck, r.entry));
    } catch (e) { toast(e.message || "could not save the posted state"); }
  };
  check.addEventListener("change", () => { if (check.checked && !date.value) date.value = todayISO(); save(); });
  date.addEventListener("change", save);
  url.addEventListener("change", save);
  return box;
}

// ------------------------------------------------------------------- visual

// `vis` is the row that HOLDS the visual: the artifact itself for a carousel or
// an image, the paired hero row for an article. Preview from the same lazy
// thumb endpoint the lists use; the download is the kind-appropriate file.
function visualPanel(deck, vis, visN, hero) {
  const words = KIND_WORDS[deck.kind] || KIND_WORDS.post;
  if (deck.kind === "article" && !hero) {
    return el(`<div class="facet-panel"><p class="note">No visual yet. The hero is built by an
      owner beside the article (a <span class="mono">&lt;slug&gt;-hero</span> image); once it is
      published it appears here.</p></div>`);
  }
  const isCarousel = vis.kind === "carousel";
  const pages = Number(vis.page_count) || 1;
  const strip = isCarousel && pages > 1
    ? Array.from({ length: pages }, (_, i) =>
        `<img class="vis-page" loading="lazy" alt="page ${i + 1}"
              src="/api/decks/${esc(vis.id)}/versions/${visN}/thumb?page=${i + 1}">`).join("")
    : `<img class="vis-one" alt="the visual" src="/api/decks/${esc(vis.id)}/versions/${visN}/thumb">`;

  const box = el(`
    <div class="facet-panel">
      <div class="row-actions facet-actions">
        <button class="ghost sm" id="v-view">${ibtn("preview", "View full size")}</button>
        ${isCarousel
          ? `<button class="ghost sm" id="v-pdf">${ibtn("download", "Download PDF")}</button>`
          : `<a class="ghost sm" href="${esc(api.deckPngUrl(vis.id, visN))}" download>${ibtn("download", "Download PNG")}</a>`}
        <button class="ghost sm" id="v-edit" title="Words, spacing, images — and the size/ratio">${ibtn("text", "Edit the visual")}</button>
        <span class="note">${esc(words.visual)}</span>
      </div>
      <div class="vis-strip">${strip}</div>
    </div>`);

  // A page that cannot be rendered here (hosted, never printed) hides rather
  // than sitting in the strip as a broken image; View full size still works.
  $$("img", box).forEach((img) => img.addEventListener("error", () => img.remove()));

  $("#v-view", box).addEventListener("click", () =>
    deckVersionViewer(api, vis.id, visN, decodeEntities(vis.title || deck.title),
      { png: !isCarousel }));
  // Editing the visual is editing a FACET of this publication, so the editor is
  // told to come back here — for an article the visual is a different row, and
  // without the back target you surfaced on that row's lookalike page.
  $("#v-edit", box).addEventListener("click", () =>
    go(`/deck/${vis.id}/edit?back=/deck/${deck.id}`));
  $("#v-pdf", box)?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { toast(`Downloaded ${await api.downloadDeckPdf(vis.id, visN)}`); }
    catch (err) { toast(err.message || "could not download"); }
    finally { b.disabled = false; }
  });
  return box;
}

// --------------------------------------------------------------- short form

function shortPanel(deck) {
  // The editor IS the tab: toolbar, text and the feed preview, in place. No
  // modal — the screen is already open, and a modal was one more surface with
  // its own buttons. Copy and Save sit in the toolbar, at the top.
  const box = el(`
    <div class="facet-panel">
      <p class="note">The text above the visual in the feed — the hook, the point, the hashtags.
        Styling is Unicode (LinkedIn has no rich text); Copy takes the whole post.</p>
    </div>`);
  const panel = postEditorPanel(deck, deck.post_text || "", {
    onSaved: (t) => { deck.post_text = t; },
  });
  box.append(panel.node);
  return box;
}

// ---------------------------------------------------------------- long form

// The article, rendered as the reading document it is (the /view endpoint,
// which the browser can scroll — a flowing text has no pages to flip). Copy
// puts the body on the clipboard as text/html AND text/plain, so pasting into
// LinkedIn's article editor keeps headings, bold and links.
function longPanel(deck, n) {
  const box = el(`
    <div class="facet-panel">
      <div class="row-actions facet-actions">
        <button class="ghost sm" id="l-copy">${ibtn("copy", "Copy the article")}</button>
        <button class="ghost sm" id="l-open">${ibtn("open", "Open in a tab")}</button>
        <button class="ghost sm" id="l-edit" title="Words, spacing and images, in place">${ibtn("text", "Edit the article")}</button>
        <span class="note">Copy keeps headings, bold and links for LinkedIn's article editor.
          There is no PDF of an article: it is a text you publish, not a file you send.</span>
      </div>
      <iframe class="article-frame" src="${esc(api.deckViewUrl(deck.id, n))}" title="The article"></iframe>
    </div>`);
  $("#l-open", box).addEventListener("click", () => window.open(api.deckViewUrl(deck.id, n), "_blank", "noopener"));
  $("#l-edit", box).addEventListener("click", () => go(`/deck/${deck.id}/edit?back=/deck/${deck.id}`));
  $("#l-copy", box).addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try {
      const html = await api.getDeckVersionHtml(deck.id, n);
      const { rich, plain } = articleBody(html);
      // ClipboardItem carries both flavours; the paste target picks. Fall back
      // to plain text where the API is not available (http, older browsers).
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([rich], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      toast("Article copied. Paste it into LinkedIn's article editor.");
    } catch (err) { toast(err.message || "could not copy"); }
    finally { b.disabled = false; }
  });
  return box;
}

// The long form as PLAIN TEXT: the same body the HTML tab renders, flattened to
// paragraphs for pasting straight into LinkedIn's article editor when you want
// its own typography rather than a formatted paste. Fetched once and kept; the
// count is there because LinkedIn caps an article around 110k characters.
function textPanel(deck, n) {
  const box = el(`
    <div class="facet-panel">
      <p class="note">The article as plain text — paste it into LinkedIn's article setup and
        let LinkedIn do the styling. Headings become their own lines.</p>
      <div class="loading">Extracting the text…</div>
    </div>`);
  (async () => {
    try {
      const html = await api.getDeckVersionHtml(deck.id, n);
      const { plain } = articleBody(html);
      const load = $(".loading", box);
      load.replaceWith(el(`<div>
        <div class="row-actions facet-actions">
          <button class="ghost sm" id="t-copy">${ibtn("copy", "Copy the text")}</button>
          <span class="note">${Array.from(plain).length} characters</span>
        </div>
        <pre class="article-text">${esc(plain)}</pre>
      </div>`));
      $("#t-copy", box).addEventListener("click", async () => {
        await navigator.clipboard.writeText(plain);
        toast("Text copied. Paste it into LinkedIn's article editor.");
      });
    } catch (e) {
      $(".loading", box).replaceWith(el(`<p class="note">Could not extract the text: ${esc(e.message)}</p>`));
    }
  })();
  return box;
}

// The article body, stripped of what only makes sense on the rendered page: the
// wordmark and the page footer. Everything else — headings, paragraphs, lists,
// stats, sources — is the article and travels with the paste.
function articleBody(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // .ameta is the rendered page's byline (date, read time, author) — LinkedIn
  // stamps its own on an article, so pasting ours would print it twice.
  for (const sel of [".awm", ".afoot", ".ameta"]) doc.querySelectorAll(sel).forEach((n) => n.remove());
  const sections = [...doc.querySelectorAll("section")];
  const root = sections.length ? sections : [doc.body];
  const rich = root.map((s) => s.innerHTML).join("\n");

  // Footnote superscripts survive the RICH paste as superscripts, but in plain
  // text they flatten into stray digits glued to sentences ("anything.1"), so
  // the plain flavour drops them. The sources list itself stays.
  doc.querySelectorAll("sup").forEach((n) => n.remove());

  // Plain text is derived from the STRUCTURE, not from textContent: a detached
  // document has no layout, so innerText degrades to textContent and paragraph
  // breaks would only survive by the accident of pretty-printed source. One
  // block element becomes one paragraph; a list item keeps a bullet.
  const blocks = [];
  const walk = (node) => {
    for (const c of node.children) {
      if (c.matches("h1, h2, h3, p, blockquote")) {
        blocks.push(c.textContent.trim().replace(/\s+/g, " "));
      } else if (c.matches("li")) {
        blocks.push("• " + c.textContent.trim().replace(/\s+/g, " "));
      } else if (c.children.length) {
        walk(c);
      } else if (c.textContent.trim()) {
        blocks.push(c.textContent.trim().replace(/\s+/g, " "));
      }
    }
  };
  for (const r of root) walk(r);
  // Adjacent bullets stay one line apart; everything else gets a blank line.
  let plain = "";
  for (let i = 0; i < blocks.length; i++) {
    if (i === 0) plain = blocks[i];
    else if (blocks[i].startsWith("•") && blocks[i - 1].startsWith("•")) plain += "\n" + blocks[i];
    else plain += "\n\n" + blocks[i];
  }
  return { rich, plain: plain.trim() };
}

// ------------------------------------------------------------------- rename

// The lean rename for a social artifact: the title, and the filename core for
// the kinds that ship a file. No master naming rules here — social is never a
// master and never carries a client slug.
function openRename(deck, done) {
  const m = el(`<div class="modal"><div class="modal-box">
    <header><b>Rename</b><button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body">
      <div class="field"><label for="r-title">Title</label>
        <input id="r-title" type="text" value="${esc(decodeEntities(deck.title))}" maxlength="200"></div>
      <div class="field"><label for="r-core">Filename</label>
        <input id="r-core" type="text" value="${esc(deck.pdf_core || "")}" placeholder="leave empty to derive from the slug">
        <p class="note">The middle of the downloaded file's name. The date and
          <span class="mono">oppr</span> stay automatic.</p></div>
      <div class="modal-actions"><button class="primary" id="r-save">Save</button></div>
    </div>
  </div></div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  $("#r-save", m).addEventListener("click", async () => {
    try {
      await api.renameDeck(deck.id, { title: $("#r-title", m).value, pdf_core: $("#r-core", m).value });
      close();
      await loadBackend(api);
      toast("Renamed.");
      done();
    } catch (e) { toast(e.message || "rename failed"); }
  });
  document.body.append(m);
  setTimeout(() => $("#r-title", m).focus(), 30);
}
