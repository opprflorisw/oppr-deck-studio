// Local materialization cache (Deck Studio v3, §5.1). A disposable mirror of a
// backend deck version as files, so the viewer/editor iframes and the PDF
// printer can work from index.html + assets/ on disk. Never committed
// (app/.deck-cache/ is gitignored). Truth stays in Supabase.

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as db from "./supabase.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url)); // app/lib

// Where a version is materialized to disk. Locally that is app/.deck-cache/,
// which survives restarts and makes the second open instant. A serverless
// function has no writable project directory and no disk that outlives the
// invocation, so it uses /tmp: same interface, same same-origin serving, just
// cold every time. Truth is in Supabase either way, so a lost cache costs a
// download, never data.
const SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
export const CACHE_ROOT = SERVERLESS
  ? path.join(os.tmpdir(), "oppr-deck-cache")
  : path.resolve(APP_DIR, "..", ".deck-cache");

export function versionDir(deckId, n) {
  return path.join(CACHE_ROOT, deckId, `v${n}`);
}

// Materialize deck version <n> into the cache. Writes index.html and downloads
// any referenced asset not already present. Returns the absolute dir.
export async function materialize(deckId, n) {
  const dir = versionDir(deckId, n);
  await fsp.mkdir(path.join(dir, "assets"), { recursive: true });

  const versions = await db.select("deck_versions", {
    deck_id: `eq.${deckId}`, n: `eq.${n}`, select: "html",
  });
  if (!versions.length) throw new Error("no such version");
  const html = versions[0].html;
  await fsp.writeFile(path.join(dir, "index.html"), html, "utf-8");

  const refs = new Set();
  let m;
  const re = /assets\/([^"')\s]+)/g;
  while ((m = re.exec(html))) refs.add(m[1]);
  if (refs.size) {
    const assets = await db.select("deck_assets", {
      deck_id: `eq.${deckId}`, select: "filename,storage_object",
    });
    const byName = Object.fromEntries(assets.map((a) => [a.filename, a.storage_object]));
    for (const fn of refs) {
      const dst = path.join(dir, "assets", fn);
      if (fs.existsSync(dst)) continue;
      const obj = byName[fn];
      if (!obj) continue;
      try { await fsp.writeFile(dst, await db.download(obj)); } catch {}
    }
  }
  return dir;
}

// Download a version's PDF into the cache and return its path, or null.
export async function materializePdf(deckId, n) {
  const versions = await db.select("deck_versions", {
    deck_id: `eq.${deckId}`, n: `eq.${n}`, select: "pdf_object",
  });
  const obj = versions[0]?.pdf_object;
  if (!obj) return null;
  const dir = versionDir(deckId, n);
  await fsp.mkdir(dir, { recursive: true });
  const dst = path.join(dir, path.basename(obj));
  if (!fs.existsSync(dst)) {
    try { await fsp.writeFile(dst, await db.download(obj)); } catch { return null; }
  }
  return dst;
}

// Thumbnail path for page 1 of a version, if present in cache. (The build job
// writes thumbs/v<n>/p*.png; we surface p1 for lists.)
export function thumbPath(deckId, n, page = 1) {
  return path.join(CACHE_ROOT, deckId, "thumbs", `v${n}`, `p${page}.png`);
}
