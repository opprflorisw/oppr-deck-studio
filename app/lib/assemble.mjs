// The assembler, in JavaScript (Deck Studio cloud).
//
// `tools/deckstudio.py` + `tools/snapshot.py` are the CLI's assembler and stay
// the reference. This is the same transform for the recipe path, so it can run
// where there is no Python — which is what lets you compose a deck from the
// hosted app instead of only from this laptop.
//
// It is a deliberate port, not a reimplementation: same wrapper, same order of
// operations, same slot sentinels, same asset naming and dedup, same recipe
// schema. `tools/check-assemble-parity.py` builds the same recipe through both
// and diffs the result, so they cannot drift apart silently. If you change the
// transform, change it in both and run that check.
//
// The one honest difference is the deck-meta manifest's `tool` and `published`
// fields: one says which assembler ran, the other is today's date. The parity
// check normalises exactly those two and nothing else.

import crypto from "node:crypto";
import path from "node:path";

import { RepoFiles } from "./repofiles.mjs";

// --- the document wrapper (deckstudio._WRAPPER, verbatim) --------------------

const WRAPPER = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{deck_title}}</title>
<link rel="stylesheet" href="{{asset}}templates/deck.css">
<link rel="stylesheet" href="{{asset}}templates/showcase.css">
</head>
<body>
<div class="deck">

{body}

</div>
</body>
</html>
`;

const PLACEHOLDER_RE = /\{\{\s*([\w-]+)\s*\}\}/g;
const ICON_RE = /\{\{\s*icon:([\w-]+)\s*\}\}/g;

// Private-use sentinels that bracket a slot value through assembly, then become
// <span data-slot="..."> spans. Must match snapshot.py S1/S2/S3.
const S1 = "", S2 = "", S3 = "";
const SLOT_VARS = {
  deck_footer: "footer-meta",
  cover_meta: "cover-meta",
  client: "client",
  prepared_for: "prepared-for",
};

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const FONT_EXT = new Set([".woff2", ".woff", ".ttf"]);

const CTYPE = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};
const ctypeFor = (name) => CTYPE[path.posix.extname(name).toLowerCase()] || "application/octet-stream";

// --- small helpers -----------------------------------------------------------

// Python's str.replace swaps EVERY occurrence and treats the replacement as a
// literal. JS's String.replace(str, str) does neither, so split/join is the
// faithful one: `$&` in a footer would otherwise be read as a backreference.
function fill(text, variables) {
  let out = text;
  for (const [k, v] of Object.entries(variables)) out = out.split(`{{${k}}}`).join(String(v));
  return out;
}

function unfilled(text) {
  const found = new Set();
  for (const m of String(text).matchAll(PLACEHOLDER_RE)) found.add(m[1]);
  return [...found].sort();
}

export function slugify(s) {
  return String(s ?? "").toLowerCase().replace(/[^\w\s-]/g, "").trim()
    .replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// Python's json.dumps default separators are ", " and ": "; JSON.stringify uses
// neither. The deck-meta block is compared byte for byte by the parity check, so
// it is serialised the way the reference does it.
function pyJson(value) {
  const enc = (v) => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(enc).join(", ")}]`;
    return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${enc(x)}`).join(", ")}}`;
  };
  return enc(value);
}

// A repo-relative POSIX path for `ref` resolved against `fromDir` (also
// repo-relative). Returns null if it climbs out of the repo.
function resolveRel(fromDir, ref) {
  const joined = path.posix.normalize(path.posix.join(fromDir, ref));
  if (joined.startsWith("..") || path.posix.isAbsolute(joined)) return null;
  return joined;
}

