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
import { materialize, versionDir, CACHE_ROOT } from "./deckcache.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "..", "..");
const TOOLS = path.join(REPO_ROOT, "tools");

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

function printPdf(indexHtml, outPdf) {
  return new Promise((resolve, reject) => {
    const browser = findBrowser();
    if (!browser) return reject(new Error("no Chrome or Edge found"));
    const userDir = path.join(os.tmpdir(), `oppr-print-${Date.now()}`);
    const args = [
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      `--user-data-dir=${userDir}`, "--virtual-time-budget=10000",
      `--print-to-pdf=${outPdf}`, fileUri(indexHtml),
    ];
    const child = spawn(browser, args);
    child.on("error", reject);
    child.on("close", async () => {
      await fsp.rm(userDir, { recursive: true, force: true }).catch(() => {});
      fs.existsSync(outPdf) ? resolve(outPdf) : reject(new Error("PDF was not produced"));
    });
  });
}

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
export function printElement(indexHtml, outFile, format) {
  return new Promise((resolve, reject) => {
    const browser = findBrowser();
    if (!browser) return reject(new Error("no Chrome or Edge found"));
    let pageFormat = "deck-16x9";
    try {
      const m = /"page_format":\s*"([^"]+)"/.exec(fs.readFileSync(indexHtml, "utf-8"));
      if (m && PAGE_PX[m[1]]) pageFormat = m[1];
    } catch {}
    const [w, h] = PAGE_PX[pageFormat];
    const userDir = path.join(os.tmpdir(), `oppr-el-${Date.now()}`);
    const args = [
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      `--user-data-dir=${userDir}`, "--virtual-time-budget=8000",
      `--window-size=${w},${h}`,
      format === "png" ? `--screenshot=${outFile}` : `--print-to-pdf=${outFile}`,
      fileUri(indexHtml),
    ];
    const child = spawn(browser, args);
    child.on("error", reject);
    child.on("close", async () => {
      await fsp.rm(userDir, { recursive: true, force: true }).catch(() => {});
      fs.existsSync(outFile) ? resolve(outFile) : reject(new Error(`${format} was not produced`));
    });
  });
}

function runPython(args) {
  return new Promise((resolve) => {
    const attempts = [["python", args], ["py", ["-3", ...args]]];
    let i = 0;
    const tryNext = () => {
      if (i >= attempts.length) return resolve({ code: 127, stdout: "", stderr: "no python" });
      const [cmd, a] = attempts[i++];
      let out = "", err = "";
      const child = spawn(cmd, a, { cwd: REPO_ROOT });
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", tryNext);
      child.on("close", (code) => resolve({ code, stdout: out, stderr: err }));
    };
    tryNext();
  });
}

// --- PDF naming (mirrors tools/deckstudio.pdf_name) --------------------------

function slugify(s) {
  return String(s).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

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
    job.state = "error"; job.error = String(e.message || e);
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

  const verify = await runPython([path.join(TOOLS, "verify-deck.py"), "--snapshot", "--json", dir]);
  let report = { fails: ["verify did not run"], warns: [], entries: [] };
  try { report = JSON.parse(verify.stdout.trim().split("\n").pop()); } catch {}
  job.verify_report = report;

  const passed = report.fails.length === 0;

  if (passed) {
    const pdfObj = `decks/${deck.id}/pdf/v${n}_${pdfName}`;
    await db.upload(pdfObj, await fsp.readFile(outPdf), "application/pdf");

    // thumbnails
    const thumbDir = path.join(CACHE_ROOT, deck.id, "thumbs", `v${n}`);
    await runPython([path.join(TOOLS, "pdf-thumbs.py"), outPdf, thumbDir]);
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
