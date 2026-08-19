// Oppr Deck Studio App — local dev server.
//
// Zero runtime dependencies: Node built-ins only. `npm run dev` runs this.
// It reads the repo LIVE (so a new slide shows up on refresh) and writes ONLY
// under decks/drafts/. It never edits the library, decks, or brand — the CLI
// stays the engine. The front-end is plain ES modules in app/web/.
//
// Guardrails:
//   - GET /repo/<path>  serves any repo file READ-ONLY, with traversal blocked.
//   - POST/DELETE drafts touch ONLY decks/drafts/<safe-slug>/.
//   - Writes are confined to app-owned staging: decks/drafts/, social/drafts/,
//     dump/_app/, and social/_status.json (the publish-status log — posted date +
//     post link + archived flag per built output; tracking metadata, never a
//     built artifact).
//   - Last 30 days research is READ-ONLY over research/last30days/, with two
//     actions: POST /api/research/rebuild shells out to tools/research-brain.py
//     (the CLI stays the thing that writes brain.json/brain.md, from the runs),
//     and POST /api/research/sync mirrors the folder to Supabase Storage. The
//     app never hand-edits a run or the brain.
//   - ONE exception, and it only ever removes: DELETE /api/social-output/<channel>/<slug>
//     deletes a built social output folder outright. The app still never *edits*
//     a built artifact. Archiving is the non-destructive alternative and is just
//     a flag in the status log.
//   - Binds to 127.0.0.1 (localhost) only. No other network access.

import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deck Studio v3 backend: decks live as HTML versions in Supabase. These modules
// hold the secret key and never reach the browser (proxy-only).
import * as db from "./lib/supabase.mjs";
import { supabaseConfigured, supabaseUrl, anonKey } from "./lib/env.mjs";
import { memberFor, bearerFrom, canWrite, isOwner, audit, touch, sessionCookie, clearedCookie,
  createAccount, setAccountPassword, setOwnPassword, passwordProblem } from "./lib/auth.mjs";
import { validateSave, fingerprint } from "./lib/htmlcheck.mjs";
import * as jobs from "./lib/jobs.mjs";
import { pdfNameFor, printElement } from "./lib/jobs.mjs";
import { materialize, materializePdf, versionDir, CACHE_ROOT } from "./lib/deckcache.mjs";
import { clearanceForCustomer, patternForCustomer } from "./lib/namescope.mjs";
import { collidingDecks } from "./lib/collide.mjs";
import { requireLeaf, MASTER_STRUCTURAL_FIELDS, motherRouteFor } from "./lib/guard.mjs";
import { verifyJwt, audienceOk, protectedResourceMetadata, challenge,
         refusalReason } from "./lib/mcpauth.mjs";
import { TOOLS, callTool, negotiate, serverInfo, INSTRUCTIONS, SUPPORTED_VERSIONS,
         isWriteTool } from "./lib/mcp.mjs";

/**
 * Which pages of a published version no longer match their library slide.
 *
 * Deck Studio 3, SPEC §3. The recipe stores the hash each slide had at publish;
 * `library_slides` stores the hash it has now. A mismatch means the NEXT version
 * of this deck would differ — never that anything already published has changed.
 * A version without a recipe (pre-model, or a social artifact with no library
 * parentage) is simply not comparable, and reports nothing.
 */
// --- reading a pre-schema-2 recipe back out of the published document --------
// The values were rendered into the page, so they are recoverable; this is only
// ever a fallback, and every publish from now on records them properly.

function varsFromHtml(html) {
  const s = String(html || "");
  const strip = (x) => String(x || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  // The footer's meta is the second <span>, and the editor wraps it in a
  // `data-slot` span of its own, so the value has to be un-tagged rather than
  // taken raw. `.meta` on the cover is where cover_meta lands (cover/slide.html).
  const foot = /<footer class="slide-foot">[\s\S]*?<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<span class="pageno"/.exec(s)
            || /<footer class="slide-foot">[\s\S]*?<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/.exec(s);
  const cover = /<p class="meta"[^>]*>([\s\S]*?)<\/p>/.exec(s);
  const out = { deck_footer: strip(foot && foot[1]), cover_meta: strip(cover && cover[1]) };
  // Anything else a slide asked for. Recovering these by name is not possible
  // from the rendered page, so the one that matters in practice is read from
  // the sentence it sits in; the rest fall back to the library default.
  const start = /on the floor from ([^<.]+)\./.exec(s);
  if (start) out.start_target = strip(start[1]);
  return out;
}

function orderFromHtml(html) {
  return [...String(html || "").matchAll(/data-slide-id="([^"]+)"/g)].map((m) => m[1]);
}

function driftOf(recipe, libHash) {
  if (!recipe || !Array.isArray(recipe.chapters)) return [];
  const out = [];
  for (const chapter of recipe.chapters) {
    for (const s of chapter.slides || []) {
      const now = libHash.get(s.slide_id);
      if (now === undefined) {
        out.push({ slide_id: s.slide_id, chapter: chapter.id, reason: "gone" });
      } else if (s.content_hash && now !== s.content_hash) {
        out.push({ slide_id: s.slide_id, chapter: chapter.id, reason: "changed" });
      }
    }
  }
  return out;
}

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));

// Hosted there is no repo, and that is a decision rather than an accident.
//
// The Vercel project root is the repo root (so a plain `git push` finds an
// entrypoint), which means the builder traces a handful of repo JSON files into
// the function: brain.json, a couple of run.json, the draft files. A PARTIAL
// repo is worse than none. Every read below is "disk first, Storage second", so
// a brain.json frozen at deploy time would quietly win over the synced one, and
// researchWriteJson would try to write to a read-only filesystem. Pointing
// REPO_ROOT at a path that cannot exist makes every one of those fallbacks fire
// as designed, which is exactly how the app behaved before the move.
const SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const REPO_ROOT = SERVERLESS
  ? path.join(APP_DIR, "..", "no-repo-when-hosted")
  : path.resolve(APP_DIR, "..");
const WEB_DIR = path.join(APP_DIR, "web");
const DRAFTS_DIR = path.join(REPO_ROOT, "decks", "drafts");
const SOCIAL_DRAFTS_DIR = path.join(REPO_ROOT, "social", "drafts");
const SOCIAL_STATUS_FILE = path.join(REPO_ROOT, "social", "_status.json");
const DUMP_APP_DIR = path.join(REPO_ROOT, "dump", "_app");
const INDEX_JSON = path.join(APP_DIR, "index.json");
// Where the same index lives hosted. Must match publish-assets.INDEX_OBJECT.
const INDEX_OBJECT = "library/index.json";
// Last 30 days research: the run archive + the accumulated brain. Read-only to
// the app except for the rebuild/sync actions, which shell out to the CLI tool
// and to Storage respectively — the app never hand-edits a run or the brain.
// Read through researchRead/researchList, never straight off this path: hosted
// there is no repo on disk and the same files are served from Storage.
// Two files under it are app-owned rather than run output:
//   posts/_status.json  — which ideas have been spent (the .md files stay pristine)
//   performance.json    — engagement samples per posted item, keyed by draft slug,
//                         the feedback the aggregator folds back into the brain.
const RESEARCH_DIR = path.join(REPO_ROOT, "research", "last30days");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
// Localhost by default: this is a local tool and should not be reachable from
// the network by accident. On Vercel the platform routes to the function, so it
// must bind every interface or nothing can reach it.
const HOST = process.env.HOST || (process.env.VERCEL ? "0.0.0.0" : "127.0.0.1");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
};

function mimeFor(p) {
  return MIME[path.extname(p).toLowerCase()] || "application/octet-stream";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}

// Resolve a request path under a base dir, refusing anything that escapes it.
// The one allowlist for /repo. Directories a signed-in member may read, and
// nothing else. Kept next to safeResolve because the two are the same defence:
// safeResolve stops you leaving the root, this stops you reading the wrong
// thing inside it.
const REPO_PUBLIC_DIRS = /^(library|brand|templates|knowledge|types|social|research)\//;

export function repoPathAllowed(rel) {
  if (!rel || rel.includes("\0")) return false;
  // Any dot-segment, anywhere: .env, .git/config, library/.secret, and every
  // traversal spelling that survived decoding.
  if (rel.split("/").some((seg) => seg.startsWith("."))) return false;
  return REPO_PUBLIC_DIRS.test(rel);
}

function safeResolve(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath).replace(/\\/g, "/");
  const resolved = path.resolve(baseDir, "." + (decoded.startsWith("/") ? decoded : "/" + decoded));
  const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (resolved !== baseDir && !resolved.startsWith(baseWithSep)) return null;
  return resolved;
}

// `downloadName` sets Content-Disposition so the browser saves the file under
// the name the system computed, instead of the cache's path. Without it a
// downloaded deck arrives named after whatever the URL ended in.
async function serveFile(res, absPath, downloadName = "") {
  try {
    const stat = await fsp.stat(absPath);
    if (stat.isDirectory()) return send(res, 403, "Directory listing disabled");
    const stream = fs.createReadStream(absPath);
    const headers = { "Content-Type": mimeFor(absPath), "Cache-Control": "no-store" };
    if (downloadName) {
      const safe = downloadName.replace(/[^\w.\-]/g, "_");
      headers["Content-Disposition"] = `attachment; filename="${safe}"`;
    }
    res.writeHead(200, headers);
    stream.pipe(res);
    stream.on("error", () => { if (!res.headersSent) send(res, 500, "read error"); });
  } catch {
    send(res, 404, "Not found");
  }
}

// Regenerate app/index.json by running the Python builder. Tries `python`,
// then `py -3`. Resolves true on success, false on failure (server still
// serves the last good index.json if one exists).
function regenerateIndex() {
  return new Promise((resolve) => {
    const script = path.join(REPO_ROOT, "tools", "build_app_index.py");
    const attempts = [["python", [script]], ["py", ["-3", script]]];
    let i = 0;
    const tryNext = () => {
      if (i >= attempts.length) return resolve(false);
      const [cmd, args] = attempts[i++];
      const child = spawn(cmd, args, { cwd: REPO_ROOT });
      child.on("error", tryNext);
      child.on("close", (code) => (code === 0 ? resolve(true) : tryNext()));
    };
    tryNext();
  });
}

// Run a repo Python tool the same way regenerateIndex does (python, then py -3),
// collecting stdout+stderr so the caller can surface a real message.
function runPython(scriptRel, args = []) {
  return new Promise((resolve) => {
    const script = path.join(REPO_ROOT, ...scriptRel.split("/"));
    const attempts = [["python", [script, ...args]], ["py", ["-3", script, ...args]]];
    let i = 0;
    const tryNext = () => {
      if (i >= attempts.length) return resolve({ ok: false, out: "python not found" });
      const [cmd, argv] = attempts[i++];
      let out = "";
      const child = spawn(cmd, argv, { cwd: REPO_ROOT });
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("error", tryNext);
      child.on("close", (code) => (code === 0 ? resolve({ ok: true, out }) : resolve({ ok: false, out })));
    };
    tryNext();
  });
}

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const SLIDE_ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const HASH_RE = /^[0-9a-f]{7,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Slugify to match tools/deckstudio.slugify (kebab, ascii-ish).
function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

// Run git in the repo, resolve stdout (or reject). Args are passed as an array
// (never string-interpolated) so a validated id/hash can't inject flags.
function git(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: REPO_ROOT });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `git exit ${code}`))));
  });
}

function draftDir(slug) {
  if (!SLUG_RE.test(slug)) return null;
  const dir = safeResolve(DRAFTS_DIR, "/" + slug);
  if (!dir || dir === DRAFTS_DIR) return null;
  return dir;
}

async function readBody(req, limit = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error("body too large");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// The Config/Knowledge whitelist: which repo files the app may read as docs.
// Nothing outside this list is ever exposed by /api/knowledge.
//
// Hosted there is no repo on disk, so the walk below finds nothing and every doc
// reads as "not whitelisted". The list is then taken from the manifest that
// tools/publish-assets.py writes next to the docs it mirrored into Storage —
// which only the secret key can write, so it is as trustworthy as the disk.
export const KNOWLEDGE_MANIFEST = "knowledge/_manifest.json";

let _knowledgeCache = null;
async function knowledgeFiles() {
  if (_knowledgeCache) return _knowledgeCache;
  const out = new Set();
  const add = (rel) => { if (fs.existsSync(path.join(REPO_ROOT, rel))) out.add(rel.replace(/\\/g, "/")); };

  // Fixed docs.
  ["brand/BRAND.md", ".env.example", "CLAUDE.md",
   ".scratch/deck-tool/SPEC.md", ".scratch/deck-app/APP-SPEC.md", ".scratch/deck-app/V2-SPEC.md",
  ].forEach(add);

  // Walk for CLAUDE.md anywhere (excluding noise), plus knowledge/**, types/*/recipe.md,
  // .claude/commands/*.md.
  const SKIP = new Set([".git", "node_modules", "__pycache__", ".tmp-verify", ".tmp-catalog"]);
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel, depth + 1);
      else if (
        e.name === "CLAUDE.md" ||
        rel.startsWith("knowledge/") && e.name.endsWith(".md") ||
        rel.startsWith("types/") && e.name === "recipe.md" ||
        rel.startsWith(".claude/commands/") && e.name.endsWith(".md")
      ) out.add(rel);
    }
  };
  walk("", 0);

  // Nothing on disk means we are hosted, not that the repo has no docs.
  if (out.size === 0 && supabaseConfigured()) {
    try {
      const raw = await db.download(KNOWLEDGE_MANIFEST);
      for (const rel of JSON.parse(raw.toString("utf-8")).files || []) out.add(rel);
    } catch { /* leave the list empty rather than serve something unlisted */ }
  }

  _knowledgeCache = [...out].sort();
  return _knowledgeCache;
}