// Minimal top-level scalar reader for the one key we need out of meta.yaml
// (`role`). Bringing a YAML parser in for that would be a dependency the app
// does not otherwise have, and meta.yaml's top level is plain `key: value`.
function yamlScalar(text, key) {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(String(text || ""));
  if (!m) return "";
  return m[1].trim().replace(/^['"]|['"]$/g, "");
}

/** Chapter ids, in the order library/chapters.yaml declares them. */
export function chapterOrder(text) {
  return [...String(text || "").matchAll(/^- id:[ \t]*(\S+)[ \t]*$/gm)].map((m) => m[1]);
}

// --- the PDF filename (deckstudio.pdf_name, for a decks/<slug> folder) -------

const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})[_-](.+)$/;

export function pdfNameForSlug(slug, client = "") {
  const m = DATE_PREFIX_RE.exec(slug);
  const date = m ? m[1] : "";
  const core = slugify(m ? m[2] : slug);
  const cl = client ? slugify(client) : "";
  const parts = [];
  if (date) parts.push(date);
  parts.push("oppr");
  if (core && core !== "oppr") parts.push(core);
  if (cl && !parts.join("-").includes(cl)) parts.push(cl);
  return parts.join("_") + ".pdf";
}

// --- compose: a recipe becomes the deck ------------------------------------

/**
 * The recipe's chapter picks become an ordered slide list.
 *
 * Chapter order SEEDS the deck; it does not constrain it. An explicit `order`
 * is the deck as it will actually read, and anything picked but missing from it
 * is appended in chapter order rather than silently dropped. Mirrors
 * build-from-recipe.compose().
 */
export function composeSlides(recipe, order) {
  const picks = recipe.chapters || {};
  const unknown = Object.keys(picks).filter((c) => !order.includes(c));
  if (unknown.length) throw new Error(`unknown chapter(s): ${unknown.join(", ")}`);

  const seeded = [];
  for (const cid of order) if (cid in picks) seeded.push(...picks[cid]);
  const explicit = (recipe.order || []).filter((s) => seeded.includes(s));
  const slides = [...explicit, ...seeded.filter((s) => !explicit.includes(s))];
  if (!slides.length) throw new Error("the recipe picks no slides");

  const deck = {
    title: recipe.title,
    type: recipe.type || "",
    chapters: Object.fromEntries(order.filter((c) => c in picks).map((c) => [c, picks[c]])),
    vars: recipe.vars || {},
    slides,
  };
  if (recipe.client) deck.client = recipe.client;
  if (recipe.allowed_entitlements) deck.allowed_entitlements = recipe.allowed_entitlements;
  return deck;
}

// --- the recipe written to deck_versions.recipe (snapshot.build_recipe) ------

function buildRecipe(deck, slideMeta) {
  const byId = Object.fromEntries(slideMeta.map((s) => [s.id, s]));
  const chapters = deck.chapters || {};
  const blocks = Object.keys(chapters).length
    ? Object.entries(chapters).map(([cid, picks]) => ({
        id: cid,
        slides: picks.filter((sid) => sid in byId)
          .map((sid) => ({ slide_id: sid, content_hash: byId[sid].hash })),
      }))
    : [{ id: null, slides: slideMeta.map((s) => ({ slide_id: s.id, content_hash: s.hash })) }];
  return {
    schema: 2,
    type: deck.type || "",
    client: deck.client || "",
    allowed_entitlements: [...(deck.allowed_entitlements || ["public"])],
    chapters: blocks,
    order: slideMeta.map((s) => s.id),
    vars: { ...(deck.vars || {}) },
  };
}

// --- the snapshot ------------------------------------------------------------

/**
 * Assemble a composed deck into a self-contained snapshot.
 *
 * Returns { html, assets, recipe, slideMeta } where assets is
 * {filename: {bytes, source, entitlement, sha256, content_type}} — the same
 * shape publish-deck.py uploads.
 *
 * `slug` stands in for the deck folder the CLI would have written: a deck is
 * assembled at decks/<slug>/, which is what makes {{asset}} resolve to "../../".
 */
