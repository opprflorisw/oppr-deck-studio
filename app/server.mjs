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
//   - Binds to 127.0.0.1 (localhost) only. No other network access.

import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(APP_DIR, "..");
const WEB_DIR = path.join(APP_DIR, "web");
const DRAFTS_DIR = path.join(REPO_ROOT, "decks", "drafts");
const INDEX_JSON = path.join(APP_DIR, "index.json");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
const HOST = "127.0.0.1";

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
function safeResolve(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath).replace(/\\/g, "/");
  const resolved = path.resolve(baseDir, "." + (decoded.startsWith("/") ? decoded : "/" + decoded));
  const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : baseDir + path.sep;
  if (resolved !== baseDir && !resolved.startsWith(baseWithSep)) return null;
  return resolved;
}

async function serveFile(res, absPath) {
  try {
    const stat = await fsp.stat(absPath);
    if (stat.isDirectory()) return send(res, 403, "Directory listing disabled");
    const stream = fs.createReadStream(absPath);
    res.writeHead(200, { "Content-Type": mimeFor(absPath), "Cache-Control": "no-store" });
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

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/;

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

async function listDrafts() {
  try {
    const entries = await fsp.readdir(DRAFTS_DIR, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const f = path.join(DRAFTS_DIR, e.name, "draft.json");
      if (fs.existsSync(f)) {
        try {
          const d = JSON.parse(await fsp.readFile(f, "utf-8"));
          out.push({ slug: e.name, title: d.title || e.name, slides: (d.slides || []).length });
        } catch {
          out.push({ slug: e.name, title: e.name, slides: 0 });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function handleApi(req, res, url) {
  const p = url.pathname;

  if (req.method === "GET" && p === "/api/index") {
    if (!fs.existsSync(INDEX_JSON)) await regenerateIndex();
    if (!fs.existsSync(INDEX_JSON)) return sendJson(res, 500, { error: "index unavailable" });
    return serveFile(res, INDEX_JSON);
  }

  if (req.method === "POST" && p === "/api/refresh") {
    const ok = await regenerateIndex();
    return sendJson(res, ok ? 200 : 500, { ok });
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

  return sendJson(res, 404, { error: "unknown endpoint" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const p = url.pathname;

    if (p.startsWith("/api/")) return handleApi(req, res, url);

    // Read-only window onto the repo (thumbs, images, assembled deck previews).
    if (p.startsWith("/repo/")) {
      if (req.method !== "GET") return send(res, 405, "method not allowed");
      const abs = safeResolve(REPO_ROOT, p.slice("/repo".length));
      if (!abs) return send(res, 403, "forbidden");
      return serveFile(res, abs);
    }

    // Front-end.
    if (req.method !== "GET") return send(res, 405, "method not allowed");
    if (p === "/" || p === "") return serveFile(res, path.join(WEB_DIR, "index.html"));
    const abs = safeResolve(WEB_DIR, p);
    if (!abs) return send(res, 403, "forbidden");
    return serveFile(res, abs);
  } catch (err) {
    if (!res.headersSent) send(res, 500, "server error");
  }
});

server.listen(PORT, HOST, async () => {
  process.stdout.write("Oppr Deck Studio App\n");
  process.stdout.write("Refreshing library index... ");
  const ok = await regenerateIndex();
  process.stdout.write(ok ? "done.\n" : "could not run Python (serving last known index).\n");
  process.stdout.write(`\n  ->  http://${HOST}:${PORT}\n\n`);
  process.stdout.write("Browse & compose in the browser. Ctrl+C to stop.\n");
});
