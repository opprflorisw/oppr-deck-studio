// Last 30 days — the research area.
//
// Three tabs, one idea: every `/last30days` run is recorded as structured
// knowledge, and the Brain is what those runs add up to. The Brain page reads
// brain.json (built by tools/research-brain.py from the runs), so it grows on
// its own every time a run is recorded — nothing here is hand-maintained.
//
//   Brain  — accumulated beliefs, vocabulary, numbers, entities, open questions
//   Runs   — one card per run, drilling into the full record + saved artifacts
//   Posts  — LinkedIn drafts written off the brain, ready to copy
//
// The app never writes a run. "Rebuild" shells out to the CLI aggregator and
// "Sync" mirrors the folder to the backend; both live on the server.

import { $, $$, el, esc, toast } from "../util.js";
import * as api from "../api.js";
import { renderMarkdown } from "../md.js";
import { icon } from "../icons.js";
import { go } from "../router.js";

// Cached across tab switches so flipping Brain/Runs/Posts is instant.
let CACHE = null;
const load = async (force) => {
  if (force || !CACHE) CACHE = await api.getResearch();
  return CACHE;
};
export const invalidate = () => { CACHE = null; };

const CONF = { established: "Established", corroborated: "Corroborated", emerging: "Emerging" };

function shell(bodyFn) {
  const box = el(`<div class="rsrch"><div class="loading">Loading research…</div></div>`);
  load()
    .then((data) => { box.innerHTML = ""; box.append(bodyFn(data)); })
    .catch(() => {
      box.innerHTML = `<div class="empty"><p>Could not read the research folder.</p>
        <p class="note">Expected <code>research/last30days/</code>. Run a <code>/last30days</code> job, then
        <code>python tools/research-brain.py</code>.</p></div>`;
    });
  return box;
}

export function renderBody(tab = "brain") {
  if (tab === "runs") return shell(runsBody);
  if (tab === "posts") return shell(postsBody);
  if (tab === "performance") return shell(perfBody);
  return shell(brainBody);
}

// --- Brain -------------------------------------------------------------------

function brainBody(data) {
  if (!data.brain) {
    return el(`<div class="empty"><p>No brain yet.</p>
      <p class="note">Record a run, then build it: <code>python tools/research-brain.py</code></p></div>`);
  }
  const b = data.brain;
  const box = el(`
    <div>
      <div class="brain-head">
        <div>
          <h2 class="brain-title">What the studio knows</h2>
          <p class="note">Built from ${data.runs.length} recorded run${data.runs.length === 1 ? "" : "s"} on ${esc(b.generated)}.
          A theme seen once is emerging, twice corroborated, three times or more established.</p>
        </div>
        <div class="brain-actions">
          <button class="ghost" id="brain-doc">Read as document</button>
          <button class="ghost" id="brain-rebuild">Rebuild</button>
          <button class="ghost" id="brain-sync" ${data.backend ? "" : "disabled title='Backend not configured'"}>Sync to backend</button>
        </div>
      </div>
      <div class="statstrip">
        ${stat(b.themes, "themes")}${stat(b.established + b.corroborated, "corroborated+")}
        ${stat(b.vocabulary, "terms")}${stat(b.stats, "sourced stats")}
        ${stat(b.entities, "entities")}${stat(b.questions, "open questions")}
      </div>
      <div id="brain-slot"><div class="loading">Loading brain…</div></div>
    </div>`);

  const slot = $("#brain-slot", box);
  api.getBrain().then((full) => { slot.innerHTML = ""; slot.append(brainDetail(full)); })
    .catch(() => { slot.innerHTML = `<p class="note">Could not load brain.json.</p>`; });

  $("#brain-doc", box).addEventListener("click", async () => {
    slot.innerHTML = `<div class="loading">Loading…</div>`;
    try { slot.innerHTML = `<article class="md doc-wide">${renderMarkdown(await api.getBrainMd())}</article>`; }
    catch { slot.innerHTML = `<p class="note">Could not load brain.md.</p>`; }
  });
  $("#brain-rebuild", box).addEventListener("click", async (e) => {
    e.target.disabled = true; toast("Rebuilding the brain…");
    try {
      const r = await api.rebuildBrain();
      toast(r.ok ? "Brain rebuilt." : "Rebuild failed.");
      invalidate(); go("/research/brain");
    } catch { toast("Rebuild failed."); e.target.disabled = false; }
  });
  $("#brain-sync", box).addEventListener("click", async (e) => {
    e.target.disabled = true; toast("Syncing to backend…");
    try { const r = await api.syncResearch(); toast(`Synced ${r.uploaded} files.`); }
    catch (err) { toast("Sync failed: " + err.message); }
    e.target.disabled = false;
  });
  return box;
}

