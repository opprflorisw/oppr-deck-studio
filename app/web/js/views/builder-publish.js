// Publishing, with the pipeline shown honestly.
//
// The build runs five real gates over 30 to 60 seconds. Behind a blocking
// request that is a disabled button and no information; here each step reports
// as it lands, so you can see which gate you are standing at and, when it
// refuses, which one refused and why.
//
// These are not decorative stages. `tools/build-from-recipe.py` emits one line
// per step as it runs them, and this renders exactly those. Nothing here can
// claim a step passed that did not.

import { $, $$, el, esc, toast } from "../util.js";
import { state, loadBackend } from "../state.js";
import * as api from "../api.js";
import { go } from "../router.js";
import { icon } from "../icons.js";

const STEP_LABEL = {
  compose: ["Compose", "turning the picks into a deck"],
  assemble: ["Assemble", "filling footers, page numbers and variables"],
  pdf: ["Print", "rendering the PDF"],
  verify: ["Verify", "entitlement, footers, geometry, brand rules"],
  publish: ["Publish", "writing the immutable version"],
};

const MARK = { waiting: "&#9675;", running: "&#9681;", ok: "&#10003;", fail: "&#10005;", skip: "&#8211;" };

function stepRow(s) {
  const [label, hint] = STEP_LABEL[s.step] || [s.step, ""];
  return `<li class="pstep is-${esc(s.state)}">
    <span class="pstep-m">${MARK[s.state] || MARK.waiting}</span>
    <span class="pstep-l">${esc(label)}</span>
    <span class="pstep-d">${esc(s.detail || (s.state === "running" ? hint : ""))}</span>
  </li>`;
}

/**
 * @param work    the builder's working deck (see builder.js)
 * @param opts.dryRun   run every gate, publish nothing
 * @param opts.onDone   called with the finished job when it passes
 */