async function listDraftsIn(baseDir, shape) {
  try {
    const entries = await fsp.readdir(baseDir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const f = path.join(baseDir, e.name, "draft.json");
      if (!fs.existsSync(f)) continue;
      try {
        const d = JSON.parse(await fsp.readFile(f, "utf-8"));
        out.push(shape(e.name, d));
      } catch {
        out.push(shape(e.name, {}));
      }
    }
    return out;
  } catch {
    return [];
  }
}
// The social publish-status store (social/_status.json): { slug: {status, posted_date, url} }.
// Which built outputs are posted, when, and where. Tracking metadata the app
// owns, kept next to the outputs in the repo — and therefore, hosted, nowhere.
//
// Same rule as the research files: disk when there is a repo, Storage when there
// is not, and both kept in step so they do not drift until the next sync.
// Without this, marking a post as posted on Vercel wrote to a read-only
// filesystem: a 500, and the tick silently did not stick.
const SOCIAL_STATUS_OBJECT = "social/_status.json";

async function readSocialStatus() {
  try { return JSON.parse(await fsp.readFile(SOCIAL_STATUS_FILE, "utf-8")) || {}; }
  catch { /* hosted, or not written yet */ }
  if (!supabaseConfigured()) return {};
  try { return JSON.parse((await db.download(SOCIAL_STATUS_OBJECT)).toString("utf-8")) || {}; }
  catch { return {}; }
}

async function writeSocialStatus(all) {
  const text = JSON.stringify(all, null, 2);
  let onDisk = false;
  try {
    await fsp.writeFile(SOCIAL_STATUS_FILE, text, "utf-8");
    onDisk = true;
  } catch { /* hosted: read-only, Storage below is the only copy */ }
  if (supabaseConfigured()) {
    try { await db.upload(SOCIAL_STATUS_OBJECT, Buffer.from(text, "utf-8"), "application/json"); }
    catch (e) { if (!onDisk) throw new Error("could not save: no disk and no backend"); }
  } else if (!onDisk) {
    throw new Error("could not save: no disk and no backend");
  }
}

// --- Last 30 days research helpers -------------------------------------------

async function readJsonFile(abs) {
  try { return JSON.parse(await fsp.readFile(abs, "utf-8")); } catch { return null; }
}

async function serveText(res, abs) {
  try { return send(res, 200, await fsp.readFile(abs, "utf-8"), { "Content-Type": "text/plain; charset=utf-8" }); }
  catch { return send(res, 404, "Not found"); }
}

// Minimal `--- key: value ---` frontmatter reader for the LinkedIn post files.
// Values are plain strings; a comma list becomes an array for `tags`/`sources`.
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/i.exec(line.trim());
    if (!kv) continue;
    const [, k, raw] = kv;
    meta[k] = ["tags", "sources", "themes"].includes(k)
      ? raw.split(",").map((s) => s.trim()).filter(Boolean)
      : raw.trim();
  }
  return { meta, body: m[2] };
}

// --- reading research, on disk or hosted -------------------------------------
//
// Last 30 days read "No brain yet" the moment the app was hosted, for the same
// reason Knowledge read "Could not load": research/ is a repo folder, and hosted
// there is no repo on disk. The runs are already mirrored into Storage by the
// Sync action, so every read here is disk first, Storage second, and the same
// code serves both. Nothing below cares which one answered.
const RESEARCH_PREFIX = "research/last30days";

async function researchRead(rel) {
  try { return await fsp.readFile(path.join(RESEARCH_DIR, rel)); } catch { /* hosted */ }
  if (!supabaseConfigured()) return null;
  try { return await db.download(`${RESEARCH_PREFIX}/${rel}`); } catch { return null; }
}

async function researchReadJson(rel, fallback = null) {
  const buf = await researchRead(rel);
  if (!buf) return fallback;
  try { return JSON.parse(buf.toString("utf-8")); } catch { return fallback; }
}

// One level of a research folder. `folders` picks directories over files, which
// is the difference between listing the runs and listing the ideas.
async function researchList(rel, { folders = false } = {}) {
  try {
    const ents = await fsp.readdir(path.join(RESEARCH_DIR, rel), { withFileTypes: true });
    return ents.filter((e) => (folders ? e.isDirectory() : e.isFile())).map((e) => e.name).sort();
  } catch { /* hosted */ }
  if (!supabaseConfigured()) return [];
  try {
    const rows = await db.list(`${RESEARCH_PREFIX}/${rel ? rel + "/" : ""}`);
    return rows.filter((e) => e.isFolder === folders).map((e) => e.name).sort();
  } catch { return []; }
}

// The two research files the app itself writes (which ideas are spent, and the
// engagement readings). Disk when there is a repo, Storage when there is not, so
// recording a reading works hosted instead of failing on a read-only filesystem.
async function researchWriteJson(rel, obj) {
  const text = JSON.stringify(obj, null, 2) + "\n";
  const abs = path.join(RESEARCH_DIR, rel);
  if (fs.existsSync(RESEARCH_DIR)) {
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, text, "utf-8");
  }
  // Storage is kept in step either way: hosted it is the only copy, and locally
  // it stops the two from drifting until the next Sync.
  if (supabaseConfigured()) {
    try { await db.upload(`${RESEARCH_PREFIX}/${rel}`, Buffer.from(text, "utf-8"), mimeFor(rel)); }
    catch { if (!fs.existsSync(RESEARCH_DIR)) throw new Error("could not save: no disk and no backend"); }
  }
}

// A research text file over the same disk-then-Storage path as everything else.
async function sendResearchText(res, rel) {
  const buf = await researchRead(rel);
  if (!buf) return send(res, 404, "Not found");
  return send(res, 200, buf, { "Content-Type": "text/plain; charset=utf-8" });
}

async function listResearchPosts() {
  const names = (await researchList("posts")).filter((n) => n.endsWith(".md") && !n.startsWith("_"));
  if (!names.length) return [];
  const status = await researchReadJson("posts/_status.json", {});
  const out = [];
  for (const file of names) {
    try {
      const raw = await researchRead(`posts/${file}`);
      if (!raw) continue;
      const { meta, body } = frontmatter(raw.toString("utf-8"));
      const st = status[file] || {};
      out.push({
        file,
        title: meta.title || file.replace(/\.md$/, ""),
        kind: meta.kind || "linkedin-post",
        angle: meta.angle || "",
        theme: meta.theme || "",
        date: meta.date || "",
        chars: body.replace(/^#.*$/gm, "").trim().length,
        status: st.status || "idea",
        promoted_to: st.slug || null,
        promoted_at: st.promoted_at || null,
      });
    } catch { /* skip unreadable post */ }
  }
  return out;
}

// Idea -> social draft. Copies the body, keeps the lineage, and for an article
// writes the hero page through the CLI tool so the banner comes from the real
// linkedin.css. Deliberately does NOT build: /deckbuilder owns that.
async function promoteIdea(file, rawBody) {
  let over = {};
  try { over = rawBody ? JSON.parse(rawBody) : {}; } catch { /* optional overrides */ }

  // Promote writes a draft into social/drafts/, which is repo scratch the CLI
  // then builds. Hosted there is no repo, so say that plainly instead of failing
  // on a read-only filesystem halfway through.
  if (!fs.existsSync(REPO_ROOT) || !fs.existsSync(path.join(REPO_ROOT, "social"))) {
    const e = new Error("Promoting writes a draft into the repo, so it needs the CLI. Run /deckbuilder locally.");
    e.code = "ENOREPO";
    throw e;
  }
  const raw = await researchRead(`posts/${file}`);
  if (!raw) { const e = new Error("no such idea"); e.code = "ENOENT"; throw e; }
  const { meta, body } = frontmatter(raw.toString("utf-8"));
  const kind = meta.kind || "linkedin-post";
  const date = (meta.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const name = file.replace(/\.md$/, "").replace(/^\d+[-_]/, "");
  const slug = `${date}-${slugify(name)}`.slice(0, 80);

  const isArticle = kind === "linkedin-article";
  const claim = String(over.claim || meta.title || name);
  const draft = {
    slug, kind, channel: "linkedin",
    title: meta.title || name,
    intent: { angle: meta.angle || "", entitlement: "public" },
    pages: [], post: {}, status: "draft",
    body: body.trim(),
    hero: isArticle
      ? { claim, kicker: String(over.kicker ?? "Industrial AI"), stat_n: String(over.stat_n ?? ""), stat_l: String(over.stat_l ?? "") }
      : null,
    source_idea: file,
    themes: meta.theme ? [meta.theme] : [],
  };

  const dir = path.join(SOCIAL_DRAFTS_DIR, slug);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, "draft.json"), JSON.stringify(draft, null, 2) + "\n", "utf-8");

  let hero = null;
  if (isArticle) {
    const r = await runPython("tools/build-article-hero.py", ["--draft", `social/drafts/${slug}`]);
    hero = { ok: r.ok, out: r.out.trim() };
  }

  const status = await researchReadJson("posts/_status.json", {});
  status[file] = { status: "promoted", slug, promoted_at: new Date().toISOString().slice(0, 10) };
  await researchWriteJson("posts/_status.json", status);

  // Seed the performance record so the post shows up as awaiting a link, which
  // is what makes an unposted draft visible instead of silently forgotten.
  const perf = await readPerformance();
  perf.posts[slug] = perf.posts[slug] || {
    slug, title: draft.title, kind, source_idea: file, themes: draft.themes,
    posted_date: "", url: "", samples: [],
  };
  await researchWriteJson("performance.json", perf);

  return { ok: true, slug, kind, hero, prompt: `/deckbuilder build social ${slug}` };
}

const readPerformance = () => researchReadJson("performance.json", { posts: {} });

// One record per promoted post. `sample` appends a dated engagement reading;
// everything else merges, so recording the LinkedIn URL and adding numbers a
// week later are the same endpoint.
async function updatePerformance(slug, d) {
  const perf = await readPerformance();
  const rec = perf.posts[slug] || { slug, title: slug, kind: "linkedin-post", themes: [], posted_date: "", url: "", samples: [] };
  for (const k of ["title", "kind", "url", "posted_date", "source_idea"]) {
    if (typeof d[k] === "string") rec[k] = d[k];
  }
  if (Array.isArray(d.themes)) rec.themes = d.themes;
  if (d.sample && typeof d.sample === "object") {
    const s = d.sample;
    const num = (v) => (v === "" || v == null ? null : Number(v) || 0);
    rec.samples.push({
      date: String(s.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      impressions: num(s.impressions), likes: num(s.likes),
      comments: num(s.comments), reposts: num(s.reposts),
      source: String(s.source || "manual"),
    });
    rec.samples.sort((a, b) => a.date.localeCompare(b.date));
  }
  if (d.delete_sample != null) rec.samples.splice(Number(d.delete_sample), 1);
  perf.posts[slug] = rec;
  await researchWriteJson("performance.json", perf);
  return { ok: true, record: rec };
}

async function listResearchRuns() {
  const names = await researchList("runs", { folders: true });
  const out = [];
  for (const slug of names) {
    const r = await researchReadJson(`runs/${slug}/run.json`);
    if (!r) continue;
    const files = await researchList(`runs/${slug}`);
    const counts = (r.sources && r.sources.counts) || {};
    out.push({
      slug: r.slug || slug, date: r.date || "", topic: r.topic || slug,
      question: r.question || "", domain: r.domain || "", verdict: r.verdict || "",
      headline: r.headline || "",
      items: Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0),
      themes: (r.themes || []).length, findings: (r.findings || []).length,
      missing: (r.sources && r.sources.missing) || [],
      degraded: (r.sources && r.sources.degraded) || [],
      // What the run folder actually holds, so the UI does not offer a Raw
      // evidence button that opens nothing.
      has_raw: files.includes("raw.md"),
      has_brief: files.includes("brief.html"),
    });
  }
  out.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.slug.localeCompare(b.slug));
  return out;
}

async function researchIndex() {
  const brain = await researchReadJson("brain.json");
  const runs = await listResearchRuns();
  return {
    ok: true,
    // "Is there any research to show" is a question about content, not about
    // whether this particular machine has the folder checked out.
    configured: fs.existsSync(RESEARCH_DIR) || Boolean(brain) || runs.length > 0,
    backend: supabaseConfigured(),
    brain: brain
      ? {
          generated: brain.generated,
          themes: (brain.themes || []).length,
          established: (brain.themes || []).filter((t) => t.confidence === "established").length,
          corroborated: (brain.themes || []).filter((t) => t.confidence === "corroborated").length,
          vocabulary: (brain.vocabulary || []).length,
          stats: (brain.stats || []).length,
          entities: (brain.entities || []).length,
          questions: (brain.open_questions || []).length,
          coverage: brain.coverage || {},
        }
      : null,
    runs,
    posts: await listResearchPosts(),
    performance: Object.values((await readPerformance()).posts || {}),
  };
}

// Mirror the brain + every run artifact to Storage under its repo-relative path,
// the same convention decks/social/references already use. Skips the local
// sqlite cache (a rebuildable local index, not research output).
async function syncResearchToStorage() {
  const uploaded = [];
  const walk = async (abs) => {
    for (const e of await fsp.readdir(abs, { withFileTypes: true })) {
      const child = path.join(abs, e.name);
      if (e.isDirectory()) { await walk(child); continue; }
      if (e.name.endsWith(".db")) continue;
      const rel = path.relative(REPO_ROOT, child).replace(/\\/g, "/");
      await db.upload(rel, await fsp.readFile(child), mimeFor(child));
      uploaded.push(rel);
    }
  };
  await walk(RESEARCH_DIR);
  return { ok: true, uploaded: uploaded.length, files: uploaded };
}

const listDrafts = () => listDraftsIn(DRAFTS_DIR, (slug, d) => ({ slug, title: d.title || slug, slides: (d.slides || []).length }));
const listSocialDrafts = () => listDraftsIn(SOCIAL_DRAFTS_DIR, (slug, d) => ({ slug, title: d.title || slug, kind: d.kind || "carousel", pages: (d.pages || []).length }));

