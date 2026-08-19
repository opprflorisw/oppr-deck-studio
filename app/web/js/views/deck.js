// Deck detail (Deck Studio v3): a backend deck's header, actions, version
// timeline and (for a master) its family of derived decks. Actions: Open a
// version in the viewer, Edit, Regenerate the PDF (runs the same verify gate as
// the CLI), Personalize a master for a customer/event, toggle the master tag.

import { $, $$, el, esc, decodeEntities, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon, ibtn } from "../icons.js";
import { deckVersionViewer } from "./viewer.js";
import { openPersonalize } from "./personalize.js";
import { explain, summarize } from "../verify.js";
import { openPostEditor } from "../postedit.js";
import { mountNote } from "../note.js";

// Which kinds carry post copy. Same set artifacts.js uses; a carousel and an
// image both go out with text above them, a deck does not.
const SOCIAL_KINDS = new Set(["carousel", "image", "article", "post"]);

// "Edit" is two jobs, and the server already knows they are two jobs:
// `htmlcheck.mjs` allows text and attribute changes and rejects everything
// structural. So the button says so out loud rather than sending you to one
// editor that refuses half of what you came to do.
//
// Only a deck has a slide sorter — a carousel or a social image is not composed
// from library slides, so it keeps the single door it always had.
function editDoors(deck) {
  const isDeck = !deck.kind || deck.kind === "deck";
  if (!isDeck) return `<button class="primary" id="edit">${ibtn("compose", "Edit")}</button>`;
  return `
    <span class="split-btn">
      <button class="primary" id="edit-slides" title="Which slides, and in what order">
        ${ibtn("cards", "Edit slides")}</button>
      <button class="ghost" id="edit" title="Words, spacing and images, in place">
        ${ibtn("text", "Edit text")}</button>
    </span>`;
}

export function offlinePanel(area) {
  return el(`<div>
    <div class="subbar area-bar"><div class="area-title">${icon("monitor", 20)}<h1 class="page-title">${esc(area)}</h1></div></div>
    <div class="empty">
      <p>The deck backend is not reachable.</p>
      <p class="note">Set <span class="mono">SUPABASE_URL</span> and <span class="mono">SUPABASE_SECRET_KEY</span> in <span class="mono">.env</span> (see <span class="mono">.env.example</span>) and restart the app. The Library, Social and Knowledge areas work without it.</p>
    </div>
  </div>`);
}