export function openPublish(work, { dryRun = false, onDone = null } = {}) {
  const isNew = !work.deck;
  const nextV = isNew ? 1 : (work.deck.version || 0) + 1;
  const total = work.order.length;

  const m = el(`<div class="modal"><div class="modal-box modal-box--wide">
    <header><b>${icon(dryRun ? "info" : "save", 18)} ${dryRun ? "Check this deck" : "Publish"}</b>
      <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body" id="p-body">
      <p class="note" id="p-what"></p>

      ${dryRun ? "" : `
      <div class="field"><label for="p-note">What changed?</label>
        <input id="p-note" type="text" maxlength="300"
               placeholder="${isNew ? "why this deck exists" : "why this version exists"}"
               value="${esc(work.note || "")}">
        <p class="note">Shown against this version in the timeline forever. One line is plenty.</p></div>

      ${isNew ? "" : `
      <label class="chipbox p-fork">
        <input type="checkbox" id="p-fork">
        <span>Save as a <b>new deck</b> instead of a new version</span>
      </label>
      <p class="note p-fork-note">Use this for a variant: a customer cut, an event
        edit, a different length. It starts its own timeline and records that it
        came from <code>${esc(work.deck?.slug || "")}</code>, leaving this deck at
        v${esc(work.deck?.version ?? "?")}.</p>
      <div class="field" id="p-fork-slug" hidden><label for="p-newslug">New slug</label>
        <input id="p-newslug" type="text" placeholder="a name of its own"></div>`}
      `}

      <ul class="psteps" id="p-steps" hidden></ul>
      <div id="p-out"></div>

      <div class="modal-actions">
        <button class="ghost" id="p-cancel">Cancel</button>
        <button class="primary" id="p-go">${dryRun ? "Run the checks" : isNew ? "Publish as v1" : `Publish as v${nextV}`}</button>
      </div>
    </div>
  </div></div>`);

  const what = dryRun
    ? `Runs compose, assemble, print and verify over ${total} page${total === 1 ? "" : "s"} and publishes nothing.`
    : isNew
      ? `${total} page${total === 1 ? "" : "s"}, published as <b>v1</b> of <code>${esc(work.slug)}</code>.`
      : `${total} page${total === 1 ? "" : "s"}, published as <b>v${nextV}</b> of <code>${esc(work.deck.slug)}</code>. `
        + `v${work.deck.version} and its PDF stay exactly as they are.`;
  $("#p-what", m).innerHTML = what;

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  $("#p-cancel", m).addEventListener("click", close);
  m.addEventListener("click", (e) => { if (e.target === m) close(); });

  const fork = $("#p-fork", m);
  fork?.addEventListener("change", () => {
    $("#p-fork-slug", m).hidden = !fork.checked;
    $("#p-go", m).textContent = fork.checked ? "Publish as a new deck" : `Publish as v${nextV}`;
    if (fork.checked) setTimeout(() => $("#p-newslug", m).focus(), 20);
  });

  $("#p-go", m).addEventListener("click", () => run());

  async function run() {
    const forking = Boolean(fork?.checked);
    const newSlug = forking ? ($("#p-newslug", m).value || "").trim() : "";
    if (forking && !newSlug) { toast("Give the new deck a slug."); return; }
    if (forking && (state.backend.decks || []).some((d) => d.slug === newSlug)) {
      toast("A deck already has that slug."); return;
    }

    const recipe = toRecipe(work, {
      dryRun,
      note: dryRun ? "" : ($("#p-note", m)?.value || "").trim(),
      forkSlug: newSlug,
    });

    $("#p-go", m).disabled = true;
    $("#p-cancel", m).disabled = true;
    $$(".field, .p-fork, .p-fork-note", m).forEach((n) => (n.hidden = true));
    const steps = $("#p-steps", m);
    steps.hidden = false;

    let job;
    try { job = await api.startRecipeBuild(recipe); }
    catch (e) {
      $("#p-out", m).innerHTML = `<div class="build-status fail">Could not start: ${esc(e.message)}</div>`;
      $("#p-cancel", m).disabled = false;
      return;
    }
    steps.innerHTML = job.steps.map(stepRow).join("");

    // Hosted the build finishes inside the POST, so the answer is already here.
    // Polling for it would ask an instance that never had the job and retry
    // forever on the 404, which looks exactly like a build that never ends.
    if (job.state && job.state !== "running") {
      $("#p-cancel", m).disabled = false;
      $("#p-cancel", m).textContent = "Close";
      await finish(job);
      return;
    }

    const poll = setInterval(async () => {
      let s;
      try { s = await api.getBuildJob(job.job_id); } catch { return; }
      steps.innerHTML = s.steps.map(stepRow).join("");
      if (s.state === "running") return;
      clearInterval(poll);
      $("#p-cancel", m).disabled = false;
      $("#p-cancel", m).textContent = "Close";
      finish(s);
    }, 800);

    async function finish(s) {
      const r = s.result || {};
      if (s.state !== "pass") {
        $("#p-out", m).innerHTML = "";
        $("#p-out", m).append(failure(r, s));
        return;
      }
      if (dryRun) {
        $("#p-out", m).innerHTML =
          `<div class="build-status pass">It builds and verifies. Nothing was published.</div>`;
        return;
      }
      await loadBackend(api);
      const d = r.deck || {};
      $("#p-out", m).innerHTML = `<div class="build-status pass">
        Published as <b>v${esc(d.version ?? "?")}</b>, ${esc(d.page_count ?? total)} pages.
        Taking you to the deck&hellip;</div>`;
      if (onDone) await onDone(r);
      setTimeout(() => { close(); if (d.id) go(`/deck/${d.id}`); }, 1100);
    }
  }

  function failure(r, s) {
    // The verify step's own output, said in the words verify.js already uses
    // everywhere else, so a failure reads the same here as on the deck page.
    const vstep = (r.steps || []).find((x) => x.step === "verify" && !x.ok);
    const fails = vstep ? parseFails(vstep.out) : [];
    const box = el(`<div class="build-status fail">
      <b>Nothing was published.</b>
      ${fails.length
        ? `<ul class="findings findings--inline">${fails.map((f) =>
            `<li>${esc(f)}</li>`).join("")}</ul>
           <p class="note">Fix these in the picker (an image above this deck's
             clearance is the usual one), then publish again.</p>`
        : `<p class="note">${esc(r.error || s.error || "The build did not pass.")}</p>`}
      <details><summary>What the pipeline printed</summary><pre>${esc(
        (r.steps || []).filter((x) => x.out).map((x) => `[${x.step}]\n${x.out}`).join("\n\n").slice(-4000)
        || s.error || "(no output)")}</pre></details>
    </div>`);
    return box;
  }

  document.body.append(m);
  setTimeout(() => ($("#p-note", m) || $("#p-go", m)).focus(), 30);
}

// verify-deck.py prints "FAIL  <rule>  <detail>" lines; that is the one thing
// worth lifting out of the raw log, because it is the only part a person acts on.
function parseFails(out) {
  return String(out || "").split(/\r?\n/)
    .filter((l) => /^\s*FAIL\b/.test(l))
    .map((l) => l.replace(/^\s*FAIL\s*/, "").trim())
    .filter(Boolean);
}

// The builder's working deck, as the recipe build-from-recipe.py expects.
//
// `version_of` is set from the DECK, never from a form field: that is what makes
// "a new version comes from opening an existing deck" a structural fact rather
// than a warning someone can click past.
export function toRecipe(work, { dryRun = false, note = "", forkSlug = "" } = {}) {
  const base = {
    title: work.title,
    type: work.type || "",
    chapters: work.chapters,
    order: work.order,
    vars: work.vars,
    allowed_entitlements: work.allowed_entitlements?.length ? work.allowed_entitlements : ["public"],
    client: work.client || "",
    customer: work.client || "",
    note,
    dry_run: dryRun,
  };
  if (!work.deck) return { ...base, slug: work.slug };            // a new deck: v1
  if (forkSlug) return { ...base, slug: forkSlug, derived_from: work.deck.slug };
  return { ...base, slug: work.deck.slug, version_of: work.deck.slug };
}