async function handleApi(req, res, url) {
  const p = url.pathname;

  // --- the gate ------------------------------------------------------------
  // Everything under /api needs a signed-in @oppr.ai member, with two
  // exceptions: /api/config tells the login screen which Supabase project to
  // authenticate against (it returns only public values), and /api/me is how the
  // browser asks "am I signed in?".
  if (p === "/api/config" && req.method === "GET") {
    return sendJson(res, 200, {
      supabase_url: supabaseUrl(),
      anon_key: anonKey(),
      domain: "oppr.ai",
      configured: Boolean(supabaseUrl() && anonKey()),
    });
  }

  const member = await memberFor(bearerFrom(req));

  if (p === "/api/me" && req.method === "GET") {
    if (!member) {
      res.setHeader("Set-Cookie", clearedCookie());
      return sendJson(res, 401, { error: "not signed in" });
    }
    touch(member);
    // Mirror the bearer token into an HttpOnly cookie so iframes, <img> and
    // download links — which cannot set headers — are covered by the same gate.
    const bearer = bearerFrom(req);
    if (bearer) {
      const secure = (req.headers["x-forwarded-proto"] || "").includes("https");
      res.setHeader("Set-Cookie", sessionCookie(bearer, secure));
    }
    return sendJson(res, 200, { member: {
      id: member.id, email: member.email, full_name: member.full_name, role: member.role,
    } });
  }

  if (!member) {
    return sendJson(res, 401, {
      error: "Sign in with your @oppr.ai account to use Deck Studio.",
      needs_auth: true,
    });
  }
  touch(member);

  // Changing your own password sits above the editor gate on purpose: a viewer
  // may not touch an artifact, but must always be able to look after their own
  // account.
  if (p === "/api/password" && req.method === "POST") {
    const d = JSON.parse(await readBody(req, 4_000));
    const problem = passwordProblem(d.password);
    if (problem) return sendJson(res, 400, { error: problem });
    try {
      await setOwnPassword(member.token, d.password);
      await audit(member, "account.password", null, { target: member.id, self: true });
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // Read is open to every member; changing anything needs editor or owner.
  if (req.method !== "GET" && !canWrite(member)) {
    return sendJson(res, 403, {
      error: `Your account is ${member.role}, which can view but not change anything. Ask an owner to make you an editor.`,
    });
  }

  // MOTHER WORK NEEDS AN OWNER (2026-08-07).
  //
  // Until here the only distinction was view-vs-change, so an editor could do
  // anything an owner could except manage accounts. That was fine when the only
  // editors were the two people who built this. With a commercial team it is
  // not: these routes do not change one customer's deck, they change what EVERY
  // FUTURE DECK will be made of.
  //
  // The line is blast radius, not seniority. Reassigning `is_master` re-points a
  // whole deck type; archiving a library slide removes it from every picker;
  // refresh, the research rebuild/sync and graphics import rewrite artifacts the
  // whole system reads. A colleague who wants to improve the pitch uses "Save as
  // a new deck", which already records where it came from, and an owner promotes
  // it. Routes whose motherhood depends on WHICH deck they target cannot be
  // decided from the path, so they call requireLeaf() once they know the row.
  // Both halves live in lib/guard.mjs, because the MCP server is a second front
  // door onto the same rule and a rule implemented twice eventually disagrees.
  if (req.method !== "GET" && !isOwner(member)) {
    const what = motherRouteFor(p);
    if (what) {
      return sendJson(res, 403, {
        error: "owner_only",
        message: `Only an owner can ${what}. That changes every deck made from here on, ` +
                 `not just one customer's. Ask an owner, or save your change as a new deck.`,
      });
    }
  }
  req.member = member;

  // --- accounts (the registry) ---------------------------------------------
  if (p === "/api/accounts" && req.method === "GET") {
    const rows = await db.select("profiles", {
      select: "id,email,full_name,role,disabled,created_at,last_seen_at",
      order: "created_at.asc",
    });
    return sendJson(res, 200, { accounts: rows, me: member.id, can_manage: isOwner(member) });
  }

  // Create a colleague's account, with the password they will first sign in
  // with. There is no self-serve signup: the domain rule says who *may* have an
  // account, an owner says who *does*.
  if (p === "/api/accounts" && req.method === "POST") {
    if (!isOwner(member)) return sendJson(res, 403, { error: "only an owner may add accounts" });
    const d = JSON.parse(await readBody(req, 20_000));
    const email = String(d.email || "").trim().toLowerCase();
    if (!email.endsWith("@oppr.ai")) {
      return sendJson(res, 400, { error: "Only @oppr.ai addresses can have an account." });
    }
    const problem = passwordProblem(d.password);
    if (problem) return sendJson(res, 400, { error: problem });
    const role = ["owner", "editor", "viewer"].includes(d.role) ? d.role : "editor";
    try {
      const user = await createAccount({
        email, password: d.password, full_name: d.full_name, invited_by: member.id,
      });
      // The trigger on auth.users writes the profile; role is ours to set.
      if (role !== "editor") await db.update("profiles", { id: user.id }, { role });
      await audit(member, "account.create", null, { target: user.id, email, role });
      return sendJson(res, 200, { ok: true, id: user.id, email, role });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  let pw = p.match(/^\/api\/accounts\/([0-9a-f-]{36})\/password$/i);
  if (pw && req.method === "POST") {
    if (!isOwner(member)) return sendJson(res, 403, { error: "only an owner may reset a password" });
    const d = JSON.parse(await readBody(req, 4_000));
    const problem = passwordProblem(d.password);
    if (problem) return sendJson(res, 400, { error: problem });
    try {
      await setAccountPassword(pw[1], d.password);
      await audit(member, "account.password", null, { target: pw[1] });
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  let acc = p.match(/^\/api\/accounts\/([0-9a-f-]{36})$/i);
  if (acc && req.method === "PATCH") {
    if (!isOwner(member)) return sendJson(res, 403, { error: "only an owner may change accounts" });
    const d = JSON.parse(await readBody(req, 20_000));
    const patch = {};
    if (["owner", "editor", "viewer"].includes(d.role)) patch.role = d.role;
    if (typeof d.disabled === "boolean") patch.disabled = d.disabled;
    if (!Object.keys(patch).length) return sendJson(res, 400, { error: "nothing to change" });
    // An owner must not be able to lock the last owner out of the system.
    if (acc[1] === member.id && (patch.role && patch.role !== "owner" || patch.disabled)) {
      return sendJson(res, 400, { error: "you cannot remove your own owner access" });
    }
    await db.update("profiles", { id: acc[1] }, patch);
    await audit(member, "account.update", null, { target: acc[1], ...patch });
    return sendJson(res, 200, { ok: true });
  }

  if (p === "/api/audit" && req.method === "GET") {
    const params = { select: "*", order: "at.desc", limit: url.searchParams.get("limit") || "100" };
    const deckId = url.searchParams.get("deck_id");
    if (deckId) params.deck_id = `eq.${deckId}`;
    return sendJson(res, 200, { entries: await db.select("audit_log", params) });
  }

  // The library index. Locally it is a generated file, rebuilt on demand by the
  // Python that generates it. Hosted there is neither Python nor a repo, so it
  // comes from Storage, where tools/publish-assets.py mirrors it.
  //
  // This is why the hosted Library read "Could not load the library index":
  // app/index.json is GENERATED and therefore gitignored, so a build from GitHub
  // never carried it. It only ever worked because deploys used to be pushed by
  // hand from app/, with the file sitting on one particular laptop.
  if (req.method === "GET" && p === "/api/index") {
    if (!SERVERLESS) {
      if (!fs.existsSync(INDEX_JSON)) await regenerateIndex();
      if (fs.existsSync(INDEX_JSON)) return serveFile(res, INDEX_JSON);
      return sendJson(res, 500, {
        error: "The library index could not be built. Is Python on PATH? Run `python tools/build_app_index.py`.",
      });
    }
    try {
      const buf = await db.download(INDEX_OBJECT);
      return send(res, 200, buf, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    } catch {
      return sendJson(res, 500, {
        error: "The library index is not in Storage yet. Run `python tools/publish-assets.py` locally to mirror it.",
      });
    }
  }

  if (req.method === "POST" && p === "/api/refresh") {
    _knowledgeCache = null;
    if (SERVERLESS) {
      return needsCli(res,
        "The library index is generated from the repo, so refreshing it runs on your machine.",
        "python tools\\publish-assets.py");
    }
    const ok = await regenerateIndex();
    return sendJson(res, ok ? 200 : 500, { ok });
  }

  // Slide fragment history (git log --follow).
  let hm = p.match(/^\/api\/history\/slide\/([^/]+)$/);
  if (req.method === "GET" && hm) {
    const id = hm[1];
    if (!SLIDE_ID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
    const rel = `library/slides/${id}/slide.html`;
    if (SERVERLESS) {
      return needsCli(res,
        "A slide's history is git history, and there is no checkout here.",
        `git log --follow -- ${rel}`);
    }
    try {
      const out = await git(["log", "--follow", "--format=%H%x1f%ad%x1f%s", "--date=short", "--", rel]);
      const commits = out.split("\n").filter(Boolean).map((l) => {
        const [hash, date, subject] = l.split("\x1f");
        return { hash, date, subject };
      });
      return sendJson(res, 200, { id, commits });
    } catch (e) {
      return sendJson(res, 500, { error: "git unavailable" });
    }
  }

  // One historical version of a fragment (git show <hash>:<path>).
  hm = p.match(/^\/api\/history\/slide\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && hm) {
    const [, id, hash] = hm;
    if (!SLIDE_ID_RE.test(id) || !HASH_RE.test(hash)) return send(res, 400, "bad request");
    if (SERVERLESS) return send(res, 501, "A past version of a slide comes from git, and there is no checkout here.");
    try {
      const body = await git(["show", `${hash}:library/slides/${id}/slide.html`]);
      return send(res, 200, body, { "Content-Type": "text/html; charset=utf-8" });
    } catch {
      return send(res, 404, "version not found");
    }
  }

  // Import graphics: stage files into dump/_app/<date>/ for /ingest-dump to file.
  // Base64 JSON (no multipart dep). The app never touches brand/img directly.
  // --- library element export (Deck Studio 2.0) ---------------------------
  // Download one slide / design-system block on its own, as a self-contained
  // file. HTML inlines its assets so it is a single portable document; PNG and
  // PDF are printed from that same document with the same headless browser the
  // build job uses, so an exported element looks exactly like a built one.
  if (req.method === "GET" && p === "/api/library/export") {
    const kind = url.searchParams.get("kind") || "slide";
    const elId = url.searchParams.get("id") || "";
    const format = url.searchParams.get("format") || "html";
    const allow = url.searchParams.get("allow") || "";
    if (!["slide", "block"].includes(kind)) return sendJson(res, 400, { error: "bad kind" });
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(elId)) return sendJson(res, 400, { error: "bad id" });
    if (!["html", "png", "pdf"].includes(format)) return sendJson(res, 400, { error: "bad format" });
    if (allow && !/^[a-z0-9,\-]{0,120}$/.test(allow)) return sendJson(res, 400, { error: "bad allow" });

    const outDir = path.join(CACHE_ROOT, "_exports", `${kind}-${elId}`);
    await fsp.mkdir(outDir, { recursive: true });
    const htmlPath = path.join(outDir, `${elId}.html`);
    const args = ["tools/export-element.py", "--kind", kind, "--id", elId, "--out", htmlPath];
    if (allow) args.push("--allow", allow);
    // PNG/PDF are printed by a browser, which cannot read the huge data: URIs
    // reliably at print time, so those formats use a sidecar assets/ folder.
    if (format !== "html") args.push("--sidecar");

    if (SERVERLESS) {
      return needsCli(res,
        "Exporting a library element reads the library off disk, so it runs on your machine.",
        `python tools\\export-element.py --kind ${kind} --id ${elId}`);
    }
    const r = await runPython(args[0], args.slice(1));
    if (!r.ok) {
      const refused = /REFUSED/.test(r.out);
      return sendJson(res, refused ? 403 : 500, { error: r.out.trim().slice(0, 600) });
    }
    if (format === "html") return serveFile(res, htmlPath, `oppr_${elId}.html`);

    const outFile = path.join(outDir, `oppr_${elId}.${format}`);
    try {
      await printElement(htmlPath, outFile, format);
    } catch (e) {
      return sendJson(res, 500, { error: String(e.message || e) });
    }
    return serveFile(res, outFile, `oppr_${elId}.${format}`);
  }

  if (req.method === "POST" && p === "/api/import-graphics") {
    // Staging for /ingest-dump, which files the images into brand/img/ and
    // describes them in library.json. Both halves have to be on one machine, so
    // there is nothing useful this can do hosted.
    if (SERVERLESS) {
      return needsCli(res,
        "Imported graphics are staged in the repo for /ingest-dump to file, so importing runs on your machine.",
        "/ingest-dump");
    }
    let data;
    try { data = JSON.parse(await readBody(req, 40_000_000)); } catch { return sendJson(res, 400, { error: "bad json" }); }
    const files = Array.isArray(data.files) ? data.files : [];
    if (!files.length) return sendJson(res, 400, { error: "no files" });
    if (files.length > 50) return sendJson(res, 400, { error: "too many files (max 50)" });
    const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
    const date = new Date().toISOString().slice(0, 10);
    let dir = path.join(DUMP_APP_DIR, date);
    // avoid clobbering a prior same-day import
    let n = 1;
    while (fs.existsSync(dir) && fs.readdirSync(dir).length) { dir = path.join(DUMP_APP_DIR, `${date}_${++n}`); }
    await fsp.mkdir(dir, { recursive: true });
    const written = [];
    for (const f of files) {
      const base = path.basename(String(f.name || "")).replace(/[^\w.\- ]/g, "_");
      const ext = path.extname(base).toLowerCase();
      if (!base || !IMG_EXT.has(ext)) continue;
      try {
        const buf = Buffer.from(String(f.data || "").split(",").pop(), "base64");
        await fsp.writeFile(path.join(dir, base), buf);
        written.push(base);
      } catch {}
    }
    if (!written.length) { await fsp.rm(dir, { recursive: true, force: true }); return sendJson(res, 400, { error: "no valid image files" }); }
    const note = `# App-imported graphics — ${date}\n\n${data.note ? String(data.note).slice(0, 4000) + "\n\n" : ""}Files:\n${written.map((w) => `- ${w}`).join("\n")}\n\nRun /ingest-dump to file these into brand/img/ + library.json (described, entitlement-gated).\n`;
    await fsp.writeFile(path.join(dir, "note.md"), note, "utf-8");
    return sendJson(res, 200, { ok: true, dir: path.relative(REPO_ROOT, dir).replace(/\\/g, "/"), count: written.length });
  }

  // Company intake: stage a new customer (name + logo + brief) into
  // dump/_app/<slug>/ for the CLI to file into customers/<slug>/ and build. The
  // app never writes customers/ itself — that stays CLI-owned.
  if (req.method === "POST" && p === "/api/customer-intake") {
    if (SERVERLESS) {
      return needsCli(res,
        "A new customer is filed into customers/ by /ingest-dump, so adding one runs on your machine.",
        "/ingest-dump");
    }
    let data; try { data = JSON.parse(await readBody(req, 40_000_000)); } catch { return sendJson(res, 400, { error: "bad json" }); }
    const name = String(data.name || "").trim().slice(0, 120);
    if (!name) return sendJson(res, 400, { error: "name is required" });
    const slug = String(data.slug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
    const dir = safeResolve(DUMP_APP_DIR, "/" + slug);
    if (!dir || dir === DUMP_APP_DIR) return sendJson(res, 400, { error: "invalid slug" });
    await fsp.mkdir(dir, { recursive: true });
    let logoName = "";
    if (typeof data.logo === "string") {
      const m = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.exec(data.logo);
      if (m) {
        const ext = m[1] === "svg+xml" ? "svg" : m[1] === "jpeg" ? "jpg" : m[1];
        logoName = `logo.${ext}`;
        try { await fsp.writeFile(path.join(dir, logoName), Buffer.from(data.logo.split(",").pop(), "base64")); }
        catch { logoName = ""; }
      }
    }
    const notes = String(data.notes || "").slice(0, 4000);
    const brief = String(data.brief || "").slice(0, 8000);
    const yaml = `name: ${JSON.stringify(name)}\nslug: ${slug}\n`
      + (logoName ? `logo: ${logoName}\n` : "")
      + (notes ? `notes: ${JSON.stringify(notes)}\n` : "");
    await fsp.writeFile(path.join(dir, "customer.yaml"), yaml, "utf-8");
    const briefMd = `# New customer intake — ${name}\n\n- slug: ${slug}\n- logo: ${logoName || "(none provided)"}\n\n## Brief\n\n${brief || "(no brief yet)"}\n\n---\nRun \`/ingest-dump\` (or \`/deckbuilder new-customer ${slug}\`) to file this into `
      + `\`customers/${slug}/\` and build the first deck.\n`;
    await fsp.writeFile(path.join(dir, "brief.md"), briefMd, "utf-8");
    return sendJson(res, 200, { ok: true, slug, dir: path.relative(REPO_ROOT, dir).replace(/\\/g, "/"), prompt: `/ingest-dump` });
  }

  // Social drafts (Phase 6): staged like deck drafts, built by /deckbuilder.
  const sm = p.match(/^\/api\/social-drafts\/([^/]+)$/);
  if (sm) {
    const slug = sm[1];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
    const dir = safeResolve(SOCIAL_DRAFTS_DIR, "/" + slug);
    if (!dir || dir === SOCIAL_DRAFTS_DIR) return sendJson(res, 400, { error: "invalid slug" });
    const file = path.join(dir, "draft.json");
    // A social draft is staging the CLI then builds, so writing one hosted would
    // stage it where no CLI can reach it.
    if (SERVERLESS && req.method !== "GET") {
      return needsCli(res,
        "A social draft is staged in the repo for /deckbuilder to build, so it is written on your machine.",
        `/deckbuilder build social ${slug}`);
    }
    if (req.method === "GET") {
      try { return sendJson(res, 200, JSON.parse(await fsp.readFile(file, "utf-8"))); }
      catch { return sendJson(res, 404, { error: "no such draft" }); }
    }
    if (req.method === "PUT" || req.method === "POST") {
      let d; try { d = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: "bad json" }); }
      // body/hero/source_idea/themes carry a promoted Last-30-days idea. They are
      // preserved here so editing a draft in the app never severs its lineage
      // back to the run and theme that produced it (the performance loop needs it).
      const rec = { slug, kind: String(d.kind || "carousel"), title: String(d.title || slug), channel: String(d.channel || "linkedin"), intent: d.intent || {}, pages: Array.isArray(d.pages) ? d.pages : [], post: d.post || {}, status: "draft",
        body: typeof d.body === "string" ? d.body : "", hero: d.hero || null,
        source_idea: d.source_idea || null, themes: Array.isArray(d.themes) ? d.themes : [] };
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(file, JSON.stringify(rec, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, slug, prompt: `/deckbuilder build social ${slug}` });
    }
    if (req.method === "DELETE") {
      try { await fsp.rm(dir, { recursive: true, force: true }); return sendJson(res, 200, { ok: true }); }
      catch { return sendJson(res, 500, { error: "delete failed" }); }
    }
  }
  if (req.method === "GET" && p === "/api/social-drafts") {
    return sendJson(res, 200, { drafts: await listSocialDrafts() });
  }

  // Social publish status: an app-owned log of which built outputs are posted,
  // when, and the post link. Keyed by output slug. This is tracking metadata,
  // not a build — it never touches the built artifacts under social/<channel>/.
  if (req.method === "GET" && p === "/api/social-status") {
    return sendJson(res, 200, await readSocialStatus());
  }
  const stm = p.match(/^\/api\/social-status\/([^/]+)$/);
  if (stm && (req.method === "PUT" || req.method === "POST")) {
    const slug = stm[1];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
    let d; try { d = JSON.parse(await readBody(req, 200_000)); } catch { return sendJson(res, 400, { error: "bad json" }); }
    const status = d.status === "posted" ? "posted" : "draft";
    const date = typeof d.posted_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.posted_date) ? d.posted_date : "";
    let url = typeof d.url === "string" ? d.url.trim().slice(0, 500) : "";
    if (url && !/^https?:\/\//i.test(url)) return sendJson(res, 400, { error: "url must start with http:// or https://" });
    // `archived` hides a finished output from the default lists. It is a flag in
    // this log, never a file move: the built artifact stays exactly where the CLI
    // put it, so archiving is reversible and destroys nothing.
    const archived = d.archived === true;
    const all = await readSocialStatus();
    if (status === "draft" && !date && !url && !archived) delete all[slug];
    else all[slug] = { status, posted_date: date, url, archived };
    try { await writeSocialStatus(all); }
    catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
    return sendJson(res, 200, { ok: true, slug, entry: all[slug] || { status: "draft", posted_date: "", url: "", archived: false } });
  }

  // Delete a built social output, folder and all.
  //
  // This is the ONE place the app removes a built artifact, so it is fenced hard:
  // channel and slug are pattern-checked, the path is rebuilt from them rather
  // than taken from the client, and the resolved directory must sit inside
  // social/<channel>/ before anything is removed. It is genuinely destructive and
  // irreversible for an output that was never committed, which is why the UI puts
  // a typed confirmation in front of it and offers Archive as the soft option.
  const delm = p.match(/^\/api\/social-output\/([a-z0-9-]{1,20})\/([^/]+)$/);
  if (delm && req.method === "DELETE") {
    const [, channel, slug] = delm;
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
    const socialChannelDir = path.join(REPO_ROOT, "social", channel);
    const dir = path.resolve(socialChannelDir, slug);
    if (dir !== path.join(socialChannelDir, slug) || !dir.startsWith(socialChannelDir + path.sep)) {
      return sendJson(res, 400, { error: "path outside social/<channel>/" });
    }
    // Idempotent on purpose. app/index.json is a cache, so a row can outlive the
    // folder it points at (deleted here, deleted by hand, moved by the CLI).
    // 404-ing on that left the stale row permanently undeletable: the only thing
    // that clears it is the index rebuild below, which is exactly what the user
    // is asking for by clicking delete. So a missing folder is a success that
    // removed nothing, and the index is regenerated either way.
    const existed = fs.existsSync(dir);
    try {
      if (existed) await fsp.rm(dir, { recursive: true, force: true });
      // v3: social lives in the backend — remove its registry row and publish
      // status there too (the storage objects are harmless orphans if left).
      if (supabaseConfigured()) {
        try { await db.del("social_outputs", { channel, slug }); } catch {}
        try { await db.del("publish_log", { slug }); } catch {}
      }
      const all = await readSocialStatus();
      if (all[slug]) { delete all[slug]; await writeSocialStatus(all); }
      _knowledgeCache = null;
      await regenerateIndex();
      return sendJson(res, 200, { ok: true, slug, removed: existed });
    } catch { return sendJson(res, 500, { error: "delete failed" }); }
  }

  // === Last 30 days research (brain + runs + posts) ========================
  // Read-only over research/last30days/. Two actions: rebuild (re-runs the
  // aggregator CLI) and sync (mirrors the brain + runs to Storage). Neither
  // ever writes a run by hand — runs come from the /last30days workflow.
  if (req.method === "GET" && p === "/api/research") {
    return sendJson(res, 200, await researchIndex());
  }
  if (req.method === "GET" && p === "/api/research/brain") {
    const b = await researchReadJson("brain.json");
    if (!b) return sendJson(res, 404, { error: "no brain yet", hint: "python tools/research-brain.py" });
    return sendJson(res, 200, b);
  }
  if (req.method === "GET" && p === "/api/research/brain.md") {
    return sendResearchText(res, "brain.md");
  }
  let rm = p.match(/^\/api\/research\/runs\/([^/]+)$/);
  if (req.method === "GET" && rm) {
    if (!SLUG_RE.test(rm[1])) return sendJson(res, 400, { error: "bad slug" });
    const r = await researchReadJson(`runs/${rm[1]}/run.json`);
    if (!r) return sendJson(res, 404, { error: "no such run" });
    return sendJson(res, 200, r);
  }
  rm = p.match(/^\/api\/research\/runs\/([^/]+)\/raw$/);
  if (req.method === "GET" && rm) {
    if (!SLUG_RE.test(rm[1])) return send(res, 400, "bad slug");
    return sendResearchText(res, `runs/${rm[1]}/raw.md`);
  }
  rm = p.match(/^\/api\/research\/posts\/([^/]+)$/);
  if (req.method === "GET" && rm) {
    if (!SLUG_RE.test(rm[1])) return send(res, 400, "bad slug");
    return sendResearchText(res, `posts/${rm[1]}`);
  }
  // Promote an idea into a social draft. This is the gate between "thinking out
  // loud" and "something we intend to ship": it copies the body into
  // social/drafts/, keeps the lineage (source idea + theme ids), and for an
  // article writes the 1200x627 hero page via the CLI tool. It never builds the
  // output — /deckbuilder still does that, with its verify gate.
  rm = p.match(/^\/api\/research\/posts\/([^/]+)\/promote$/);
  if (req.method === "POST" && rm) {
    const file = rm[1];
    if (!SLUG_RE.test(file) || !file.endsWith(".md")) return sendJson(res, 400, { error: "bad post" });
    try { return sendJson(res, 200, await promoteIdea(file, await readBody(req))); }
    catch (e) {
      const code = e.code === "ENOENT" ? 404 : e.code === "ENOREPO" ? 501 : 500;
      return sendJson(res, code, { error: String(e.message || e) });
    }
  }

  // Performance: the engagement samples behind "is this working".
  if (req.method === "GET" && p === "/api/research/performance") {
    return sendJson(res, 200, await readPerformance());
  }
  rm = p.match(/^\/api\/research\/performance\/([^/]+)$/);
  if (rm && (req.method === "PUT" || req.method === "POST")) {
    const slug = rm[1];
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "bad slug" });
    let d; try { d = JSON.parse(await readBody(req)); } catch { return sendJson(res, 400, { error: "bad json" }); }
    try { return sendJson(res, 200, await updatePerformance(slug, d)); }
    catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }

  if (req.method === "POST" && p === "/api/research/rebuild") {
    if (SERVERLESS) {
      return needsCli(res,
        "The brain is folded from the runs in the repo, so rebuilding it runs on your machine.",
        "python tools\\research-brain.py");
    }
    const r = await runPython("tools/research-brain.py");
    return sendJson(res, r.ok ? 200 : 500, { ok: r.ok, out: r.out.trim() });
  }
  if (req.method === "POST" && p === "/api/research/sync") {
    if (!supabaseConfigured()) return requireBackend(res);
    try { return sendJson(res, 200, await syncResearchToStorage()); }
    catch (e) { return sendJson(res, 500, { error: String(e.message || e) }); }
  }

  // Knowledge whitelist (Phase 7).
  if (req.method === "GET" && p === "/api/knowledge") {
    return sendJson(res, 200, { files: await knowledgeFiles() });
  }
  const km = p.match(/^\/api\/knowledge\/(.+)$/);
  if (req.method === "GET" && km) {
    const relPath = decodeURIComponent(km[1]);
    if (!(await knowledgeFiles()).includes(relPath)) return send(res, 403, "not whitelisted");
    const abs = safeResolve(REPO_ROOT, "/" + relPath);
    if (!abs) return send(res, 403, "forbidden");
    if (fs.existsSync(abs)) return serveFile(res, abs);
    // Hosted: same path in Storage, same as /repo does for images and fonts.
    if (supabaseConfigured()) {
      try { return send(res, 200, await db.download(relPath), { "Content-Type": mimeFor(relPath) }); }
      catch { /* fall through */ }
    }
    return send(res, 404, "Not found");
  }

  if (req.method === "GET" && p === "/api/drafts") {
    return sendJson(res, 200, { drafts: await listDrafts() });
  }

  // /api/drafts/<slug>
  const m = p.match(/^\/api\/drafts\/([^/]+)$/);
  if (m) {
    const slug = m[1];
    const dir = draftDir(slug);
    if (!dir) return sendJson(res, 400, { error: "invalid slug" });
    const file = path.join(dir, "draft.json");

    // A deck draft is staging for /new-deck. Composing a deck hosted goes
    // through the Deck builder instead, which publishes rather than stages.
    if (SERVERLESS && req.method !== "GET") {
      return needsCli(res,
        "A deck draft is staged in the repo for /new-deck to build. Hosted, compose it in the Deck builder instead.",
        "/new-deck");
    }

    if (req.method === "GET") {
      try {
        const d = JSON.parse(await fsp.readFile(file, "utf-8"));
        return sendJson(res, 200, d);
      } catch {
        return sendJson(res, 404, { error: "no such draft" });
      }
    }

    if (req.method === "PUT" || req.method === "POST") {
      let data;
      try {
        data = JSON.parse(await readBody(req));
      } catch {
        return sendJson(res, 400, { error: "bad json" });
      }
      const record = {
        slug,
        title: String(data.title || slug),
        type: String(data.type || ""),
        intent: data.intent || {},
        vars: data.vars || {},
        slides: Array.isArray(data.slides) ? data.slides : [],
        source_deck: data.source_deck || null,
        status: "draft",
      };
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(file, JSON.stringify(record, null, 2), "utf-8");
      return sendJson(res, 200, { ok: true, slug, prompt: `/deckbuilder build draft ${slug}` });
    }

    if (req.method === "DELETE") {
      try {
        await fsp.rm(dir, { recursive: true, force: true });
        return sendJson(res, 200, { ok: true });
      } catch {
        return sendJson(res, 500, { error: "delete failed" });
      }
    }
  }

  // === Deck Studio v3 backend (decks/customers/versions/build) =============
  // handleDeckApi sends its own response when it owns the route (send() returns
  // undefined, so we can't use its return value — check headersSent instead).
  await handleDeckApi(req, res, url);
  if (res.headersSent) return;

  return sendJson(res, 404, { error: "unknown endpoint" });
}

// Hosted there is no repo, no Python and no git, so a handful of actions cannot
// run there however the app is deployed. Each of them used to answer with a bare
// 500 ("git unavailable", {ok:false}), which reads as "this is broken" rather
// than "this one runs on your machine". 501 plus the prompt to run says which.
function needsCli(res, what, prompt = "") {
  sendJson(res, 501, { error: what, needs_cli: true, prompt, hosted: true });
  return false;
}

// The backend must be configured for any /api/decks|customers2|publish-log call.
function requireBackend(res) {
  if (supabaseConfigured()) return true;
  sendJson(res, 503, { error: "backend not configured", offline: true,
    hint: "Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env (see .env.example)." });
  return false;
}

// Handlers for the v3 deck backend. Returns a value (the send*) when it owns the
// route, or undefined to let the caller fall through to 404.
// What an artifact is allowed to CARRY, decided by the server from what the
// artifact IS -- never by the request. Three sources, in order:
//
//   version_of  -> inherit the deck row's clearance. Immutable by design: a
//                  version can never widen what a deck may say.
//   customer    -> public + that customer's scope, via the same one function
//                  the picker chips and the verify gate use.
//   neither     -> public.
//
// An OWNER may still state it explicitly (a multi-customer internal deck is
// real, and it is mother-adjacent work). That path is audited with the values.
export async function deriveClearance(recipe, member, select = db.select) {
  const asked = Array.isArray(recipe.allowed_entitlements) ? recipe.allowed_entitlements : null;

  if (recipe.version_of) {
    const rows = await select("decks", {
      slug: `eq.${recipe.version_of}`, select: "allowed_entitlements",
    });
    if (!rows.length) return { error: "no_such_deck", message: `no deck "${recipe.version_of}"` };
    return { allowed: rows[0].allowed_entitlements?.length ? rows[0].allowed_entitlements : ["public"] };
  }

  if (asked && isOwner(member)) return { allowed: asked.length ? asked : ["public"], explicit: true };

  const allowed = ["public"];
  if (recipe.customer) {
    const rows = await select("customers", {
      slug: `eq.${String(recipe.customer)}`, select: "slug,name",
    });
    if (!rows.length) {
      return { error: "no_such_customer",
               message: `no customer "${recipe.customer}". Register them first.` };
    }
    const scope = clearanceForCustomer(rows[0]);
    if (scope && !allowed.includes(scope)) allowed.push(scope);
  }
  return { allowed };
}

async function handleDeckApi(req, res, url) {
  const p = url.pathname;
  const isDeckRoute = p.startsWith("/api/decks") || p.startsWith("/api/customers2")
    || p.startsWith("/api/publish-log") || p.startsWith("/api/jobs")
    // startsWith, not ===: the build job is polled at /api/build/<job_id>, and
    // an exact match sent every poll to a 404 while the build ran fine.
    || p === "/api/slide-usage" || p.startsWith("/api/library") || p.startsWith("/api/build");
  if (!isDeckRoute) return undefined;
  if (!requireBackend(res)) return;

  try {
    // --- customer logo proxy (private bucket is not browser-readable) ------
    let clm = p.match(/^\/api\/customers2\/([^/]+)\/logo$/);
    if (clm && req.method === "GET") {
      if (!UUID_RE.test(clm[1])) return send(res, 400, "bad id");
      const rows = await db.select("customers", { id: `eq.${clm[1]}`, select: "logo_object" });
      const obj = rows[0]?.logo_object;
      if (!obj) return send(res, 404, "no logo");
      try { return send(res, 200, await db.download(obj), { "Content-Type": mimeFor(obj) }); }
      catch { return send(res, 404, "logo unavailable"); }
    }

    // --- customers ---------------------------------------------------------
    if (p === "/api/customers2") {
      if (req.method === "GET") {
        const rows = await db.select("customers", { select: "*", order: "name.asc" });
        // `clearance` is the entitlement slug a deck must hold to name this
        // customer. Computed here from the same rule the gate uses, so the chip
        // the New deck dialog offers and the scope verify enforces are the same
        // string rather than two hopefully-equal ones.
        for (const c of rows) c.clearance = clearanceForCustomer(c);
        return sendJson(res, 200, { customers: rows });
      }
      if (req.method === "POST") {
        const d = JSON.parse(await readBody(req, 200_000));
        const name = String(d.name || "").trim();
        if (!name) return sendJson(res, 400, { error: "name required" });
        const slug = slugify(d.slug || name).slice(0, 60);
        if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
        const existing = await db.select("customers", { slug: `eq.${slug}`, select: "*" });
        if (existing.length) {
          return sendJson(res, 200, { ok: true, id: existing[0].id, existed: true,
                                      customer: { ...existing[0], clearance: clearanceForCustomer(existing[0]) } });
        }
        // THE COLLISION GUARD. Registering a customer does not just add a folder
        // to file decks under: it creates a GATED TERM. buildNameScope derives
        // `\b<name>\b` from this row, and from then on any deck containing those
        // words fails verify unless it is cleared for this customer.
        //
        // That is exactly right for "Rhyze" and a disaster for "Core": every
        // published deck using an ordinary word would start failing, decks that
        // were correct when they were built and that nobody has touched since.
        // The built-in ten are hand-tuned against this (`selo` is
        // `\bselo\b(?!ct)`, `host` is `host\s*bioenergy`); a name typed in by a
        // salesperson gets no such tuning, so the machine checks it instead.
        //
        // Dry-run first, refuse with the evidence. `force` is the OWNER's escape
        // hatch for a name that genuinely is the company's name: an editor
        // passing force:true would otherwise walk straight past the guard and
        // retroactively fail every deck containing an ordinary word, which is
        // the entire thing this check exists to stop.
        const forced = Boolean(d.force) && isOwner(req.member);
        if (Boolean(d.force) && !isOwner(req.member)) {
          return sendJson(res, 403, {
            error: "owner_only",
            message: "Only an owner can force a customer name past the collision check.",
          });
        }
        const probe = patternForCustomer({ slug, name });
        if (probe && !forced) {
          const clashes = await collidingDecks(probe, clearanceForCustomer({ slug, name }));
          if (clashes.length) {
            return sendJson(res, 409, {
              error: "name_would_break_decks",
              pattern: probe,
              decks: clashes.slice(0, 12),
              count: clashes.length,
              message:
                `Registering "${name}" would gate the word${/\s/.test(name) ? "s" : ""} ` +
                `"${name.toLowerCase()}", and ${clashes.length} published ` +
                `deck${clashes.length === 1 ? "" : "s"} already use ` +
                `${clashes.length === 1 ? "it" : "them"} without being cleared for it. ` +
                `Use the fuller company name, or an owner can force it.`,
              can_force: isOwner(req.member),
            });
          }
        }

        const row = await db.insert("customers", { slug, name, notes: String(d.notes || "") });
        await audit(req.member, "customer.create", null, { slug, name, forced });
        return sendJson(res, 200, { ok: true, id: row[0].id,
                                    customer: { ...row[0], clearance: clearanceForCustomer(row[0]) } });
      }
    }

    // --- publish log (table-backed successor of social/_status.json) -------
    if (p === "/api/publish-log" && req.method === "GET") {
      const rows = await db.select("publish_log", { select: "*" });
      const map = {};
      for (const r of rows) map[r.slug] = { status: r.status, posted_date: r.posted_date, url: r.url, archived: r.archived };
      return sendJson(res, 200, map);
    }
    let plm = p.match(/^\/api\/publish-log\/([^/]+)$/);
    if (plm && (req.method === "PUT" || req.method === "POST")) {
      const slug = plm[1];
      if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: "invalid slug" });
      const d = JSON.parse(await readBody(req, 200_000));
      const status = d.status === "posted" ? "posted" : "draft";
      const date = typeof d.posted_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.posted_date) ? d.posted_date : "";
      let link = typeof d.url === "string" ? d.url.trim().slice(0, 500) : "";
      if (link && !/^https?:\/\//i.test(link)) return sendJson(res, 400, { error: "url must start with http:// or https://" });
      const archived = d.archived === true;
      await db.upsert("publish_log", [{ slug, status, posted_date: date, url: link, archived }], "slug");
      return sendJson(res, 200, { ok: true, slug, entry: { status, posted_date: date, url: link, archived } });
    }

    // --- jobs --------------------------------------------------------------
    let jm = p.match(/^\/api\/jobs\/([^/]+)$/);
    if (jm && req.method === "GET") {
      const job = jobs.getJob(jm[1]);
      if (!job) return sendJson(res, 404, { error: "no such job" });
      return sendJson(res, 200, { state: job.state, verify_report: job.verify_report, pdf: job.pdf, error: job.error });
    }

    // --- deck list ---------------------------------------------------------
    if (p === "/api/decks" && req.method === "GET") {
      const decks = await db.select("decks", { select: "*", order: "updated_at.desc" });
      // The list needs each artifact's CURRENT-version state, or the row can only
      // say "v3" and not whether v3 is verified or has ever been printed. One
      // query for all of them rather than one per row.
      // "How long is it, when did it last change, and who changed it" are facts
      // about the CURRENT VERSION, not the deck, so they are read from the
      // version row rather than from decks.updated_at — which also moves when
      // someone only renames or stars the artifact.
      const versions = await db.select("deck_versions", {
        select: "deck_id,n,verify_report,pdf_object,page_count,created_at,author,recipe" });
      // Drift (Deck Studio 3, SPEC §3): the recipe records the hash each library
      // slide had AT PUBLISH; library_slides holds the hash it has NOW. Comparing
      // two tables rather than the filesystem is what makes this work hosted,
      // where there is no repo on disk.
      const libRows = await db.select("library_slides", { select: "slide_id,content_hash" });
      const libHash = new Map(libRows.map((r) => [r.slide_id, r.content_hash]));
      const byDeck = new Map();
      for (const v of versions) {
        const cur = byDeck.get(v.deck_id);
        if (!cur || v.n > cur.n) byDeck.set(v.deck_id, v);
      }
      // The author is stored as an email; the overview wants a person.
      const people = await db.select("profiles", { select: "email,full_name" });
      const nameFor = new Map(people.map((p) => [p.email, p.full_name || ""]));
      for (const d of decks) {
        // Always the lazy endpoint, never a direct cache path: the picture may
        // not exist yet, and the endpoint renders it the first time it is asked
        // for. The row falls back to a placeholder if it 404s.
        d.thumb = `/api/decks/${d.id}/versions/${d.current_version_n}/thumb`;
        const v = byDeck.get(d.id);
        const current = v && v.n === d.current_version_n ? v : null;
        d.verify_report = current ? current.verify_report : null;
        d.pdf_current = Boolean(current && current.pdf_object);
        d.pdf_name = pdfNameFor(d);
        d.page_count = current ? current.page_count : 0;
        d.updated_at_version = current ? current.created_at : d.updated_at;
        d.updated_by = current ? (nameFor.get(current.author) || current.author) : "";
        // A flag means "the NEXT version of this deck would differ". It never
        // implies anything about the published version or its PDF, which stay
        // byte-identical until someone accepts.
        d.behind = driftOf(current && current.recipe, libHash);
        // Whether this deck can be the BASIS of a new one. Starting from an
        // existing deck copies its recipe, so a version published before the
        // recipe existed has nothing to copy — the New deck dialog says so
        // rather than offering a base that would silently start you empty.
        d.has_recipe = Boolean(current && current.recipe
                               && Array.isArray(current.recipe.chapters)
                               && current.recipe.chapters.length);
        // A deck left half-composed in the builder. The boolean is all the list
        // needs; shipping every draft recipe here would be a payload for nothing.
        d.has_draft = Boolean(d.draft_recipe);
        delete d.draft_recipe;
      }
      return sendJson(res, 200, { decks });
    }

    // Everything the builder needs to OPEN a deck: its published picks, its
    // unpublished draft if it has one, and the fixed facts a version inherits
    // and may not change (slug, type, client, clearance).
    //
    // Those last four are why this is not just `recipe`. A version of a deck is
    // the same deck: letting the builder re-pick the client or widen the
    // clearance would make "new version" a way around the entitlement gate.
    let rcm = p.match(/^\/api\/decks\/([^/]+)\/recipe$/);
    if (rcm && req.method === "GET") {
      if (!UUID_RE.test(rcm[1])) return sendJson(res, 400, { error: "bad id" });
      const rows = await db.select("decks", { id: `eq.${rcm[1]}`,
        select: "id,slug,title,type,kind,client_slug,is_master,current_version_n,draft_recipe,draft_updated_at" });
      if (!rows.length) return sendJson(res, 404, { error: "no such deck" });
      const d = rows[0];
      const v = await db.select("deck_versions", {
        deck_id: `eq.${d.id}`, n: `eq.${d.current_version_n}`, select: "recipe,page_count,html" });
      const recipe = v.length ? v[0].recipe : null;
      // Recipes written before schema 2 carry no vars and no explicit order.
      // Reopening such a deck and republishing would blank its footer and cover
      // meta, and verify would not catch it because an empty footer is still a
      // footer. So recover both from the published document itself.
      if (recipe && !recipe.vars) recipe.vars = varsFromHtml(v[0].html);
      if (recipe && !recipe.order) recipe.order = orderFromHtml(v[0].html);
      return sendJson(res, 200, {
        id: d.id, slug: d.slug, title: d.title, type: d.type, kind: d.kind,
        client: d.client_slug || "", is_master: d.is_master,
        version: d.current_version_n, page_count: v.length ? v[0].page_count : 0,
        recipe,
        draft: d.draft_recipe || null, draft_updated_at: d.draft_updated_at,
      });
    }

    // --- the deck builder: chapters, what is pickable, and building ---------
    //
    // A recipe is chapters and nothing else (SPEC §2). This serves the picker:
    // the chapter set, every slide with the intent metadata that makes a
    // suggestion possible, and the two independent reasons a slide cannot be
    // chosen — `retired` (the repo's flag, git-versioned) and `archived`
    // (demoted here so it cannot be picked by accident).
    if (p === "/api/library/chapters" && req.method === "GET") {
      const slides = await db.select("library_slides", {
        select: "slide_id,content_hash,chapter,role,title,retired,archived,archive_note,goal,entitlements" });
      const byId = new Map(slides.map((s) => [s.slide_id, s]));
      // Both mirrors, so this works hosted and the server never parses YAML.
      // library/chapters.yaml remains the source of truth; `--sync` refreshes.
      const chapters = await db.select("library_chapters", {
        select: "id,n,title,purpose,slides", order: "n.asc" });
      const out = chapters.map((c) => ({
        ...c,
        slides: (c.slides || []).map((sid) => {
          const s = byId.get(sid) || { slide_id: sid };
          return { ...s, pickable: !s.retired && !s.archived };
        }),
      }));
      return sendJson(res, 200, { chapters: out });
    }

    // Archive / restore a slide. The app never writes library/, so this is a
    // backend flag; `check-drift.py --apply-archives` promotes it into
    // meta.yaml when it should become permanent and land in git.
    let alm = p.match(/^\/api\/library\/slides\/([^/]+)\/archive$/);
    if (alm && req.method === "POST") {
      const sid = alm[1];
      const body = JSON.parse(await readBody(req, 4_000));
      const archived = Boolean(body.archived);
      const row = await db.select("library_slides", { slide_id: `eq.${sid}`, select: "slide_id,retired" });
      if (!row.length) return sendJson(res, 404, { error: "no such slide" });
      if (row[0].retired) {
        return sendJson(res, 409, { error: "that slide is already retired in the repo" });
      }
      await db.update("library_slides", { slide_id: sid }, {
        archived,
        archived_at: archived ? new Date().toISOString() : null,
        archived_by: archived ? (req.member?.email || "app") : null,
        archive_note: archived ? String(body.note || "").slice(0, 300) : null,
      });
      await audit(req.member, archived ? "slide.archive" : "slide.restore", sid, {});
      return sendJson(res, 200, { slide_id: sid, archived });
    }

    // Build (and publish) a deck from a chapter recipe. Verify still blocks:
    // a failing deck is not published and its failures come back here.
    //
    // Started as a JOB, not awaited. The pipeline runs five real gates over
    // 30-60 seconds; holding the request open for that hides which one you are
    // at and times out behind some proxies. Poll /api/build/<job_id>.
    if (p === "/api/build" && req.method === "POST") {
      const recipe = JSON.parse(await readBody(req, 200_000));
      if (!recipe.slug || !recipe.title) {
        return sendJson(res, 400, { error: "recipe needs a slug and a title" });
      }
      // `version_of` names a deck by SLUG, and that deck may be a master, so this
      // route is the one place a new version of a master can be published without
      // ever touching /api/decks/<id>/versions. A dry run publishes nothing and
      // is how you check a deck before asking an owner, so it stays open.
      if (recipe.version_of && !recipe.dry_run && !isOwner(req.member)) {
        const tgt = await db.select("decks", {
          slug: `eq.${recipe.version_of}`, select: "id,is_master,title,type",
        });
        if (tgt[0]?.is_master) {
          return sendJson(res, 403, {
            error: "owner_only",
            message: `"${tgt[0].title}" is the ${tgt[0].type || "company"} master. Only an owner can ` +
                     `publish a new version of it. Publish this as a new deck instead, ` +
                     `and an owner can promote it.`,
          });
        }
      }
      // Clearance is DERIVED, never accepted. Until 2026-08-19 this route took
      // `allowed_entitlements` straight from the body, and it flowed unchecked
      // into the deck-meta that verify then trusts -- so an editor could clear
      // their own deck for another customer, name them throughout, bundle their
      // imagery, and pass the gate. The entitlement model was bypassable by
      // exactly the people it exists to constrain.
      const clearance = await deriveClearance(recipe, req.member);
      if (clearance.error) return sendJson(res, 403, clearance);
      recipe.allowed_entitlements = clearance.allowed;

      const job = jobs.startRecipeBuild(recipe, { dryRun: Boolean(recipe.dry_run) });
      // deck_id is a uuid column and a slug is not one, so the slug belongs in
      // the detail. Passing it as the id made every build's audit row 400 and
      // vanish into the server log.
      await audit(req.member, recipe.dry_run ? "deck.build.dryrun" : "deck.build", null,
                  { slug: recipe.slug, job_id: job.id, version_of: recipe.version_of || null,
                    allowed_entitlements: clearance.allowed,
                    clearance_explicit: Boolean(clearance.explicit) });
      // Hosted, a job outliving its request is a bet, not a design: the instance
      // can be frozen the moment the response is sent, and the poll that follows
      // may land on a different one, where an in-memory job id means nothing. So
      // serverless finishes the work inside this invocation and answers with the
      // result. That is affordable because the JS pipeline is seconds rather than
      // the minute four Python subprocesses took, which is what made the job
      // worth streaming in the first place.
      if (SERVERLESS) {
        await job.done;
        return sendJson(res, 200, {
          job_id: job.id, state: job.state, steps: job.steps,
          result: job.result, error: job.error || "",
        });
      }
      return sendJson(res, 202, { job_id: job.id, state: job.state, steps: job.steps });
    }

    let bjm = p.match(/^\/api\/build\/([^/]+)$/);
    if (bjm && req.method === "GET") {
      const job = jobs.getRecipeJob(bjm[1]);
      if (!job) return sendJson(res, 404, { error: "no such build job" });
      return sendJson(res, 200, {
        job_id: job.id, state: job.state, steps: job.steps,
        result: job.state === "running" ? null : job.result,
        error: job.error || "",
      });
    }

    // --- a deck's WORKING recipe -------------------------------------------
    // Composing is real work. Losing it to a browser reload is not acceptable,
    // and localStorage makes it invisible to every other device. This is
    // deliberately NOT a version: the published deck is untouched until you
    // publish, which is the whole point of the SharePoint-shaped flow.
    let drm = p.match(/^\/api\/decks\/([^/]+)\/draft$/);
    if (drm && UUID_RE.test(drm[1])) {
      const id = drm[1];
      if (req.method === "GET") {
        const rows = await db.select("decks", {
          id: `eq.${id}`, select: "id,slug,draft_recipe,draft_updated_at" });
        if (!rows.length) return sendJson(res, 404, { error: "no such deck" });
        return sendJson(res, 200, {
          draft: rows[0].draft_recipe || null, updated_at: rows[0].draft_updated_at });
      }
      if (req.method === "PUT") {
        const body = JSON.parse(await readBody(req, 200_000));
        await db.update("decks", { id }, {
          draft_recipe: body.draft || null,
          draft_updated_at: new Date().toISOString(),
          draft_updated_by: req.member.id,
        });
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === "DELETE") {
        await db.update("decks", { id }, {
          draft_recipe: null, draft_updated_at: null, draft_updated_by: null });
        return sendJson(res, 200, { ok: true });
      }
    }

    // --- which artifacts use a library slide -------------------------------
    // "Used in" used to be derived by scanning decks/canonical + decks/variants
    // on disk. Those folders are build scratch and are now deleted after
    // publishing, so the only honest source is the published content itself:
    // every snapshot carries data-slide-id on each <section>.
    if (p === "/api/slide-usage" && req.method === "GET") {
      const decks = await db.select("decks", { select: "id,slug,title,current_version_n" });
      const versions = await db.select("deck_versions", { select: "deck_id,n,html" });
      const current = new Map(decks.map((d) => [d.id, d]));
      const usage = {};
      for (const v of versions) {
        const deck = current.get(v.deck_id);
        if (!deck || deck.current_version_n !== v.n) continue;
        const ids = new Set();
        for (const m of String(v.html).matchAll(/data-slide-id="([^"]+)"/g)) ids.add(m[1]);
        for (const id of ids) (usage[id] ||= []).push(deck.slug);
      }
      return sendJson(res, 200, { usage });
    }

    // --- deck detail -------------------------------------------------------
    let dm = p.match(/^\/api\/decks\/([^/]+)$/);
    if (dm && req.method === "GET") {
      const id = dm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const rows = await db.select("decks", { id: `eq.${id}`, select: "*" });
      if (!rows.length) return sendJson(res, 404, { error: "no such deck" });
      const deck = rows[0];
      const versions = await db.select("deck_versions", {
        deck_id: `eq.${id}`, select: "n,change_note,author,created_at,pdf_object,verify_report,page_count", order: "n.desc" });
      const family = await db.select("decks", {
        derived_from_deck_id: `eq.${id}`, select: "id,slug,title,audience_kind,audience_label,derived_from_version_n,current_version_n,status", order: "created_at.asc" });
      const current = versions.find((v) => v.n === deck.current_version_n);
      return sendJson(res, 200, {
        deck,
        // Everything the status surface needs to answer "is my PDF current?"
        // without the UI re-deriving it and getting a different answer.
        pdf: {
          name: pdfNameFor(deck),
          current: Boolean(current?.pdf_object),
          verify: current?.verify_report || null,
        },
        versions: versions.map((v) => ({
          n: v.n, change_note: v.change_note, author: v.author, created_at: v.created_at,
          page_count: v.page_count, has_pdf: Boolean(v.pdf_object),
          verify_summary: v.verify_report ? { fails: (v.verify_report.fails || []).length, warns: (v.verify_report.warns || []).length } : null,
        })),
        family,
      });
    }

    // --- patch the deck's own fields ---------------------------------------
    // Rename (title + the user-owned segment of the filename), plus the three
    // fields that exist purely to make an artifact findable again later: the
    // note, the star, and the post copy. None of them touch the content, so
    // none of them makes a version — they are metadata about the artifact.
    if (dm && req.method === "PATCH") {
      const id = dm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const d = JSON.parse(await readBody(req, 200_000));
      const rows = await db.select("decks", { id: `eq.${id}`, select: "*" });
      if (!rows.length) return sendJson(res, 404, { error: "no such deck" });
      const patch = {};
      if (typeof d.title === "string" && d.title.trim()) {
        // en dash, not em dash: the brand rule holds for titles too.
        patch.title = d.title.trim().replace(/—/g, "–").slice(0, 200);
      }
      if (typeof d.pdf_core === "string") patch.pdf_core = slugify(d.pdf_core).slice(0, 80);
      if (typeof d.note === "string") patch.note = d.note.replace(/—/g, "–").slice(0, 500);
      if (typeof d.starred === "boolean") patch.starred = d.starred;
      // Shelving, never deleting: the versions, their PDFs and the lineage all
      // stay exactly as they are, and the deck comes back with one click.
      if (typeof d.archived === "boolean") {
        patch.archived = d.archived;
        patch.archived_at = d.archived ? new Date().toISOString() : null;
        patch.archived_by = d.archived ? req.member.id : null;
        if (typeof d.archive_note === "string") patch.archive_note = d.archive_note.slice(0, 300);
      }
      // The deck's type. Free text on the row, but the index groups by it, so
      // fixing a deck that was published under the wrong one has to be possible
      // without a republish.
      if (typeof d.type === "string" && d.type.trim()) patch.type = d.type.trim().slice(0, 60);
      // The post copy is NOT em-dash-scrubbed: it is not a rendered artifact, it
      // is text a person wrote to paste elsewhere, and rewriting their
      // punctuation behind their back is worse than the rule it enforces.
      if (typeof d.post_text === "string") patch.post_text = d.post_text.slice(0, 20_000);
      if (!Object.keys(patch).length) return sendJson(res, 400, { error: "nothing to change" });
      // Motherhood is per-FIELD here. A note, a star and post copy are findability
      // metadata on any deck, master or not, and stay open to editors. Title,
      // pdf_core, type and archived are different: on a master they rewrite the
      // filename contract (`oppr_<type>.pdf`) or shelve the thing every customer
      // deck is copied from. The row is already loaded, so this needs no lookup.
      if (rows[0].is_master && !isOwner(req.member)) {
        const structural = Object.keys(patch).filter((k) => MASTER_STRUCTURAL_FIELDS.has(k));
        if (structural.length) {
          return sendJson(res, 403, {
            error: "owner_only",
            message: `"${rows[0].title}" is the ${rows[0].type || "company"} master. Only an owner can ` +
                     `change ${structural.join(", ")} on it. You can still set its note, star and post text.`,
          });
        }
      }
      patch.updated_by_id = req.member.id;
      await db.update("decks", { id }, patch);
      // Audit what changed, not what it changed to: a 3.000-character post body
      // in the audit trail is noise, and the note can be read off the row.
      await audit(req.member, "deck.patch", id, { fields: Object.keys(patch) });
      const after = { ...rows[0], ...patch };
      return sendJson(res, 200, { ok: true, deck: after, pdf_name: pdfNameFor(after) });
    }

    // --- sends: when a deck went out, and WHICH VERSION they got -----------
    //
    // Pinned to a version rather than just a deck, because versions are immutable
    // and the deck keeps moving: "sent on the 7th" cannot answer what the
    // customer is holding, and that is the question you ask most. Comparing the
    // sent version against current_version_n then gives "they have v1, we are on
    // v3" for free, with no extra bookkeeping.
    //
    // Recording a send is LEAF work on any deck, master included: it is a fact
    // about the world, not a change to the artifact, so it needs no requireLeaf.
    let sm = p.match(/^\/api\/decks\/([^/]+)\/sends$/);
    if (sm) {
      const id = sm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });

      if (req.method === "GET") {
        const rows = await db.select("deck_sends", { deck_id: `eq.${id}`, order: "sent_at.desc" });
        return sendJson(res, 200, { sends: rows });
      }

      if (req.method === "POST") {
        const d = JSON.parse(await readBody(req, 100_000));
        const decks = await db.select("decks", { id: `eq.${id}`, select: "id,title,current_version_n" });
        if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
        const n = Number(d.version_n) || decks[0].current_version_n;
        if (!n) return sendJson(res, 400, { error: "that deck has no published version to send" });
        // Unvalidated, `{"version_n": 99}` is stored verbatim: the timeline then
        // shows v99 and computes stale = 99 < current = false, so a deck reads as
        // current against a version that never existed.
        if (!Number.isInteger(n) || n < 1 || n > decks[0].current_version_n) {
          return sendJson(res, 400, {
            error: `no such version: that deck is at v${decks[0].current_version_n}`,
          });
        }
        const row = await db.insert("deck_sends", {
          deck_id: id,
          version_n: n,
          sent_at: d.sent_at ? new Date(d.sent_at).toISOString() : new Date().toISOString(),
          sent_by: req.member.id,
          sent_by_email: req.member.email,
          recipient: String(d.recipient || "").slice(0, 200),
          note: String(d.note || "").slice(0, 500),
        });
        await audit(req.member, "deck.sent", id, { version_n: n, recipient: d.recipient || "" });
        return sendJson(res, 200, { ok: true, send: row[0] });
      }
    }

    // Every send for a customer, newest first: the sales timeline behind their
    // page. Joined here rather than in the browser so the "is it stale" answer
    // is computed once, in the place that already knows both numbers.
    let cts = p.match(/^\/api\/customers2\/([^/]+)\/sends$/);
    if (cts && req.method === "GET") {
      const cust = cts[1];
      const cs = await db.select("customers", { slug: `eq.${cust}`, select: "id,slug,name" });
      if (!cs.length) return sendJson(res, 404, { error: "no such customer" });
      const decks = await db.select("decks", {
        customer_id: `eq.${cs[0].id}`, select: "id,slug,title,type,current_version_n",
      });
      if (!decks.length) return sendJson(res, 200, { sends: [] });
      const byId = new Map(decks.map((d) => [d.id, d]));
      const rows = await db.select("deck_sends", {
        deck_id: `in.(${decks.map((d) => d.id).join(",")})`, order: "sent_at.desc",
      });
      return sendJson(res, 200, {
        sends: rows.map((s) => {
          const d = byId.get(s.deck_id);
          return {
            ...s,
            deck_slug: d?.slug || "", deck_title: d?.title || "", deck_type: d?.type || "",
            current_version_n: d?.current_version_n || null,
            stale: Boolean(d && s.version_n < d.current_version_n),
          };
        }),
      });
    }

    // --- version thumbnail (page 1 by default) -----------------------------
    // Rendered on demand the first time it is asked for, so CLI-published and
    // imported artifacts get a picture too instead of a grey placeholder.
    let tm = p.match(/^\/api\/decks\/([^/]+)\/versions\/(\d+)\/thumb$/);
    if (tm && req.method === "GET") {
      const [, id, nStr] = tm;
      if (!UUID_RE.test(id)) return send(res, 400, "bad id");
      const page = Math.max(1, Number(url.searchParams.get("page") || 1));
      const first = await jobs.ensureThumbs(id, Number(nStr));
      if (!first) return send(res, 404, "no thumbnail");
      const wanted = page === 1 ? first : path.join(path.dirname(first), `p${page}.png`);
      if (!fs.existsSync(wanted)) return send(res, 404, "no such page");
      return serveFile(res, wanted);
    }

    // --- version html / view / pdf ----------------------------------------
    let vm = p.match(/^\/api\/decks\/([^/]+)\/versions\/(\d+)\/(html|view|pdf)$/);
    if (vm && req.method === "GET") {
      const [, id, nStr, kind] = vm;
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const n = Number(nStr);
      if (kind === "html") {
        const rows = await db.select("deck_versions", { deck_id: `eq.${id}`, n: `eq.${n}`, select: "html" });
        if (!rows.length) return send(res, 404, "no such version");
        return send(res, 200, rows[0].html, { "Content-Type": "text/html; charset=utf-8" });
      }
      if (kind === "view") {
        await materialize(id, n);
        res.writeHead(302, { Location: `/deck-cache/${id}/v${n}/index.html`, "Cache-Control": "no-store" });
        return res.end();
      }
      if (kind === "pdf") {
        // The PDF you download is ALWAYS the version you are looking at.
        //
        // A version saved in the editor has no PDF until something prints one.
        // Previously this 404'd (or, worse, the UI fell back to an older
        // version's file and handed over a document that did not match the
        // screen). Now a stale download prints on demand and waits.
        const rows = await db.select("decks", { id: `eq.${id}`, select: "*" });
        if (!rows.length) return sendJson(res, 404, { error: "no such deck" });
        const deck = rows[0];
        const wantName = pdfNameFor(deck);

        let pdfPath = await materializePdf(id, n);
        if (!pdfPath) {
          if (deck.current_version_n !== n) {
            return sendJson(res, 404, { error: "that older version was never printed" });
          }
          const job = await jobs.buildAndWait(deck);
          if (job.state === "pass") {
            pdfPath = await materializePdf(id, n);
          } else if (url.searchParams.get("unverified") === "1" && job.localPdf) {
            // The gate still stands: an unverified file is served only when
            // explicitly asked for, and is never attached to the version, so it
            // can never become "the" PDF of record.
            return serveFile(res, job.localPdf, "UNVERIFIED_" + wantName);
          } else {
            return sendJson(res, 409, {
              error: job.state === "error"
                ? `the PDF could not be produced: ${job.error}`
                : "verify failed, so the PDF is withheld",
              state: job.state,
              detail: job.error || "",
              verify_report: job.verify_report,
              can_download_unverified: Boolean(job.localPdf),
            });
          }
        }
        if (!pdfPath) return sendJson(res, 500, { error: "the PDF could not be produced" });
        return serveFile(res, pdfPath, wantName);
      }
    }

    // --- save a new version ------------------------------------------------
    let sv = p.match(/^\/api\/decks\/([^/]+)\/versions$/);
    if (sv && req.method === "POST") {
      const id = sv[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const bar = await requireLeaf(id, req.member, "publish a new version of");
      if (bar) return sendJson(res, 403, bar);
      const d = JSON.parse(await readBody(req, 4_000_000));
      const html = String(d.html || "");
      const decks = await db.select("decks", { id: `eq.${id}`, select: "id,current_version_n" });
      if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
      const cur = decks[0].current_version_n;
      const prevRows = await db.select("deck_versions", { deck_id: `eq.${id}`, n: `eq.${cur}`, select: "html" });
      const prev = prevRows[0]?.html || "";
      const assets = await db.select("deck_assets", { deck_id: `eq.${id}`, select: "filename" });
      const known = new Set(assets.map((a) => `assets/${a.filename}`));
      const v = validateSave(prev, html, known);
      if (!v.ok) return sendJson(res, 400, { error: v.error, code: v.code });
      // The brand gate, on a save. htmlcheck answers "is this the same document"
      // -- it says nothing about whether the words are allowed. Until now only a
      // BUILD ran verify, so text typed in the editor could introduce an em
      // dash, an unfilled placeholder or another customer's name and the first
      // thing to notice would be a PDF download, days later. Same rules, same
      // findings, same language as the build.
      const report = await jobs.verifyHtmlOnly(html);
      if (report.fails.length) {
        return sendJson(res, 400, {
          error: "verify failed", code: "verify",
          message: "This save breaks a brand rule, so it was not stored.",
          verify_report: report,
        });
      }
      const n = cur + 1;
      const note = String(d.change_note || "").slice(0, 400);
      await db.insert("deck_versions", {
        deck_id: id, n, html, change_note: note, verify_report: report,
        author: req.member.email, author_id: req.member.id,
      });
      await db.update("decks", { id }, { current_version_n: n, updated_by_id: req.member.id });
      await audit(req.member, "version.save", id, { n, change_note: note });
      return sendJson(res, 200, { ok: true, n });
    }

    // --- restore a version -------------------------------------------------
    let rm = p.match(/^\/api\/decks\/([^/]+)\/restore$/);
    if (rm && req.method === "POST") {
      const id = rm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const bar = await requireLeaf(id, req.member, "roll back");
      if (bar) return sendJson(res, 403, bar);
      const d = JSON.parse(await readBody(req, 50_000));
      const srcN = Number(d.n);
      const decks = await db.select("decks", { id: `eq.${id}`, select: "current_version_n" });
      if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
      const src = await db.select("deck_versions", { deck_id: `eq.${id}`, n: `eq.${srcN}`, select: "html" });
      if (!src.length) return sendJson(res, 404, { error: "no such version" });
      const n = decks[0].current_version_n + 1;
      await db.insert("deck_versions", {
        deck_id: id, n, html: src[0].html, change_note: `restored from v${srcN}`,
        author: req.member.email, author_id: req.member.id,
      });
      await db.update("decks", { id }, { current_version_n: n, updated_by_id: req.member.id });
      await audit(req.member, "version.restore", id, { from: srcN, n });
      return sendJson(res, 200, { ok: true, n });
    }

    // --- master toggle -----------------------------------------------------
    let mm = p.match(/^\/api\/decks\/([^/]+)\/master$/);
    if (mm && req.method === "POST") {
      const id = mm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const d = JSON.parse(await readBody(req, 10_000));
      const decks = await db.select("decks", { id: `eq.${id}`, select: "id,type" });
      if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
      if (d.is_master) {
        // "One master per type" is meaningless without a type, and the clear
        // below matches ON the type: with an empty one it would sweep every
        // typeless deck in the table. Refuse instead of doing damage.
        if (!decks[0].type) {
          return sendJson(res, 400, {
            error: "no_type",
            message: "Give this deck a type before making it the master — " +
                     "a master is the one deck of its type.",
          });
        }
        // one master per type: clear the current holder, then set this one
        await db.update("decks", { type: decks[0].type, is_master: "true" }, { is_master: false });
        await db.update("decks", { id }, { is_master: true });
      } else {
        await db.update("decks", { id }, { is_master: false });
      }
      await audit(req.member, "deck.master", id, { is_master: Boolean(d.is_master) });
      return sendJson(res, 200, { ok: true, is_master: Boolean(d.is_master) });
    }

    // --- register an asset (image swap / customer logo) --------------------
    let am = p.match(/^\/api\/decks\/([^/]+)\/assets$/);
    if (am && req.method === "POST") {
      const id = am[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const bar = await requireLeaf(id, req.member, "change the images in");
      if (bar) return sendJson(res, 403, bar);
      const d = JSON.parse(await readBody(req, 200_000));
      const decks = await db.select("decks", { id: `eq.${id}`, select: "allowed_entitlements" });
      if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
      const allowed = new Set([...(decks[0].allowed_entitlements || []), "public"]);
      // source is a repo image: brand/img/<file>
      const source = String(d.source || "");
      if (!source.startsWith("brand/img/")) return sendJson(res, 400, { error: "source must be a brand/img/ file" });
      const abs = safeResolve(REPO_ROOT, "/" + source);
      if (!abs || !fs.existsSync(abs)) return sendJson(res, 404, { error: "image not found" });
      // entitlement from library.json
      const lib = JSON.parse(await fsp.readFile(path.join(REPO_ROOT, "brand", "img", "library.json"), "utf-8"));
      const key = source.slice("brand/img/".length);
      const ent = (lib.images || []).find((m) => m.file === key)?.entitlement || "public";
      if (!allowed.has(ent)) return sendJson(res, 403, { error: `image entitlement '${ent}' exceeds deck clearance` });
      const buf = await fsp.readFile(abs);
      const filename = path.basename(key);
      const obj = `decks/${id}/assets/${filename}`;
      await db.upload(obj, buf, mimeFor(filename));
      const crypto = await import("node:crypto");
      const sha = crypto.createHash("sha256").update(buf).digest("hex");
      await db.upsert("deck_assets", [{ deck_id: id, filename, storage_object: obj, entitlement: ent, sha256: sha }], "deck_id,filename");
      // Also drop it into the editing version's cache so the iframe shows it now.
      if (Number.isInteger(d.cache_version)) {
        try {
          const cdir = path.join(versionDir(id, d.cache_version), "assets");
          await fsp.mkdir(cdir, { recursive: true });
          await fsp.writeFile(path.join(cdir, filename), buf);
        } catch {}
      }
      return sendJson(res, 200, { ok: true, filename: `assets/${filename}` });
    }

    // --- personalize a master into a derived deck --------------------------
    let pm = p.match(/^\/api\/decks\/([^/]+)\/personalize$/);
    if (pm && req.method === "POST") {
      return personalize(req, res, pm[1]);
    }

    // --- build (regenerate PDF + verify) -----------------------------------
    let bm = p.match(/^\/api\/decks\/([^/]+)\/build$/);
    if (bm && req.method === "POST") {
      const id = bm[1];
      if (!UUID_RE.test(id)) return sendJson(res, 400, { error: "bad id" });
      const bar = await requireLeaf(id, req.member, "regenerate the PDF of record for");
      if (bar) return sendJson(res, 403, bar);
      if (jobs.runningFor(id)) return sendJson(res, 409, { error: "a build is already running", job_id: jobs.runningFor(id) });
      const decks = await db.select("decks", { id: `eq.${id}`, select: "*" });
      if (!decks.length) return sendJson(res, 404, { error: "no such deck" });
      const { jobId } = jobs.startBuild(decks[0]);
      await audit(req.member, "build.run", id, { version: decks[0].current_version_n });
      return sendJson(res, 200, { ok: true, job_id: jobId });
    }
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }

  return undefined;
}

// Create a derived deck from a master: the client sends the personalized HTML
// (slot text/logo already filled); the server checks it is fingerprint-identical
// to the master's current version, copies the master's assets, and inserts a new
// deck + version 1 with lineage. (§5.3)
async function personalize(req, res, masterId) {
  const member = req.member;
  if (!UUID_RE.test(masterId)) return sendJson(res, 400, { error: "bad id" });
  const d = JSON.parse(await readBody(req, 4_000_000));
  const masters = await db.select("decks", { id: `eq.${masterId}`, select: "*" });
  if (!masters.length) return sendJson(res, 404, { error: "no such master" });
  const master = masters[0];
  const cur = master.current_version_n;
  const prevRows = await db.select("deck_versions", { deck_id: `eq.${masterId}`, n: `eq.${cur}`, select: "html" });
  const prev = prevRows[0]?.html || "";
  const html = String(d.html || "");

  const masterAssets = await db.select("deck_assets", { deck_id: `eq.${masterId}`, select: "*" });
  const known = new Set(masterAssets.map((a) => `assets/${a.filename}`));
  const v = validateSave(prev, html, known);
  if (!v.ok) return sendJson(res, 400, { error: v.error, code: v.code });

  const title = String(d.title || `${master.title} — ${d.audience?.label || "customer"}`).replace(/—/g, "-").slice(0, 200);
  const date = new Date().toISOString().slice(0, 10);
  let slug = `${date}_${slugify(title)}`.slice(0, 80);
  // ensure unique slug
  let n = 1, base = slug;
  while ((await db.select("decks", { slug: `eq.${slug}`, select: "id" })).length) slug = `${base}-${++n}`;

  let customerId = null, audienceKind = "person", audienceLabel = String(d.audience?.label || "");
  let clientSlug = "";
  if (d.customer_id && UUID_RE.test(d.customer_id)) {
    customerId = d.customer_id; audienceKind = "customer";
    const c = await db.select("customers", { id: `eq.${customerId}`, select: "name,slug" });
    if (c.length) { audienceLabel = c[0].name; clientSlug = c[0].slug; }
  } else if (d.audience?.kind) {
    audienceKind = d.audience.kind === "event" ? "event" : "person";
  }

  const row = await db.insert("decks", {
    slug, title, type: master.type, is_master: false,
    audience_kind: audienceKind, customer_id: customerId, audience_label: audienceLabel,
    client_slug: clientSlug, allowed_entitlements: master.allowed_entitlements,
    current_version_n: 1, derived_from_deck_id: masterId, derived_from_version_n: cur,
    created_by: member.email,
    created_by_id: member.id,
  });
  const newId = row[0].id;

  // copy the master's assets into the new deck (server-side storage copy)
  for (const a of masterAssets) {
    const dst = `decks/${newId}/assets/${a.filename}`;
    try { await db.copyObject(a.storage_object, dst); }
    catch { /* fall back: re-upload from cache if present */ }
    await db.upsert("deck_assets", [{ deck_id: newId, filename: a.filename, storage_object: dst, entitlement: a.entitlement, sha256: a.sha256 }], "deck_id,filename");
  }
  await db.insert("deck_versions", {
    deck_id: newId, n: 1, html, change_note: `personalized from ${master.slug} v${cur}`,
    author: member.email, author_id: member.id,
  });
  await audit(member, "deck.personalize", newId, { from: master.slug, from_version: cur });

  return sendJson(res, 200, { ok: true, deck: { id: newId, slug, title } });
}

// The whole router, as one request handler.
//
// --- MCP over Streamable HTTP -----------------------------------------------
//
// One endpoint, stateless. See lib/mcp.mjs for what the tools are and why the
// mother work is absent from them, and lib/mcpauth.mjs for token verification.
//
// The URL Claude is given must be exactly `<base>/mcp`, because the Protected
// Resource Metadata `resource` field has to match it character for character or
// the client refuses the pairing.

// A JWT `sub` is a user id, not a role. The role and the disabled flag live on
// `profiles`, and MCP callers are subject to exactly the same three roles as the
// browser -- an MCP that carried its own notion of permission would be a second
// access model, which is the failure this codebase already had once today.
async function mcpMember(claims) {
  if (!claims?.sub) return null;
  const rows = await db.select("profiles", {
    id: `eq.${claims.sub}`, select: "id,email,full_name,role,disabled",
  });
  const profile = rows[0];
  if (!profile || profile.disabled) return null;
  if (!String(profile.email || "").toLowerCase().endsWith("@oppr.ai")) return null;
  return profile;
}

function mcpBase(req) {
  const proto = (req.headers["x-forwarded-proto"] || "").split(",")[0]
    || (req.socket?.encrypted ? "https" : "http");
  return `${proto}://${req.headers.host}`;
}

async function handleMcp(req, res, url) {
  const base = mcpBase(req);
  const p = url.pathname;

  // Discovery is unauthenticated by definition: it is how a client learns where
  // to go and get a token in the first place.
  if (p.startsWith("/.well-known/oauth-protected-resource")) {
    if (req.method !== "GET") { res.setHeader("Allow", "GET"); return send(res, 405, "method not allowed"); }
    res.setHeader("Access-Control-Allow-Origin", "*");
    return sendJson(res, 200, protectedResourceMetadata(base));
  }

  // DNS-rebinding guard. Claude's servers send no browser Origin, so this checks
  // it only when present rather than requiring it.
  const origin = req.headers.origin;
  if (origin) {
    let bad = true;
    try {
      const o = new URL(origin);
      bad = !(o.host === req.headers.host || o.hostname === "127.0.0.1" || o.hostname === "localhost");
    } catch { bad = true; }
    if (bad) return sendJson(res, 403, { error: "forbidden origin" });
  }

  // Stateless: no GET stream, no session to DELETE. 405 is the compliant answer
  // and is what the 2026-07-28 revision mandates anyway.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, "method not allowed");
  }

  // Absent means a pre-2025-06-18 client, which the spec says to treat as
  // 2025-03-26 rather than reject.
  const ver = String(req.headers["mcp-protocol-version"] || "2025-03-26");
  if (!SUPPORTED_VERSIONS.includes(ver)) {
    return sendJson(res, 400, { jsonrpc: "2.0", id: null,
      error: { code: -32600, message: `Unsupported MCP-Protocol-Version: ${ver}` } });
  }

  let msg;
  try { msg = JSON.parse(await readBody(req, 1_000_000)); }
  catch { return sendJson(res, 400, { jsonrpc: "2.0", id: null,
    error: { code: -32700, message: "Parse error" } }); }

  // A JSON-RPC BATCH is an array, and an array has no `id`, so the notification
  // rule below would answer it 202-with-no-body and leave a conforming
  // 2025-03-26 client waiting forever for results it will never get. Refuse it
  // plainly instead: this server does not batch.
  if (Array.isArray(msg)) {
    return sendJson(res, 400, { jsonrpc: "2.0", id: null,
      error: { code: -32600, message: "Batched requests are not supported; send one message per request." } });
  }

  // A notification has no id and MUST get 202 with an empty body. Answering it
  // with a JSON-RPC response breaks strict clients.
  if (msg == null || msg.id === undefined) { res.writeHead(202); return res.end(); }

  const rpc = (result) => sendJson(res, 200, { jsonrpc: "2.0", id: msg.id, result });
  const rpcError = (code, message) => sendJson(res, 200, { jsonrpc: "2.0", id: msg.id, error: { code, message } });

  if (msg.method === "initialize") {
    return rpc({
      protocolVersion: negotiate(msg.params?.protocolVersion),
      capabilities: { tools: { listChanged: false } },
      serverInfo,
      instructions: INSTRUCTIONS,
    });
  }
  if (msg.method === "ping") return rpc({});

  // AUTH, at the HTTP layer. A 401 carrying WWW-Authenticate is the only thing
  // that makes Claude run OAuth and show a Connect button; a 200 with
  // `isError: true` and the words "please sign in" is handed to the model as an
  // ordinary tool result and the user just reads an apology.
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const claims = token ? await verifyJwt(token) : null;
  const resource = `${base}/mcp`;
  const member = claims && audienceOk(claims, resource) ? await mcpMember(claims) : null;
  if (!member) {
    // Say WHICH refusal it was. A valid token rejected on audience and no token
    // at all otherwise produce an identical 401, and the first one sends Claude
    // round the OAuth loop with nothing to read.
    const why = claims && !audienceOk(claims, resource)
      ? refusalReason(claims)
      : "Authentication required";
    res.setHeader("WWW-Authenticate", challenge(base, "invalid_token", why));
    return sendJson(res, 401, { error: "invalid_token", error_description: why });
  }

  if (msg.method === "tools/list") return rpc({ tools: TOOLS, nextCursor: null });

  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    // The browser's write gate keys on `req.method !== "GET"`, which cannot help
    // here: every MCP call is a POST, reads included. So the role is checked
    // explicitly, or a viewer would register customers and record sends through
    // a door that never asked what they were allowed to do.
    if (isWriteTool(name) && !canWrite(member)) {
      return rpc({
        content: [{ type: "text", text:
          `Your account is ${member.role}, which can read Deck Studio but not change it. ` +
          `Ask an owner to make you an editor.` }],
        isError: true,
      });
    }
    const out = await callTool(name, msg.params?.arguments, member);
    if (out?.unknown) return rpcError(-32602, `Unknown tool: ${name}`);
    await audit(member, "mcp.tool", null, { tool: name });
    return rpc(out);
  }

  return rpcError(-32601, `Method not found: ${msg.method}`);
}

