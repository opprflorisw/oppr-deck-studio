// Build-job registry + runner (Deck Studio v3, §5.4). A regenerate materializes
// the current version, prints a PDF with headless Chrome/Edge (the same command
// build-pdf.ps1 uses), runs the SAME verify gate as the CLI, and on PASS
// attaches the PDF + thumbnails to the version. On FAIL the PDF is withheld and
// the deck is flagged needs_cli. Jobs are in-memory; one at a time per deck.

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import * as db from "./supabase.mjs";
import { slugify } from "./slug.mjs";
import { materialize, materializePdf, versionDir, CACHE_ROOT } from "./deckcache.mjs";
import { print as renderPrint, rendererName, isServerless } from "./render.mjs";
import { verifySnapshot } from "./verify.mjs";
import { RepoFiles } from "./repofiles.mjs";
import { buildSnapshot, chapterOrder, composeSlides, pdfNameForSlug } from "./assemble.mjs";
import { publishNewDeck, publishVersion } from "./publish.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "..", "..");
const TOOLS = path.join(REPO_ROOT, "tools");

// The registered customers, for the name-leak gate: a customer added on the
// Customers page has to be a scope verify enforces, or the newest customers are
// the only ones the leak rule does not cover. Best-effort — an unreachable
// backend falls back to the built-in scopes rather than failing the build.
async function nameScopeCustomers() {
  try { return await db.select("customers", { select: "slug,name" }); }
  catch { return []; }
}

// The gate, on a document alone: every universal brand rule, no PDF part. This
// is what an editor's save is checked against -- there is no PDF at save time,
// and printing one to find out whether the words are allowed would turn every
// keystroke-sized save into a browser launch.
export async function verifyHtmlOnly(html) {
  try {
    return await verifySnapshot({ html, customers: await nameScopeCustomers() });
  } catch (e) {
    // Fail closed, exactly as the build path does: a gate that could not run is
    // not a gate that passed.
    return { fails: [`verify did not run: ${e.message || e}`], warns: [], entries: [] };
  }
}

const jobs = new Map();       // jobId -> {id, deckId, versionN, state, verify_report, pdf, error}
const runningByDeck = new Map(); // deckId -> jobId

let _seq = 0;
function newId() { return `job_${Date.now().toString(36)}_${++_seq}`; }

export function getJob(id) { return jobs.get(id) || null; }
export function runningFor(deckId) { return runningByDeck.get(deckId) || null; }

// --- browser + python helpers ------------------------------------------------

function findBrowser() {
  const pf = process.env.ProgramFiles || "C:/Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)";
  const cands = [
    path.join(pf, "Google/Chrome/Application/chrome.exe"),
    path.join(pf86, "Google/Chrome/Application/chrome.exe"),
    path.join(pf, "Microsoft/Edge/Application/msedge.exe"),
    path.join(pf86, "Microsoft/Edge/Application/msedge.exe"),
  ];
  return cands.find((p) => fs.existsSync(p)) || null;
}

function fileUri(absPath) {
  return "file:///" + absPath.replace(/\\/g, "/");
}

const printPdf = (indexHtml, outPdf) => renderPrint(indexHtml, outPdf);

// Page geometry in CSS px per format — must match verifylib.PAGE_FORMATS and
// editor.js PAGE_SIZES. A PNG needs an explicit window size or the browser
// screenshots its default viewport and crops the page.
const PAGE_PX = {
  "deck-16x9": [1280, 720],
  "linkedin-4x5": [1080, 1350],
  "square-1x1": [1080, 1080],
  "hero-1200x627": [1200, 627],
};