export async function buildSnapshot(deck, slug, { files = new RepoFiles(), tool = "app/lib/assemble.mjs" } = {}) {
  const deckDir = `decks/${slug}`;                 // repo-relative, 2 deep
  const assetPrefix = "../../";
  const slides = deck.slides;

  // The image manifest carries entitlement per file; a deck may only carry
  // images cleared for it, and verify FAILs on a leak. Assembly records what
  // each asset is so the gate has something to check.
  let ent = {};
  const manifest = await files.text("brand/img/library.json");
  if (manifest) {
    try {
      for (const m of (JSON.parse(manifest).images || [])) ent[m.file] = m.entitlement || "public";
    } catch { ent = {}; }
  }

  const assets = {};   // filename -> {bytes, source, entitlement, sha256, content_type}

  const bundle = async (rel, preferName = null) => {
    if (!rel) return null;
    const data = await files.bytes(rel);
    if (data === null) return null;
    const sha = sha256(data);
    for (const [fn, meta] of Object.entries(assets)) {
      if (meta.sha256 === sha) return `assets/${fn}`;      // dedup by content
    }
    let name = preferName || path.posix.basename(rel);
    const extn = path.posix.extname(name);
    const base = name.slice(0, name.length - extn.length);
    let n = 1;
    while (name in assets) { n += 1; name = `${base}_${n}${extn}`; }
    const entitlement = rel.includes("brand/img/")
      ? (ent[rel.split("brand/img/")[1]] ?? "public")
      : "public";
    assets[name] = { bytes: data, source: rel, entitlement, sha256: sha, content_type: ctypeFor(name) };
    return `assets/${name}`;
  };

  // 1. variables, with slot sentinels for the personalization vars
  const variables = { ...deck.vars };
  variables.deck_title = deck.title;
  variables.total = String(slides.length);
  variables.asset = assetPrefix;
  for (const [v, slot] of Object.entries(SLOT_VARS)) {
    if (v in variables && String(variables[v]) !== "") {
      variables[v] = `${S1}${slot}${S2}${variables[v]}${S3}`;
    }
  }

  // 2. blocks, each fragment tagged with its slide id and role
  const slideMeta = [];
  const blocks = [];
  for (let i = 0; i < slides.length; i++) {
    const sid = slides[i];
    const raw = await files.text(`library/slides/${sid}/slide.html`);
    if (raw === null) throw new Error(`slide not found: ${sid}`);
    // snapshot.py treats a missing meta.yaml as role "". Here it is an error,
    // and deliberately so: every one of the 48 library slides has one (a folder
    // without it is not indexed as a slide at all), so "absent" hosted means the
    // library is not fully mirrored — and role is what the verify gate checks
    // footer discipline against. A wrong role builds a deck that looks right and
    // is not. If a slide ever genuinely ships without meta.yaml, the parity
    // check is what will say so.
    const metaText = await files.text(`library/slides/${sid}/meta.yaml`);
    if (metaText === null) throw new Error(`slide '${sid}' has no meta.yaml, so its role is unknown`);
    const role = yamlScalar(metaText, "role");
    const bytes = await files.bytes(`library/slides/${sid}/slide.html`);
    slideMeta.push({ id: sid, role, hash: sha256(bytes).slice(0, 16) });
    const fragment = raw.replace(/\n+$/, "")
      .replace(/<section\b/, `<section data-slide-id="${sid}" data-role="${role}"`);
    blocks.push(`<!-- ${String(i + 1).padStart(2, "0")} · ${sid} -->\n${fragment}`);
  }

  let document = WRAPPER.replace("{body}", blocks.join("\n\n"));
  document = await inlineIcons(document, files);
  document = fill(document, variables);

  const missing = unfilled(document);
  if (missing.length) {
    throw new Error(`unfilled variables in '${deck.type || ""}': ${missing.join(", ")}. `
      + "Every {{placeholder}} must be provided in the recipe's vars.");
  }

  // 3. the two stylesheet links become inlined <style> blocks
  for (const css of ["deck.css", "showcase.css"]) {
    const block = await inlineCss(css, files, bundle);
    const re = new RegExp(`<link rel="stylesheet" href="[^"]*templates/${css.replace(".", "\\.")}">`);
    document = document.replace(re, () => block);
  }

  // 4. bundle every referenced image/font and rewrite src/href/url()
  document = await replaceAsync(document, /(src|href)="([^"]+)"/g, async (m, attr, val) => {
    const ref = await resolveAsset(val, deckDir, bundle);
    return ref ? `${attr}="${ref}"` : m;
  });
  document = await replaceAsync(document, /url\(([^)]+)\)/g, async (m, raw) => {
    const val = raw.trim().replace(/^["']|["']$/g, "");
    if (val.startsWith("assets/") || val.startsWith("data:")) return m;
    const ref = await resolveAsset(val, deckDir, bundle);
    return ref ? `url("${ref}")` : m;
  });

  // 5. slot spans
  document = document.replace(
    new RegExp(`${S1}([\\s\\S]*?)${S2}([\\s\\S]*?)${S3}`, "g"),
    (m, slot, value) => `<span data-slot="${slot}">${value}</span>`);

  // 6. the deck-meta manifest before </head>
  const meta = {
    schema: 1,
    title: deck.title,
    type: deck.type || "",
    client: deck.client || "",
    allowed_entitlements: [...(deck.allowed_entitlements || ["public"])],
    slides: slideMeta,
    assets: Object.fromEntries(Object.entries(assets)
      .map(([fn, a]) => [fn, { source: a.source, entitlement: a.entitlement }])),
    published: new Date().toISOString().slice(0, 10),
    tool,
  };
  const metaBlock = '<script type="application/json" id="deck-meta">\n' + pyJson(meta) + "\n</script>\n";
  document = document.replace("</head>", () => metaBlock + "</head>");

  return { html: document, assets, recipe: buildRecipe(deck, slideMeta), slideMeta };
}