export async function renderDetail(id, mount) {
  mount(el(`<div class="loading">Loading deck…</div>`));
  let data;
  try { data = await api.getDeck(id); }
  catch { return mount(offlinePanel("Deck")); }
  const { deck, versions, family } = data;
  const pdf = data.pdf || { name: "", current: false, verify: null };
  const current = versions.find((v) => v.n === deck.current_version_n);

  const badges = [
    deck.is_master ? `<span class="badge badge--master">MASTER</span>` : "",
    `<span class="badge">${esc(deck.kind && deck.kind !== "deck" ? deck.kind : deck.type || "—")}</span>`,
    deck.audience_kind && deck.audience_kind !== "general" ? `<span class="tags">${esc(deck.audience_label || deck.audience_kind)}</span>` : "",
    deck.status === "needs_cli" ? `<span class="pill-status draft">needs CLI</span>` : `<span class="pill-status posted">ok</span>`,
  ].filter(Boolean).join("");

  const wrap = el(`
    <div>
      <div class="detail-head">
        <button class="ghost" id="back">${ibtn("prev", "Back")}</button>
      </div>
      <div class="deck-detail-head">
        <div class="deck-id">
          <div class="row-title">
            <button class="star-btn ${deck.starred ? "on" : ""}" id="star"
                    title="${deck.starred ? "Starred — click to remove" : "Star this so it sorts first"}"
                    aria-pressed="${deck.starred ? "true" : "false"}">${icon("star", 18)}</button>
            <h1>${esc(decodeEntities(deck.title))}</h1>
          </div>
          <div class="cust-meta">${badges}<span class="mono note">${esc(deck.slug)}</span>
            <span class="note">${current ? `${current.page_count || "?"} pages` : ""}</span></div>
          <div class="row-note detail-note"></div>
        </div>
        <div class="deck-actions">
          <button class="ghost" id="open">${ibtn("preview", "Open")}</button>
          ${editDoors(deck)}
          ${SOCIAL_KINDS.has(deck.kind) ? `<button class="ghost" id="posttext">${ibtn("text", "Post text")}</button>` : ""}
          <button class="ghost" id="download">${ibtn("download", "Download PDF")}</button>
          <button class="ghost" id="rename">${ibtn("compose", "Rename")}</button>
          ${deck.is_master ? `<button class="ghost" id="personalize">${ibtn("clone", "Personalize")}</button>` : ""}
          <button class="ghost" id="master">${deck.is_master ? ibtn("layers", "Master ✓") : ibtn("layers", "Make master")}</button>
          <button class="ghost ${deck.archived ? "" : "danger"}" id="archive"
                  title="${deck.archived
                    ? "Bring this deck back into the index"
                    : "Take it out of the index. Nothing is deleted: every version and PDF stays."}">
            ${deck.archived ? ibtn("history", "Restore") : ibtn("trash", "Archive")}</button>
        </div>
      </div>
      ${pdfStatusBar(pdf, deck)}
      ${draftBanner(deck)}
      ${deck.status === "needs_cli" ? needsCliBanner(deck) : ""}
      <div id="build-status"></div>
      ${findingsBlock(pdf.verify)}
      <div class="section-head"><h2>Versions</h2><span class="section-count">${versions.length}</span></div>
      <div id="versions"></div>
      ${deck.is_master ? `<div class="section-head"><h2>Family</h2><span class="section-count">${family.length}</span></div><div id="family"></div>` : ""}
    </div>`);

  const cur = deck.current_version_n;
  // The note and the star are the same controls as in the list, on purpose: what
  // you write about an artifact should be writable wherever you are looking at
  // it, and read back identically in both places.
  mountNote(wrap, deck, { placeholder: "Add a note (shown in the overview)…" });
  $("#star", wrap).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const next = !deck.starred;
    deck.starred = next;
    btn.classList.toggle("on", next);
    btn.setAttribute("aria-pressed", String(next));
    try { await api.patchDeck(deck.id, { starred: next }); await loadBackend(api); }
    catch (err) { deck.starred = !next; btn.classList.toggle("on", !next); toast(err.message || "could not save the star"); }
  });
  $("#posttext", wrap)?.addEventListener("click", () =>
    openPostEditor(deck, deck.post_text || "", (text) => { deck.post_text = text; }));
  $("#back", wrap).addEventListener("click", () => history.length > 1 ? history.back() : go("/output/masters"));
  $("#open", wrap).addEventListener("click", () => deckVersionViewer(api, deck.id, cur, decodeEntities(deck.title), versions.find((v) => v.n === cur)?.has_pdf));
  $("#edit", wrap).addEventListener("click", () => go(`/deck/${deck.id}/edit`));
  $("#edit-slides", wrap)?.addEventListener("click", () => go(`/build/${deck.id}`));
  $("#archive", wrap).addEventListener("click", async () => {
    const next = !deck.archived;
    try {
      await api.patchDeck(deck.id, { archived: next });
      await loadBackend(api);
      toast(next
        ? "Archived. It is out of the index; every version and PDF is untouched."
        : "Back in the index.");
      renderDetail(deck.id, mount);
    } catch (e) { toast(e.message || "could not change that"); }
  });
  $("#download", wrap).addEventListener("click", () => downloadCurrent(deck, cur, wrap, mount));
  $("#rename", wrap).addEventListener("click", () => openRename(deck, pdf.name, mount));
  $("#personalize", wrap)?.addEventListener("click", () => openPersonalize(deck));
  $("#master", wrap).addEventListener("click", async () => {
    try {
      await api.setDeckMaster(deck.id, !deck.is_master);
      await loadBackend(api);
      toast(deck.is_master ? "Master tag removed." : "Tagged as master.");
      renderDetail(deck.id, mount);
    } catch (e) { toast(e.message || "could not update"); }
  });

  const vbox = $("#versions", wrap);
  for (const v of versions) vbox.append(versionRow(deck, v, cur, mount));

  if (deck.is_master) {
    const fbox = $("#family", wrap);
    if (!family.length) fbox.innerHTML = `<p class="note">No derived decks yet. Use Personalize to make one for a customer or event.</p>`;
    else for (const f of family) fbox.append(familyRow(f));
  }
  mount(wrap);
}

