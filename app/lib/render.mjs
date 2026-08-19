// Printing, wherever the app happens to be running (Deck Studio cloud).
//
// Locally there is a real Chrome or Edge on disk and spawning it is the fastest
// path. On Vercel there is neither, so a serverless Chromium build is launched
// through puppeteer-core instead.
//
// One function, two backends, chosen by what actually exists — not by an
// environment flag that can be wrong. The output must be identical either way:
// the verify gate checks page size to 0.02 in, so a renderer that quietly
// differs is caught rather than shipped.

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function localBrowser() {
  const pf = process.env.ProgramFiles || "C:/Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)";
  const cands = [
    path.join(pf, "Google/Chrome/Application/chrome.exe"),
    path.join(pf86, "Google/Chrome/Application/chrome.exe"),
    path.join(pf, "Microsoft/Edge/Application/msedge.exe"),
    path.join(pf86, "Microsoft/Edge/Application/msedge.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

const fileUri = (abs) => "file:///" + abs.replace(/\\/g, "/");

// --- local: spawn the installed browser ------------------------------------

function spawnPrint(indexHtml, outFile, { screenshot = false, width, height } = {}) {
  return new Promise((resolve, reject) => {
    const browser = localBrowser();
    if (!browser) return reject(new Error("no local Chrome or Edge"));
    const userDir = path.join(os.tmpdir(), `oppr-print-${Date.now()}`);
    const args = [
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      `--user-data-dir=${userDir}`, "--virtual-time-budget=10000",
    ];
    if (width && height) args.push(`--window-size=${width},${height}`);
    args.push(screenshot ? `--screenshot=${outFile}` : `--print-to-pdf=${outFile}`);
    args.push(fileUri(indexHtml));
    const child = spawn(browser, args);
    // A browser that never exits used to hang the job forever: nothing here had
    // a timeout, so a wedged Chrome held a build "running" until the process was
    // restarted, with no message and no way to tell it from a slow print.
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`the browser did not finish within ${PRINT_TIMEOUT_MS / 1000}s`));
    }, PRINT_TIMEOUT_MS);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", async () => {
      clearTimeout(timer);
      await fsp.rm(userDir, { recursive: true, force: true }).catch(() => {});
      fs.existsSync(outFile) ? resolve(outFile) : reject(new Error("nothing was produced"));
    });
  });
}

// Comfortably longer than the slowest real print (an 18-page deck with the
// scrim baked in takes ~1.6s) and comfortably shorter than Vercel's 60s
// function ceiling, so a hung browser fails as a browser problem rather than as
// a mysterious platform timeout.
const PRINT_TIMEOUT_MS = 45_000;

// --- serverless: puppeteer-core + a packaged Chromium ----------------------

let _puppeteer = null;
async function serverlessBrowser() {
  if (_puppeteer) return _puppeteer;

  // @sparticuz/chromium only extracts its shared libraries, and only sets
  // LD_LIBRARY_PATH, when it believes it is on AWS Lambda — it decides that from
  // AWS_EXECUTION_ENV. Vercel's Fluid compute is Lambda underneath but does not
  // set that variable, so the package skipped both steps and Chromium died with
  // "libnss3.so: cannot open shared object file".
  //
  // Vercel runs Node 20/22 on Amazon Linux 2023, which is exactly the case the
  // package's al2023 bundle targets, so declaring it is accurate rather than a
  // trick. It must be set BEFORE the import: the package reads it at module load.
  if (isServerless && !process.env.AWS_EXECUTION_ENV) {
    const major = Number(process.versions.node.split(".")[0]);
    process.env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${major >= 22 ? "22" : "20"}.x`;
  }

  const [{ default: chromium }, puppeteer] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);
  _puppeteer = { chromium, puppeteer: puppeteer.default || puppeteer };
  return _puppeteer;
}

async function puppeteerPrint(indexHtml, outFile, { screenshot = false, width, height, pageInches } = {}) {
  const { chromium, puppeteer } = await serverlessBrowser();
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: width && height ? { width, height } : chromium.defaultViewport,
  });
  try {
    const page = await browser.newPage();
    await page.goto(fileUri(indexHtml), { waitUntil: "networkidle0", timeout: 45_000 });
    // The fonts are bundled into the snapshot, but layout must settle before the
    // page is measured or the first slide prints with fallback metrics.
    await page.evaluateHandle("document.fonts.ready");
    if (screenshot) {
      await page.screenshot({ path: outFile, type: "png" });
    } else {
      // preferCSSPageSize honours the @page rule the templates set, which is how
      // 13.333x7.5in and 1080x1350px stay exact instead of being re-derived here.
      await page.pdf({
        path: outFile,
        printBackground: true,
        preferCSSPageSize: true,
        ...(pageInches ? { width: `${pageInches[0]}in`, height: `${pageInches[1]}in` } : {}),
      });
    }
  } finally {
    await browser.close().catch(() => {});
  }
  if (!fs.existsSync(outFile)) throw new Error("nothing was produced");
  return outFile;
}

// --- the one entry point ----------------------------------------------------

export async function print(indexHtml, outFile, opts = {}) {
  if (!isServerless && localBrowser()) return spawnPrint(indexHtml, outFile, opts);
  return puppeteerPrint(indexHtml, outFile, opts);
}

export function rendererName() {
  if (!isServerless && localBrowser()) return `local:${path.basename(localBrowser())}`;
  return "serverless:@sparticuz/chromium";
}