// --- pieces ------------------------------------------------------------------

async function inlineIcons(text, files) {
  return replaceAsync(text, ICON_RE, async (m, name) => {
    const svg = await files.text(`library/icons/${name}.svg`);
    if (svg === null) {
      throw new Error(`unknown icon '${name}' ({{icon:${name}}}); see library/icons/ for the set.`);
    }
    return svg.trim();
  });
}

async function inlineCss(name, files, bundle) {
  const css = await files.mustText(`templates/${name}`, "stylesheet");
  const rewritten = await replaceAsync(css, /url\(([^)]+)\)/g, async (m, raw) => {
    const val = raw.trim().replace(/^["']|["']$/g, "");
    if (val.startsWith("data:") || val.startsWith("assets/")) return m;
    const ref = await bundle(resolveRel("templates", val));
    return ref ? `url("${ref}")` : m;
  });
  return `<style data-inlined="${name}">\n${rewritten}\n</style>`;
}

async function resolveAsset(val, deckDir, bundle) {
  if (/^(assets\/|data:|http:|https:|#|mailto:)/.test(val)) return null;
  const ext = path.posix.extname(val.split("?")[0]).toLowerCase();
  if (!IMG_EXT.has(ext) && !FONT_EXT.has(ext)) return null;
  return bundle(resolveRel(deckDir, val));
}

// String.replace cannot await, and the replacements here read files. Collect the
// matches first, resolve them, then splice — which also keeps the replacement
// literal, so a `$&` inside a bundled filename cannot be re-interpreted.
async function replaceAsync(text, re, fn) {
  const matches = [...text.matchAll(re)];
  if (!matches.length) return text;
  const values = [];
  for (const m of matches) values.push(await fn(...m));
  let out = "", last = 0;
  matches.forEach((m, i) => {
    out += text.slice(last, m.index) + values[i];
    last = m.index + m[0].length;
  });
  return out + text.slice(last);
}