// "Is my PDF current?" — the one question the old UI could not answer. It never
// showed a download at all until a build had run, so an edited deck looked as if
// it had no PDF rather than a stale one.
function pdfStatusBar(pdf, deck) {
  const state = pdf.current
    ? `<span class="pill-status posted">PDF is current</span>`
    : `<span class="pill-status draft">PDF not printed yet</span>`;
  const note = pdf.current
    ? "This file matches the version on screen."
    : "Download will print it from the current version first, so what you get always matches the screen.";
  return `<div class="pdf-status">
    ${state}
    <span class="mono">${esc(pdf.name || "—")}</span>
    <span class="note">${esc(note)}</span>
  </div>`;
}

// A deck left half-composed in the builder. It changes nothing about the
// published version — that is the point — but a deck page that stayed silent
// about it would let you forget the work entirely.
function draftBanner(deck) {
  if (!deck.draft_recipe) return "";
  const n = (deck.draft_recipe.order || []).length;
  return `<div class="bnotice">
    <b>Unpublished changes in the deck builder</b>
    <span class="note">${n} slide${n === 1 ? "" : "s"} picked, last saved
      ${esc((deck.draft_updated_at || "").slice(0, 10))}. v${deck.current_version_n}
      and its PDF are untouched until you publish.</span>
    <a class="btn sm" href="#/build/${esc(deck.id)}">Open the builder</a>
  </div>`;
}

// The verify report, said in words, with who fixes each thing.
function findingsBlock(report) {
  const found = explain(report);
  if (!found.length) return "";
  const rows = found.map((f) => `
    <li class="finding finding--${f.level}">
      <div class="finding-head">
        <b>${esc(f.title)}</b>
        ${f.slideId ? `<span class="tags mono">${esc(f.slideId)}</span>` : ""}
        <span class="tags">${esc(f.whereLabel)}</span>
      </div>
      ${f.fix ? `<div class="note">${esc(f.fix)}</div>` : ""}
      <div class="note mono finding-detail">${esc(f.detail)}</div>
    </li>`).join("");
  const fails = found.filter((f) => f.level === "fail").length;
  return `<div class="section-head"><h2>Verification</h2>
      <span class="section-count">${fails ? `${fails} to fix` : "clean"}</span></div>
    <ul class="findings">${rows}</ul>`;
}

function versionRow(deck, v, cur, mount) {
  const summary = v.verify_summary
    ? `<span class="tags ${v.verify_summary.fails ? "pill-status draft" : ""}">${v.verify_summary.fails} fail · ${v.verify_summary.warns} warn</span>`
    : "";
  const row = el(`
    <div class="deck-row version-row ${v.n === cur ? "is-current" : ""}">
      <div class="head">
        <h3>v${v.n}${v.n === cur ? ' <span class="tags">current</span>' : ""}</h3>
        <span class="note">${esc((v.created_at || "").slice(0, 10))} · ${esc(v.author)}</span>
        <span class="tags">${esc(v.change_note || "")}</span>
        ${summary}
        <div class="spacer">
          <button class="ghost icon-only view" title="View this version">${icon("preview")}</button>
          ${v.has_pdf || v.n === cur
            ? `<a class="ghost icon-only" href="${esc(api.deckPdfUrl(deck.id, v.n))}" download
                 title="${v.has_pdf ? "Download PDF" : "Print this version and download"}">${icon("download")}</a>`
            : `<span class="ghost icon-only is-disabled" title="This older version was never printed">${icon("download")}</span>`}
          ${v.n !== cur ? `<button class="ghost icon-only restore" title="Restore as a new version">${icon("history")}</button>` : ""}
        </div>
      </div>
    </div>`);
  $(".view", row).addEventListener("click", () => deckVersionViewer(api, deck.id, v.n, `${decodeEntities(deck.title)} · v${v.n}`, v.has_pdf));
  $(".restore", row)?.addEventListener("click", async () => {
    try { await api.restoreDeckVersion(deck.id, v.n); await loadBackend(api); toast(`Restored v${v.n} as a new version.`); renderDetail(deck.id, mount); }
    catch (e) { toast(e.message || "could not restore"); }
  });
  return row;
}

