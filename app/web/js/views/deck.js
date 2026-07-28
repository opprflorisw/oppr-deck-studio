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

  const badges = [
    deck.is_master ? `<span class="badge badge--master">MASTER</span>` : "",
    `<span class="badge">${esc(deck.type || "—")}</span>`,
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
          <h1>${esc(decodeEntities(deck.title))}</h1>
          <div class="cust-meta">${badges}<span class="mono note">${esc(deck.slug)}</span></div>
        </div>
        <div class="deck-actions">
          <button class="primary" id="open">${ibtn("preview", "Open")}</button>
          <button class="ghost" id="edit">${ibtn("compose", "Edit")}</button>
          <button class="ghost" id="regen">${ibtn("refresh", "Regenerate PDF")}</button>
          ${deck.is_master ? `<button class="ghost" id="personalize">${ibtn("clone", "Personalize")}</button>` : ""}
          <button class="ghost" id="master">${deck.is_master ? ibtn("layers", "Master ✓") : ibtn("layers", "Make master")}</button>
        </div>
      </div>
      ${deck.status === "needs_cli" ? needsCliBanner(deck) : ""}
      <div id="build-status"></div>
      <div class="section-head"><h2>Versions</h2><span class="section-count">${versions.length}</span></div>
      <div id="versions"></div>
      ${deck.is_master ? `<div class="section-head"><h2>Family</h2><span class="section-count">${family.length}</span></div><div id="family"></div>` : ""}
    </div>`);

  const cur = deck.current_version_n;
  $("#back", wrap).addEventListener("click", () => history.length > 1 ? history.back() : go("/output/masters"));
  $("#open", wrap).addEventListener("click", () => deckVersionViewer(api, deck.id, cur, decodeEntities(deck.title), versions.find((v) => v.n === cur)?.has_pdf));
  $("#edit", wrap).addEventListener("click", () => go(`/deck/${deck.id}/edit`));
  $("#regen", wrap).addEventListener("click", () => regenerate(deck.id, wrap, mount));
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
          ${v.has_pdf ? `<a class="ghost icon-only" href="${esc(api.deckPdfUrl(deck.id, v.n))}" download title="Download PDF">${icon("download")}</a>` : ""}
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

function needsCliBanner(deck) {
  const prompt = `/deckbuilder edit ${deck.slug} — ${deck.needs_cli_reason}`;
  return `<div class="needs-cli">
    <div><b>This deck needs the CLI.</b> The last regenerate failed verification: <span class="note">${esc(deck.needs_cli_reason)}</span></div>
    <div class="prompt-box"><code>${esc(prompt)}</code></div>
  </div>`;
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
