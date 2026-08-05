// Reading a repo file, wherever the app happens to be running.
//
// The assembler needs library/chapters.yaml, the slide fragments, the icon set,
// the two template stylesheets, the image manifest and every image and font a
// slide references. Locally those are on disk. Hosted there is no repo, so they
// come from Supabase Storage at the SAME relative path, which is what
// tools/publish-assets.py mirrors them to.
//
// This is the same disk-first, Storage-second rule the /repo route already
// applies for the browser, in one place the build path can share. Nothing above
// this module cares which one answered.
//
// Reads are memoised for the life of a build: assembling a 16-slide deck asks
// for deck.css once per stylesheet link and for a font once per @font-face, and
// on Vercel every one of those is a network round trip.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as db from "./supabase.mjs";
import { supabaseConfigured } from "./env.mjs";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "..", "..");

// Only these trees are mirrored to Storage (publish-assets.py TREES). Asking for
// anything else hosted is a bug, not a miss, so it fails loudly rather than
// silently returning null after a pointless round trip.
const MIRRORED = /^(library|brand|templates|knowledge|types|\.claude)\//;

export const SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Storage says 400 for an object that is not there, so "absent" and "the request
// failed" arrive looking alike. That distinction matters more here than
// anywhere else in the app: this module feeds the assembler, and a read that
// quietly returns nothing does not fail the build — it changes the document.
// A dropped meta.yaml became `data-role=""` on a slide, and role is what the
// verify gate checks footer discipline against.
//
// So: retry anything that is not a clean not-found, and only call it absent
// once the answer has been the same three times.
const ABSENT = new Set([400, 404]);
const ATTEMPTS = 3;

async function fromStorage(key) {
  let last = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await db.download(key);
    } catch (e) {
      last = e;
      if (ABSENT.has(e?.status)) return null;          // genuinely not mirrored
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  throw new Error(`could not read ${key} from Storage after ${ATTEMPTS} attempts: ${last?.message || last}`);
}

export class RepoFiles {
  constructor() {
    this.cache = new Map();   // rel -> Buffer | null
  }

  /** Raw bytes of a repo-relative file, or null if it does not exist. */
  async bytes(rel) {
    const key = String(rel).replace(/\\/g, "/").replace(/^\.?\//, "");
    if (this.cache.has(key)) return this.cache.get(key);

    let out = null;
    const abs = path.join(REPO_ROOT, key);
    // path.join normalises, so a "../" in rel would escape the repo. Refuse.
    // Hosted, disk is skipped entirely rather than tried first: the function
    // bundle carries a few traced repo JSON files (brand/img/library.json among
    // them) but not the library, and a build that read half its inputs from a
    // deploy-time copy and half from Storage would be reproducible from neither.
    if (!SERVERLESS && (abs.startsWith(REPO_ROOT + path.sep) || abs === REPO_ROOT)) {
      try { out = await fsp.readFile(abs); } catch { /* genuinely absent */ }
    }
    if (out === null && supabaseConfigured() && MIRRORED.test(key)) {
      out = await fromStorage(key);
    }
    this.cache.set(key, out);
    return out;
  }

  /** UTF-8 text of a repo-relative file, or null. */
  async text(rel) {
    const b = await this.bytes(rel);
    return b === null ? null : b.toString("utf-8");
  }

  async exists(rel) {
    return (await this.bytes(rel)) !== null;
  }

  /** Text, or a thrown error naming the file. Used where a miss is fatal. */
  async mustText(rel, what = "file") {
    const t = await this.text(rel);
    if (t === null) throw new Error(`${what} not found: ${rel}`);
    return t;
  }
}

export const repoRoot = REPO_ROOT;
export const hasRepoOnDisk = !SERVERLESS && fs.existsSync(path.join(REPO_ROOT, "library", "slides"));