const stat = (n, label) => `<div class="statcell"><b>${n}</b><span>${esc(label)}</span></div>`;

function brainDetail(full) {
  const box = el(`<div></div>`);

  box.append(section("What we believe", (full.themes || []).map((t) => `
    <article class="theme">
      <div class="theme-top">
        <h4>${esc(t.label)}</h4>
        <span class="chip conf-${esc(t.confidence)}">${esc(CONF[t.confidence] || t.confidence)}</span>
        <span class="chip stance">${esc(t.stance)}</span>
      </div>
      <p>${esc(t.summary)}</p>
      <p class="note">Seen in ${t.seen} run${t.seen === 1 ? "" : "s"} · ${esc((t.topics || []).join(", "))}</p>
    </article>`).join("") || `<p class="note">No themes yet.</p>`));

  const byKind = {};
  for (const v of full.vocabulary || []) (byKind[v.kind || "other"] ||= []).push(v);
  box.append(section("The vocabulary", Object.entries(byKind).map(([kind, items]) => `
    <div class="vocab-group">
      <h4 class="vocab-kind">${esc(kind)}</h4>
      <ul class="plain vocab-list">
        ${items.map((v) => `<li><code class="term">${esc(v.term)}</code>${v.notes && v.notes[0] ? `<span class="note"> ${esc(v.notes[0])}</span>` : ""}</li>`).join("")}
      </ul>
    </div>`).join("") || `<p class="note">No vocabulary yet.</p>`));

  box.append(section("Sourced numbers", `<ul class="plain numlist">${(full.stats || []).map((s) => `
    <li><b class="numval">${esc(s.value)}</b> <span>${esc(s.label)}</span>
    <span class="note">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.source || "source")}</a>` : esc(s.source || "")}${s.date ? " · " + esc(s.date) : ""}</span></li>`).join("")}</ul>`));

  const byEnt = {};
  for (const e of full.entities || []) (byEnt[e.kind || "other"] ||= []).push(e);
  box.append(section("Who is in this market", Object.entries(byEnt).map(([kind, items]) => `
    <div class="vocab-group"><h4 class="vocab-kind">${esc(kind)}</h4>
      <ul class="plain">${items.map((e) => `<li><b>${esc(e.name)}</b> <span class="note">${esc(e.note || "")}</span></li>`).join("")}</ul>
    </div>`).join("")));

  if ((full.quotes || []).length) {
    box.append(section("Voices worth quoting", (full.quotes || []).map((q) => `
      <blockquote class="voice">${esc(q.text)}
        <footer>${esc(q.author || "")}${q.weight ? " · " + esc(q.weight) : ""}
        ${q.url ? ` · <a href="${esc(q.url)}" target="_blank" rel="noopener">source</a>` : ""}</footer>
      </blockquote>`).join("")));
  }

  box.append(section("Open questions", `<ul class="plain qlist">${(full.open_questions || []).map((q) => `
    <li>${esc(q.question)} <span class="note">${esc(q.topic || "")}</span></li>`).join("")}</ul>`));

  const cov = full.coverage || {};
  box.append(section("Coverage health", `
    <div class="covgrid">
      ${Object.entries(cov.items_by_source || {}).map(([k, v]) => `<div class="covcell"><b>${v}</b><span>${esc(k)}</span></div>`).join("")}
    </div>
    ${Object.keys(cov.missing_in_runs || {}).length ? `<p class="note">Missing: ${Object.entries(cov.missing_in_runs).map(([k, v]) => `${esc(k)} (${v} run${v === 1 ? "" : "s"})`).join(", ")}.</p>` : ""}
    ${Object.keys(cov.degraded_in_runs || {}).length ? `<p class="note">Degraded: ${Object.entries(cov.degraded_in_runs).map(([k, v]) => `${esc(k)} (${v} run${v === 1 ? "" : "s"})`).join(", ")}.</p>` : ""}`));

  return box;
}

function section(title, innerHtml) {
  return el(`<section class="brain-sec"><h3 class="brain-h">${esc(title)}</h3><div class="brain-sec-body">${innerHtml}</div></section>`);
}

// --- Runs --------------------------------------------------------------------

function runsBody(data) {
  if (!data.runs.length) {
    return el(`<div class="empty"><p>No runs recorded yet.</p>
      <p class="note">Run <code>/last30days &lt;topic&gt;</code>, save the run under
      <code>research/last30days/runs/</code>, then rebuild the brain.</p></div>`);
  }
  const box = el(`
    <div>
      <p class="note">Every research run, newest first. Each one folds into the brain.</p>
      <div class="runlist">
        ${data.runs.map((r) => `
          <article class="runcard" data-slug="${esc(r.slug)}">
            <div class="runcard-top">
              <span class="chip">${esc(r.date)}</span>
              <span class="chip domain">${esc(r.domain || "topic")}</span>
              <span class="chip verdict-${esc(r.verdict)}">${esc(r.verdict.replace(/-/g, " "))}</span>
            </div>
            <h4>${esc(r.topic)}</h4>
            <p class="runline">${esc(r.headline)}</p>
            <p class="note">${r.items} evidence items · ${r.findings} findings · ${r.themes} themes
              ${r.missing.length ? ` · missing ${esc(r.missing.join(", "))}` : ""}
              ${r.degraded.length ? ` · degraded ${esc(r.degraded.join(", "))}` : ""}</p>
          </article>`).join("")}
      </div>
    </div>`);
  $$(".runcard", box).forEach((c) => c.addEventListener("click", () => go("/research/runs/" + c.dataset.slug)));
  return box;
}

// Standalone run detail page (its own route, no tabbar).
export function renderRun(slug) {
  const box = el(`<div class="rsrch"><div class="loading">Loading run…</div></div>`);
  api.getResearchRun(slug).then((r) => { box.innerHTML = ""; box.append(runDetail(r)); })
    .catch(() => { box.innerHTML = `<div class="empty"><p>No such run.</p><p class="note"><a href="#/research/runs">Back to runs</a></p></div>`; });
  return box;
}

function runDetail(r) {
  const s = r.sources || {};
  const counts = s.counts || {};
  const box = el(`
    <div>
      <div class="subbar">
        <a class="ghost" href="#/research/runs">${icon("prev", 15)} Runs</a>
        <div class="spacer"></div>
        ${r.artifacts && r.artifacts.brief ? `<a class="ghost" href="${esc(api.researchBriefUrl(r.slug))}" target="_blank" rel="noopener">${icon("open", 15)} Shareable brief</a>` : ""}
        <button class="ghost" id="run-raw">${icon("text", 15)} Raw evidence</button>
      </div>

      <h2 class="brain-title">${esc(r.topic)}</h2>
      <p class="runline big">${esc(r.headline || "")}</p>
      <p class="note">${esc(r.question || "")}</p>

      <div class="statstrip">
        ${stat(r.date, "run date")}
        ${stat((r.engine && r.engine.depth) || "-", "depth")}
        ${Object.entries(counts).map(([k, v]) => stat(v, k)).join("")}
      </div>
      ${(s.missing || []).length || (s.degraded || []).length ? `<p class="warnline">
        ${(s.missing || []).length ? `Not searched: <b>${esc((s.missing || []).join(", "))}</b>. ` : ""}
        ${(s.degraded || []).length ? `Degraded: <b>${esc((s.degraded || []).join(", "))}</b>.` : ""}</p>` : ""}

      <div id="run-body"></div>
      <div id="run-raw-slot"></div>
    </div>`);

  const body = $("#run-body", box);

  body.append(section("Findings", (r.findings || []).map((f) => `
    <article class="finding">
      <h4>${esc(f.claim)}</h4>
      <p>${esc(f.evidence)}</p>
      <p class="note">${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source || "source")}</a>` : esc(f.source || "")}</p>
    </article>`).join("") || `<p class="note">No findings recorded.</p>`));

  if ((r.themes || []).length) {
    body.append(section("Themes this run contributed", (r.themes || []).map((t) => `
      <article class="theme"><div class="theme-top"><h4>${esc(t.label)}</h4>
        <span class="chip stance">${esc(t.stance || "")}</span></div>
        <p>${esc(t.summary)}</p></article>`).join("")));
  }
  if ((r.stats || []).length) {
    body.append(section("Numbers", `<ul class="plain numlist">${(r.stats || []).map((x) => `
      <li><b class="numval">${esc(x.value)}</b> <span>${esc(x.label)}</span>
      <span class="note">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.source || "")}</a>` : esc(x.source || "")}</span></li>`).join("")}</ul>`));
  }
  if ((r.quotes || []).length) {
    body.append(section("Quotes", (r.quotes || []).map((q) => `
      <blockquote class="voice">${esc(q.text)}<footer>${esc(q.author || "")}${q.weight ? " · " + esc(q.weight) : ""}
      ${q.url ? ` · <a href="${esc(q.url)}" target="_blank" rel="noopener">source</a>` : ""}</footer></blockquote>`).join("")));
  }
  if ((r.open_questions || []).length) {
    body.append(section("Open questions", `<ul class="plain qlist">${(r.open_questions || []).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`));
  }
  if ((r.caveats || []).length) {
    body.append(section("Caveats", `<ul class="plain qlist caveats">${(r.caveats || []).map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`));
  }

  const rawSlot = $("#run-raw-slot", box);
  $("#run-raw", box).addEventListener("click", async () => {
    if (rawSlot.innerHTML) { rawSlot.innerHTML = ""; return; }
    rawSlot.innerHTML = `<div class="loading">Loading raw evidence…</div>`;
    try { rawSlot.innerHTML = `<section class="brain-sec"><h3 class="brain-h">Raw evidence</h3><pre class="rawmd">${esc(await api.getResearchRunRaw(r.slug))}</pre></section>`; }
    catch { rawSlot.innerHTML = `<p class="note">No raw.md saved for this run.</p>`; }
  });

  return box;
}

// --- Posts -------------------------------------------------------------------

function postsBody(data) {
  if (!data.posts.length) {
    return el(`<div class="empty"><p>No ideas yet.</p>
      <p class="note">Ideas live in <code>research/last30days/posts/</code>.</p></div>`);
  }
  const unspent = data.posts.filter((p) => p.status !== "promoted").length;
  const box = el(`
    <div>
      <p class="note">Ideas written off the brain. They are meant to be cheap: read one, and if it is
      worth shipping, <b>promote</b> it into a social draft where you fine-tune, build and post it.
      Discarding an idea should cost nothing. ${unspent} of ${data.posts.length} unspent.</p>
      <div class="postlist">
        ${data.posts.map((p) => `
          <article class="postcard ${p.status === "promoted" ? "spent" : ""}" data-file="${esc(p.file)}">
            <div class="runcard-top">
              <span class="chip">${esc(p.kind)}</span>
              ${p.theme ? `<span class="chip domain">${esc(p.theme)}</span>` : ""}
              <span class="note">${p.chars} chars</span>
              ${p.status === "promoted"
                ? `<span class="chip conf-established">promoted ${esc(p.promoted_at || "")}</span>`
                : `<span class="chip conf-emerging">idea</span>`}
            </div>
            <h4>${esc(p.title)}</h4>
            <p class="note">${esc(p.angle || "")}</p>
            <div class="post-actions">
              <button class="ghost" data-act="open">Read</button>
              <button class="ghost" data-act="copy">Copy text</button>
              ${p.status === "promoted"
                ? `<a class="ghost" href="#/social/${p.kind === "linkedin-article" ? "post" : "post"}">Open in Social output</a>
                   <span class="note">draft <code>${esc(p.promoted_to || "")}</code></span>`
                : `<button class="ghost accent" data-act="promote">Promote to social draft</button>`}
            </div>
            <div class="post-slot"></div>
          </article>`).join("")}
      </div>
    </div>`);

  $$(".postcard", box).forEach((card) => {
    const file = card.dataset.file;
    const slot = $(".post-slot", card);
    $$("[data-act]", card).forEach((btn) => btn.addEventListener("click", async () => {
      if (btn.dataset.act === "promote") return promote(file, btn);
      let text;
      try { text = await api.getResearchPost(file); }
      catch { return toast("Could not load the post."); }
      const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
      if (btn.dataset.act === "copy") {
        try { await navigator.clipboard.writeText(body); toast("Copied to clipboard."); }
        catch { toast("Copy blocked by the browser."); }
        return;
      }
      if (slot.innerHTML) { slot.innerHTML = ""; return; }
      slot.innerHTML = `<article class="md postbody">${renderMarkdown(body)}</article>`;
    }));
  });
  return box;
}

async function promote(file, btn) {
  btn.disabled = true;
  toast("Promoting…");
  try {
    const r = await api.promoteIdea(file);
    if (r.hero && !r.hero.ok) toast("Draft created, but the hero failed to build.");
    else toast(`Promoted to ${r.slug}. Build it with /deckbuilder.`);
    invalidate();
    go("/research/posts");
  } catch (e) {
    toast("Promote failed: " + e.message);
    btn.disabled = false;
  }
}

// --- Performance -------------------------------------------------------------

function perfBody(data) {
  const posts = data.performance || [];
  if (!posts.length) {
    return el(`<div class="empty"><p>Nothing promoted yet.</p>
      <p class="note">Promote an idea from the Ideas tab. Once it is posted, record the link and the
      numbers here, and the brain learns which of its beliefs an audience actually responded to.</p></div>`);
  }
  const box = el(`
    <div>
      <p class="note">What happened after posting. Record a reading whenever you check, not on a
      schedule: the series matters more than any single number. Engagement per post weights a comment
      as three likes, because a comment costs more to give.</p>
      <div class="perflist">
        ${posts.map((r) => {
          const last = (r.samples || []).slice(-1)[0];
          return `
          <article class="perfcard" data-slug="${esc(r.slug)}">
            <div class="runcard-top">
              <span class="chip">${esc(r.kind)}</span>
              ${(r.themes || []).map((t) => `<span class="chip domain">${esc(t)}</span>`).join("")}
              ${r.url ? `<span class="chip conf-established">posted ${esc(r.posted_date || "")}</span>`
                      : `<span class="chip conf-emerging">not posted</span>`}
            </div>
            <h4>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}</h4>
            ${last ? `<div class="statstrip small">
                ${stat(last.impressions ?? "-", "impressions")}${stat(last.likes ?? "-", "likes")}
                ${stat(last.comments ?? "-", "comments")}${stat(last.reposts ?? "-", "reposts")}
                ${stat((r.samples || []).length, "readings")}
              </div>` : `<p class="note">No reading yet.</p>`}
            <div class="perf-form">
              <label>Posted <input type="date" data-f="posted_date" value="${esc(r.posted_date || "")}"></label>
              <label class="grow">Link <input type="url" data-f="url" placeholder="https://www.linkedin.com/posts/…" value="${esc(r.url || "")}"></label>
              <button class="ghost" data-act="save-link">Save link</button>
            </div>
            <div class="perf-form">
              <label>Date <input type="date" data-s="date"></label>
              <label>Impr. <input type="number" min="0" data-s="impressions"></label>
              <label>Likes <input type="number" min="0" data-s="likes"></label>
              <label>Comments <input type="number" min="0" data-s="comments"></label>
              <label>Reposts <input type="number" min="0" data-s="reposts"></label>
              <button class="ghost accent" data-act="add-sample">Add reading</button>
            </div>
            ${(r.samples || []).length > 1 ? `<p class="note">History: ${(r.samples || []).map((s) =>
              `${esc(s.date)}: ${s.likes ?? "-"}L/${s.comments ?? "-"}C`).join(" · ")}</p>` : ""}
          </article>`;
        }).join("")}
      </div>
    </div>`);

  $$(".perfcard", box).forEach((card) => {
    const slug = card.dataset.slug;
    const send = async (payload, ok) => {
      try { await api.putPerformance(slug, payload); toast(ok); invalidate(); go("/research/performance"); }
      catch (e) { toast("Save failed: " + e.message); }
    };
    $("[data-act='save-link']", card).addEventListener("click", () =>
      send({
        posted_date: $("[data-f='posted_date']", card).value,
        url: $("[data-f='url']", card).value.trim(),
      }, "Link saved."));
    $("[data-act='add-sample']", card).addEventListener("click", () => {
      const g = (k) => $(`[data-s='${k}']`, card).value;
      if (!g("likes") && !g("impressions") && !g("comments")) return toast("Enter at least one number.");
      send({ sample: { date: g("date"), impressions: g("impressions"), likes: g("likes"), comments: g("comments"), reposts: g("reposts") } }, "Reading recorded.");
    });
  });
  return box;
}