function familyRow(f) {
  const row = el(`
    <div class="deck-row">
      <div class="head">
        <h3>${esc(decodeEntities(f.title))}</h3>
        <span class="tags">${esc(f.audience_label || f.audience_kind)}</span>
        <span class="note">from v${f.derived_from_version_n ?? "?"}</span>
        ${f.status === "needs_cli" ? `<span class="pill-status draft">needs CLI</span>` : ""}
        <div class="spacer"><button class="ghost icon-only open" title="Open">${icon("open")}</button></div>
      </div>
    </div>`);
  row.querySelector(".open").addEventListener("click", () => go("/deck/" + f.id));
  return row;
}

// What to do when the last build failed the gate. It used to print a CLI command,
// which is no help at all to a colleague who has never installed Claude Code --
// and the fix is nearly always in the builder anyway.
function needsCliBanner(deck) {
  return `<div class="needs-cli">
    <div><b>This deck did not pass verification.</b>
      <span class="note">${esc(deck.needs_cli_reason)}</span></div>
    <div class="note">Open <b>Edit slides</b> and use <b>Check</b> to see the findings in full,
      or ask an owner if it is the slide itself that is wrong.</div>
  </div>`;
}

// Download the current version. The server prints on demand when it is stale,
// so this can take a few seconds the first time after an edit — say so rather
// than looking frozen.
async function downloadCurrent(deck, n, wrap, mount) {
  const box = $("#build-status", wrap);
  const btn = $("#download", wrap);
  btn.disabled = true;
  box.innerHTML = `<div class="build-status running">${icon("refresh", 15)} Printing the current version and verifying…</div>`;
  try {
    const name = await api.downloadDeckPdf(deck.id, n);
    box.innerHTML = `<div class="build-status pass">${icon("info", 15)} Downloaded <span class="mono">${esc(name)}</span></div>`;
    await loadBackend(api);
    setTimeout(() => renderDetail(deck.id, mount), 900);
  } catch (e) {
    if (e.status === 409) {
      box.innerHTML = "";
      box.append(failedGate(deck, n, e, wrap, mount));
    } else {
      box.innerHTML = `<div class="build-status fail">Could not produce the PDF: ${esc(e.message)}</div>`;
    }
  } finally {
    btn.disabled = false;
  }
}

// Verify failed, so the PDF is withheld from the version. You can still take the
// file — explicitly, and clearly marked — because being unable to send anything
// is worse than sending something you were warned about. It is never attached to
// the version, so it can never become the PDF of record.
function failedGate(deck, n, err, wrap, mount) {
  const found = explain(err.verify_report);
  const box = el(`<div class="build-status fail">
    <b>Verification failed, so the PDF was not attached to this version.</b>
    <ul class="findings findings--inline">${found.filter((f) => f.level === "fail").map((f) =>
      `<li><b>${esc(f.title)}</b> <span class="tags">${esc(f.whereLabel)}</span><div class="note">${esc(f.fix || f.detail)}</div></li>`).join("")}</ul>
    ${err.canDownloadUnverified ? `<button class="ghost" id="anyway">${ibtn("download", "Download anyway, marked unverified")}</button>` : ""}
  </div>`);
  $("#anyway", box)?.addEventListener("click", async () => {
    try {
      const name = await api.downloadDeckPdf(deck.id, n, { unverified: true });
      toast(`Downloaded ${name}`);
    } catch (e2) { toast(e2.message || "could not download"); }
  });
  return box;
}