// Print a single-page document (a library element) to PDF or PNG, using the
// same headless browser the deck build uses so an exported element matches a
// built one exactly.
export async function printElement(indexHtml, outFile, format) {
  let pageFormat = "deck-16x9";
  try {
    const m = /"page_format":\s*"([^"]+)"/.exec(fs.readFileSync(indexHtml, "utf-8"));
    if (m && PAGE_PX[m[1]]) pageFormat = m[1];
  } catch {}
  const [w, h] = PAGE_PX[pageFormat];
  return renderPrint(indexHtml, outFile, {
    screenshot: format === "png", width: w, height: h,
    pageInches: [w / 96, h / 96],
  });
}

// `onLine` receives each complete stdout line as it arrives, which is how the
// builder shows real pipeline progress rather than a spinner.
function runPython(args, onLine = null) {
  return new Promise((resolve) => {
    const attempts = [["python", args], ["py", ["-3", ...args]]];
    let i = 0;
    const tryNext = () => {
      if (i >= attempts.length) return resolve({ code: 127, stdout: "", stderr: "no python" });
      const [cmd, a] = attempts[i++];
      let out = "", err = "", pending = "";
      const child = spawn(cmd, a, { cwd: REPO_ROOT });
      child.stdout.on("data", (d) => {
        out += d;
        if (!onLine) return;
        pending += d;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();               // the (possibly partial) last line
        for (const line of lines) if (line.trim()) onLine(line.trim());
      });
      child.stderr.on("data", (d) => (err += d));
      child.on("error", tryNext);
      child.on("close", (code) => {
        if (onLine && pending.trim()) onLine(pending.trim());
        resolve({ code, stdout: out, stderr: err });
      });
    };
    tryNext();
  });
}

/**
 * Build and publish a deck from a chapter recipe (the deck builder's engine).
 *
 * Shells out to tools/build-from-recipe.py rather than reimplementing the
 * pipeline in Node, so a deck built from the app goes through EXACTLY the same
 * compose -> assemble -> pdf -> verify -> publish as one built by hand. There is
 * one gate, not two.
 *
 * Verify still blocks: entitlement, unfilled placeholders, em dashes, footer
 * discipline and page geometry are not suggestions, and nothing here bypasses
 * them. A deck that fails is not published and the failures come back.
 *
 * Needs the repo on disk, so it is local-only for now. Hosted, the app hands
 * back the CLI prompt the way it already does for structural edits.
 */