// Locally it is wrapped in an http server; on Vercel `api/index.mjs` calls it
// directly. One implementation either way — a second copy of the routing is how
// a hosted app and a local app quietly stop behaving the same.
export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const p = url.pathname;

    if (p === "/mcp" || p.startsWith("/.well-known/oauth-protected-resource")) {
      return handleMcp(req, res, url);
    }
    if (p.startsWith("/api/")) return handleApi(req, res, url);

    // Read-only window onto the repo (thumbs, images, assembled deck previews).
    // v3 cleanup: content (social/, references/, decks/) now lives in Supabase
    // Storage at an object path equal to its old repo-relative path. When such a
    // file is not on local disk, fall back to Storage so the app is unchanged.
    if (p.startsWith("/repo/")) {
      if (req.method !== "GET") return send(res, 405, "method not allowed");
      // Gated: /repo serves brand imagery and, via the Storage fallback, deck and
      // social content. Unauthenticated it would be the whole library.
      if (!(await memberFor(bearerFrom(req)))) return send(res, 401, "sign in first");
      const rel = decodeURIComponent(p.slice("/repo/".length)).replace(/\\/g, "/");
      // ONE allowlist, both branches. Until 2026-08-19 this test guarded only the
      // Storage fallback, so the disk branch below served ANY file under the repo
      // root to any signed-in member -- .env (the service-role key), .git/config,
      // settings files. A path allowlist that covers one of two branches is not a
      // path allowlist. Dotfiles are refused outright at every segment, because
      // the next secret to land in the repo will also be a dotfile.
      if (!repoPathAllowed(rel)) return send(res, 404, "Not found");
      const abs = safeResolve(REPO_ROOT, p.slice("/repo".length));
      if (!abs) return send(res, 403, "forbidden");
      if (fs.existsSync(abs)) return serveFile(res, abs);
      // Hosted, there is no repo on disk: the front-end still asks for brand
      // images, fonts, slide thumbnails and design-system specimens under
      // /repo/. `studio publish-library` mirrors those into Storage at the same
      // relative path, so the same URL works locally (from disk) and hosted
      // (from Storage) with no change in the browser.
      if (supabaseConfigured()) {
        try { return send(res, 200, await db.download(rel), { "Content-Type": mimeFor(rel) }); }
        catch { /* fall through to 404 */ }
      }
      return send(res, 404, "Not found");
    }

    // Read-only window onto the materialized deck cache (viewer + editor iframes
    // load a version's index.html + assets from here; the agent writes it).
    if (p.startsWith("/deck-cache/")) {
      if (req.method !== "GET") return send(res, 405, "method not allowed");
      // Gated: this is the rendered deck itself — HTML, assets and PDFs.
      if (!(await memberFor(bearerFrom(req)))) return send(res, 401, "sign in first");
      const abs = safeResolve(CACHE_ROOT, p.slice("/deck-cache".length));
      if (!abs) return send(res, 403, "forbidden");
      return serveFile(res, abs);
    }

    // Front-end.
    if (req.method !== "GET") return send(res, 405, "method not allowed");
    if (p === "/" || p === "") return serveFile(res, path.join(WEB_DIR, "index.html"));
    // The OAuth consent screen. A real path, not a hash route: Supabase's OAuth
    // server sends people here with ?authorization_id=..., and it is configured
    // as `Authorization Path` in the dashboard, so the URL is fixed on their
    // side. Served UNAUTHENTICATED on purpose -- the page signs the person in
    // itself, because someone arriving from another application will often not
    // have a session yet, and bouncing them into the app would lose the
    // authorization_id and strand the connection.
    if (p === "/oauth/consent") return serveFile(res, path.join(WEB_DIR, "oauth-consent.html"));
    const abs = safeResolve(WEB_DIR, p);
    if (!abs) return send(res, 403, "forbidden");
    return serveFile(res, abs);
  } catch (err) {
    if (!res.headersSent) send(res, 500, "server error");
  }
}

// Vercel treats this file as the root entrypoint and requires a default export
// that is a request handler or a server. The same function `npm run dev` wraps
// in an http server — so hosted and local run identical code, which is the whole
// point of not writing a separate serverless implementation.
export default handleRequest;

// Only bind a port when this file IS the program. On Vercel it is imported for
// its default export, and binding would be wrong there.
const isEntry = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  && !process.env.VERCEL;

if (isEntry) {
  http.createServer(handleRequest).listen(PORT, HOST, async () => {
    process.stdout.write("Oppr Deck Studio App\n");
    process.stdout.write("Refreshing library index... ");
    const ok = await regenerateIndex();
    process.stdout.write(ok ? "done.\n" : "could not run Python (serving last known index).\n");
    process.stdout.write(`\n  ->  http://${HOST}:${PORT}\n\n`);
    process.stdout.write("Browse & compose in the browser. Ctrl+C to stop.\n");
  });
}