// Rename: the title is yours entirely; the filename is yours in the middle only.
// The date, the `oppr` token and the client slug stay system-owned because
// verify-deck.py FAILs a PDF missing them, and a rename must not defeat a gate.
function openRename(deck, currentName, mount) {
  const m = el(`<div class="modal"><div class="modal-box">
    <header><b>Rename</b><button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body">
      <div class="field"><label for="r-title">Title</label>
        <input id="r-title" type="text" value="${esc(decodeEntities(deck.title))}" maxlength="200"></div>
      <div class="field"><label for="r-core">Filename</label>
        <input id="r-core" type="text" value="${esc(deck.pdf_core || "")}" placeholder="leave empty to derive from the slug"></div>
      <p class="note">Result: <span class="mono" id="r-preview">${esc(currentName)}</span></p>
      <p class="note">You choose the middle segment. The date, <span class="mono">oppr</span> and the client slug stay
        automatic, because verify fails a PDF that is missing them.</p>
      <div class="modal-actions"><button class="primary" id="r-save">Save</button></div>
    </div>
  </div></div>`);
  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });

  const preview = () => {
    const core = $("#r-core", m).value.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-");
    const dm = /^(\d{4}-\d{2}-\d{2})[_-](.+)$/.exec(deck.slug);
    let out;
    if (deck.is_master) {
      out = `oppr_${core || deck.type}.pdf`;
    } else {
      const parts = [];
      if (dm) parts.push(dm[1]);
      parts.push("oppr");
      const body = core || (dm ? dm[2] : deck.slug);
      if (body && body !== "oppr") parts.push(body);
      if (deck.client_slug && !parts.join("-").includes(deck.client_slug)) parts.push(deck.client_slug);
      out = parts.join("_") + ".pdf";
    }
    $("#r-preview", m).textContent = out;
  };
  $("#r-core", m).addEventListener("input", preview);
  // Compute it up front too: the modal must show the resulting filename
  // before you touch anything, not only after the first keystroke.
  preview();

  $("#r-save", m).addEventListener("click", async () => {
    try {
      const out = await api.renameDeck(deck.id, {
        title: $("#r-title", m).value,
        pdf_core: $("#r-core", m).value,
      });
      close();
      await loadBackend(api);
      toast(`Renamed. PDF will be ${out.pdf_name}`);
      renderDetail(deck.id, mount);
    } catch (e) { toast(e.message || "rename failed"); }
  });
  document.body.append(m);
  setTimeout(() => $("#r-title", m).focus(), 30);
}

async function regenerate(id, wrap, mount) {
  const box = $("#build-status", wrap);
  box.innerHTML = `<div class="build-status running">${icon("refresh", 15)} Regenerating PDF and verifying…</div>`;
  let job;
  try { job = await api.buildDeck(id); }
  catch (e) { box.innerHTML = `<div class="build-status fail">Could not start: ${esc(e.message)}</div>`; return; }
  const jobId = job.job_id;
  const poll = setInterval(async () => {
    let s;
    try { s = await api.getJob(jobId); } catch { return; }
    if (s.state === "running") return;
    clearInterval(poll);
    if (s.state === "pass") {
      box.innerHTML = `<div class="build-status pass">${icon("info", 15)} PDF regenerated and verified.${warnLine(s)}</div>`;
      await loadBackend(api);
      setTimeout(() => renderDetail(id, mount), 700);
    } else {
      const fails = (s.verify_report?.fails || []).map((f) => `<li>${esc(f)}</li>`).join("");
      box.innerHTML = `<div class="build-status fail"><b>Verification failed — PDF withheld.</b><ul>${fails}</ul></div>`;
      await loadBackend(api);
      setTimeout(() => renderDetail(id, mount), 1400);
    }
  }, 1000);
}

function warnLine(s) {
  const w = s.verify_report?.warns || [];
  return w.length ? ` <span class="note">(${w.length} warning${w.length === 1 ? "" : "s"})</span>` : "";
}