export async function buildFromRecipe(recipe, { dryRun = false, onStep = null } = {}) {
  // Hosted there is no Python and no repo, so the JS pipeline runs instead. It
  // is the same five gates in the same order over the same inputs, and
  // tools/check-assemble-parity.py proves the snapshot it produces is byte for
  // byte the one the CLI produces. DECK_JS_BUILD=1 forces it locally, which is
  // how that check is run against a machine that HAS Python.
  if (isServerless || process.env.DECK_JS_BUILD) {
    return buildFromRecipeJs(recipe, { dryRun, onStep });
  }
  const dir = path.join(REPO_ROOT, "decks", "drafts", "_recipes");
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${recipe.slug || "recipe"}.json`);
  await fsp.writeFile(file, JSON.stringify(recipe, null, 1), "utf-8");

  const args = [path.join(TOOLS, "build-from-recipe.py"), file];
  if (dryRun) args.push("--dry-run");

  // Progress lines carry `event: "step"`; the result object does not. Keeping
  // the last non-event line is what makes the stream and the final answer the
  // same channel without a second protocol.
  let last = "";
  const r = await runPython(args, (line) => {
    let obj;
    try { obj = JSON.parse(line); } catch { return; }
    if (obj.event === "step") { if (onStep) onStep(obj); return; }
    last = line;
  });
  if (r.code === 127) {
    return { ok: false, code: "NOPYTHON", error: "Python was not found on this machine." };
  }
  try {
    return { ...JSON.parse(last || (r.stdout || "").trim().split("\n").pop()), code: r.code };
  } catch {
    return { ok: false, code: "BADOUTPUT",
      error: (r.stderr || r.stdout || "the build produced no readable result").slice(-2000) };
  }
}

// --- the recipe build, without Python ----------------------------------------
//
// compose -> assemble -> pdf -> verify -> publish, the CLI's pipeline in the
// CLI's order. The step names, the step details and the result shape are the
// ones build-from-recipe.py emits, so the builder dialog cannot tell which one
// ran — only the machine it is running on can.
//
// VERIFY STILL BLOCKS. It is the same gate object the local app runs, and a deck
// that fails is not published; the failures come back to the caller.

async function buildFromRecipeJs(recipe, { dryRun = false, onStep = null } = {}) {
  const emit = (step, state, detail = "") => onStep?.({ step, state, detail });
  const steps = [];
  const record = (step, ok, detail = "", out = "", state = "") => {
    steps.push({ step, ok, detail, out });
    emit(step, state || (ok ? "ok" : "fail"), detail);
  };
  const result = { slug: recipe.slug, steps, ok: false };
  const files = new RepoFiles();

  // 1. compose
  emit("compose", "running");
  let deck, slides;
  try {
    const order = chapterOrder(await files.mustText("library/chapters.yaml", "the chapter set"));
    deck = composeSlides(recipe, order);
    slides = deck.slides;
  } catch (e) {
    record("compose", false, String(e.message || e));
    return result;
  }
  record("compose", true,
    `${slides.length} slides across ${Object.keys(deck.chapters || {}).length} chapters`);

  // 2. assemble
  emit("assemble", "running");
  let snap;
  try {
    snap = await buildSnapshot(deck, recipe.slug, { files });
  } catch (e) {
    record("assemble", false, "could not assemble", String(e.message || e));
    return result;
  }
  record("assemble", true, `footers filled, pages numbered 1 to ${slides.length}`);

  // 3. pdf — the snapshot has to exist as files before Chrome can print it,
  // because the assets it references are relative to the document.
  emit("pdf", "running");
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), "oppr-build-"));
  const indexHtml = path.join(work, "index.html");
  const pdfName = await recipePdfName(recipe, deck);
  const outPdf = path.join(work, pdfName);
  let pdfBytes = null;
  try {
    await fsp.writeFile(indexHtml, snap.html, "utf-8");
    await fsp.mkdir(path.join(work, "assets"), { recursive: true });
    for (const [fn, a] of Object.entries(snap.assets)) {
      await fsp.writeFile(path.join(work, "assets", fn), a.bytes);
    }
    await renderPrint(indexHtml, outPdf);
    pdfBytes = await fsp.readFile(outPdf);
  } catch (e) {
    record("pdf", false, "the print failed", String(e.message || e));
    await fsp.rm(work, { recursive: true, force: true });
    return result;
  }
  record("pdf", true, `PDF, ${slides.length} pages`);

  // 4. verify — blocking
  emit("verify", "running");
  let report;
  try {
    report = await verifySnapshot({ html: snap.html, pdfBytes, pdfName,
                                    customers: await nameScopeCustomers() });
  } catch (e) {
    report = { fails: [`verify did not run: ${e.message}`], warns: [], entries: [] };
  }
  const passed = report.fails.length === 0;
  const nWarn = report.warns.length;
  record("verify", passed,
    passed ? `clean (${nWarn} warning${nWarn === 1 ? "" : "s"})`
           : `${report.fails.length} failure${report.fails.length === 1 ? "" : "s"}; nothing published`,
    [...report.fails.map((f) => `FAIL ${f}`), ...report.warns.map((w) => `WARN ${w}`)].join("\n"));
  result.verify_report = report;
  if (!passed) {
    await fsp.rm(work, { recursive: true, force: true });
    return result;
  }

  if (dryRun) {
    result.ok = true;
    record("publish", true, "skipped: this was a check", "", "skip");
    await fsp.rm(work, { recursive: true, force: true });
    return result;
  }

  // 5. publish
  emit("publish", "running");
  try {
    const common = {
      html: snap.html, assets: snap.assets, recipe: snap.recipe,
      pdfBytes, pdfName, note: recipe.note || "",
      author: recipe.author || "app", authorId: recipe.author_id || null,
      verifyReport: report,
      // page_count is not passed: a trigger on deck_versions computes it from
      // the document itself, so the app and the CLI cannot disagree about how
      // long a deck is.
    };
    const landed = recipe.version_of
      ? await publishVersion({ versionOf: recipe.version_of, ...common })
      : await publishNewDeck({
          slug: recipe.slug, deck, ...common,
          type: recipe.type || "", client: recipe.client || "", customer: recipe.customer || "",
          derivedFrom: recipe.derived_from || "",
        });
    record("publish", true, "immutable version written");
    result.ok = true;
    result.deck = {
      id: landed.deck_id, slug: landed.slug, title: deck.title,
      version: landed.version, page_count: slides.length,
    };
  } catch (e) {
    record("publish", false, "the publish failed", String(e.message || e));
  }
  await fsp.rm(work, { recursive: true, force: true });
  return result;
}

// The filename a version of this deck gets. A rebuild inherits the existing
// deck's naming (the date, the client slug and any rename already applied);
// a new deck derives it from its slug, exactly as deckstudio.pdf_name does.
async function recipePdfName(recipe, deck) {
  if (recipe.version_of) {
    const rows = await db.select("decks", {
      slug: `eq.${recipe.version_of}`,
      select: "slug,type,is_master,pdf_core,client_slug",
    });
    if (rows.length) return pdfNameFor(rows[0]);
  }
  return pdfNameForSlug(recipe.slug, recipe.client || deck.client || "");
}

// --- the recipe build as a JOB ----------------------------------------------
// A build takes 30 to 60 seconds. Behind a blocking POST that is a disabled
// button and no information; as a job it is five named steps arriving, so you
// can see which gate you are standing at and, when it fails, which one refused.

const RECIPE_STEPS = ["compose", "assemble", "pdf", "verify", "publish"];
const recipeJobs = new Map();   // jobId -> {id, slug, state, steps[], result, error}

export function getRecipeJob(id) { return recipeJobs.get(id) || null; }

export function startRecipeBuild(recipe, { dryRun = false } = {}) {
  const id = newId();
  const job = {
    id, slug: recipe.slug || "", dryRun, state: "running",
    steps: RECIPE_STEPS.map((s) => ({ step: s, state: "waiting", detail: "" })),
    result: null, error: "",
  };
  recipeJobs.set(id, job);

  const mark = (ev) => {
    const row = job.steps.find((s) => s.step === ev.step);
    if (!row) return;
    row.state = ev.state;
    if (ev.detail) row.detail = ev.detail;
  };

  job.done = buildFromRecipe(recipe, { dryRun, onStep: mark })
    .then((result) => {
      job.result = result;
      job.state = result.ok ? "pass" : "fail";
      // A step that never reported (the process died mid-pipeline) must not sit
      // spinning forever in the UI.
      for (const s of job.steps) if (s.state === "running") s.state = "fail";
      for (const s of job.steps) if (s.state === "waiting" && job.state === "fail") s.state = "skip";
    })
    .catch((e) => {
      job.state = "error";
      job.error = String(e?.message || e);
      for (const s of job.steps) if (s.state === "running") s.state = "fail";
    })
    .finally(() => {
      // Keep it long enough for a slow poll to collect it, not forever.
      setTimeout(() => recipeJobs.delete(id), 10 * 60_000).unref?.();
    });

  return job;
}

// --- PDF naming (mirrors tools/deckstudio.pdf_name) --------------------------

// The filename is part system-owned, part yours. `pdf_core` (set by rename) is
// the only segment you choose; the date prefix, the mandatory `oppr` token and
// the client slug stay derived, because verify-deck.py FAILs a PDF missing
// `oppr` or a named client's slug and a rename must not be able to defeat that.
export function pdfNameFor(deck) {
  const chosen = slugify(deck.pdf_core || "");
  if (deck.is_master) return `oppr_${chosen || slugify(deck.type)}.pdf`;
  const m = /^(\d{4}-\d{2}-\d{2})[_-](.+)$/.exec(deck.slug);
  let date = "", core = slugify(deck.slug);
  if (m) { date = m[1]; core = slugify(m[2]); }
  if (chosen) core = chosen;
  const parts = [];
  if (date) parts.push(date);
  parts.push("oppr");
  if (core && core !== "oppr") parts.push(core);
  const client = deck.client_slug ? slugify(deck.client_slug) : "";
  if (client && !parts.join("-").includes(client)) parts.push(client);
  return parts.join("_") + ".pdf";
}

// Make sure page-1 (and the rest) of a version exist as PNGs, generating them if
// this version was never built through the app.
//
// Thumbnails used to appear only as a side effect of a PASS build, so anything
// published by the CLI or imported showed a grey placeholder — you could not
// tell one carousel from another in a list. This fills the gap lazily: cache
// first, then Storage, then render from the version's PDF and upload so the next
// caller (and a fresh cache) gets it for free.
export async function ensureThumbs(deckId, n) {
  const thumbDir = path.join(CACHE_ROOT, deckId, "thumbs", `v${n}`);
  const p1 = path.join(thumbDir, "p1.png");
  if (fs.existsSync(p1)) return p1;

  await fsp.mkdir(thumbDir, { recursive: true });

  // Already rendered on some earlier run, just not on this disk.
  try {
    const data = await db.download(`decks/${deckId}/thumbs/v${n}/p1.png`);
    if (data?.length) {
      await fsp.writeFile(p1, data);
      return p1;
    }
  } catch { /* not in Storage yet — render it below */ }

  const pdfPath = isServerless ? null : await materializePdf(deckId, n);
  if (pdfPath) {
    const r = await runPython([path.join(TOOLS, "pdf-thumbs.py"), pdfPath, thumbDir]);
    if (r.code !== 0 || !fs.existsSync(p1)) return null;
  } else {
    // No PDF: a social image never had one, and a version saved in the editor
    // has none until it is printed. Screenshot page 1 from the HTML instead, so
    // every artifact gets a picture rather than only the printed ones.
    try {
      const dir = await materialize(deckId, n);
      await printElement(path.join(dir, "index.html"), p1, "png");
    } catch { return null; }
    if (!fs.existsSync(p1)) return null;
  }

  // Upload so this render is done once for good, not once per cache wipe.
  try {
    const pngs = (await fsp.readdir(thumbDir)).filter((f) => f.endsWith(".png"));
    for (const png of pngs) {
      await db.upload(`decks/${deckId}/thumbs/v${n}/${png}`,
        await fsp.readFile(path.join(thumbDir, png)), "image/png");
    }
  } catch { /* the local copy is enough to serve this request */ }

  return p1;
}

// --- the job -----------------------------------------------------------------

export function startBuild(deck) {
  const existing = runningByDeck.get(deck.id);
  if (existing) return { jobId: existing, already: true };
  const id = newId();
  const n = deck.current_version_n;
  const job = { id, deckId: deck.id, versionN: n, state: "running", verify_report: null, pdf: null, localPdf: null, error: "" };
  jobs.set(id, job);
  runningByDeck.set(deck.id, id);
  job.done = _run(job, deck).catch((e) => {
    job.state = "error";
    job.error = String(e?.stack || e?.message || e);
    // A build that dies silently is the worst kind: the UI says "failed" and
    // nothing anywhere says why. Put it in the log the platform captures.
    process.stderr.write(`build failed for ${deck.slug}: ${job.error}
`);
  }).finally(() => {
    runningByDeck.delete(deck.id);
  });
  return { jobId: id, already: false };
}

// Build to completion and resolve with the finished job.
//
// The download path uses this: a version saved in the editor has no PDF until
// something prints one, and serving an older version's file instead would hand
// back a document that silently does not match what is on screen. So a stale
// download prints first and waits.
export async function buildAndWait(deck) {
  const existing = runningByDeck.get(deck.id);
  if (existing) {
    const running = jobs.get(existing);
    if (running?.done) await running.done;
    return running;
  }
  const { jobId } = startBuild(deck);
  const job = jobs.get(jobId);
  await job.done;
  return job;
}

async function _run(job, deck) {
  const n = job.versionN;
  const dir = await materialize(deck.id, n);
  const indexHtml = path.join(dir, "index.html");
  const pdfName = pdfNameFor(deck);
  const outPdf = path.join(dir, pdfName);

  await printPdf(indexHtml, outPdf);
  // Keep the printed file reachable even if verify FAILs, so the UI can offer an
  // explicit "download unverified" without ever attaching it to the version.
  job.localPdf = outPdf;
  job.pdfName = pdfName;

  // The JavaScript gate, in BOTH environments. Running Python locally and JS in
  // the cloud would make the app's answer depend on where it happens to be
  // running, which is exactly the drift this rebuild removed.
  // tools/check-verify-parity.py proves the two agree on every artifact.
  let report;
  try {
    report = await verifySnapshot({
      html: await fsp.readFile(indexHtml, "utf-8"),
      pdfBytes: fs.existsSync(outPdf) ? await fsp.readFile(outPdf) : null,
      pdfName,
      customers: await nameScopeCustomers(),
    });
  } catch (e) {
    report = { fails: [`verify did not run: ${e.message}`], warns: [], entries: [] };
  }
  job.verify_report = report;

  const passed = report.fails.length === 0;

  if (passed) {
    const pdfObj = `decks/${deck.id}/pdf/v${n}_${pdfName}`;
    await db.upload(pdfObj, await fsp.readFile(outPdf), "application/pdf");

    // thumbnails. pdf-thumbs.py rasterises every page with PyMuPDF, which is
    // richer but Python-only; without it page 1 is rendered from the HTML, which
    // is what the lazy thumbnail path does anyway.
    const thumbDir = path.join(CACHE_ROOT, deck.id, "thumbs", `v${n}`);
    if (!isServerless) await runPython([path.join(TOOLS, "pdf-thumbs.py"), outPdf, thumbDir]);
    else await fsp.mkdir(thumbDir, { recursive: true }).then(() =>
      renderPrint(indexHtml, path.join(thumbDir, "p1.png"), {
        screenshot: true, width: 1280, height: 720 })).catch(() => {});
    let pageObjs = [];
    try {
      const pngs = (await fsp.readdir(thumbDir)).filter((f) => f.endsWith(".png")).sort();
      for (const png of pngs) {
        const obj = `decks/${deck.id}/thumbs/v${n}/${png}`;
        await db.upload(obj, await fsp.readFile(path.join(thumbDir, png)), "image/png");
        pageObjs.push(obj);
      }
    } catch {}

    await db.update("deck_versions", { deck_id: deck.id, n }, { pdf_object: pdfObj, verify_report: report });
    await db.update("decks", { id: deck.id }, { status: "ok", needs_cli_reason: "" });
    await db.insert("build_jobs", { deck_id: deck.id, version_n: n, state: "pass", verify_report: report, pdf_object: pdfObj });
    job.pdf = pdfObj;
    job.state = "pass";
  } else {
    const reason = report.fails.slice(0, 3).join(" · ");
    await db.update("deck_versions", { deck_id: deck.id, n }, { verify_report: report });
    await db.update("decks", { id: deck.id }, { status: "needs_cli", needs_cli_reason: reason });
    await db.insert("build_jobs", { deck_id: deck.id, version_n: n, state: "fail", verify_report: report });
    job.state = "fail";
  }
}
