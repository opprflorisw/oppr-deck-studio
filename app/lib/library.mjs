// The library mirror.
//
// The repo is the source of truth for slides; the hosted app has no repo on
// disk, so it reads a derived mirror in Supabase. This keeps the two in step.
//
// Ported from tools/check-drift.py --sync as part of the one-runtime move
// (Deck Studio 5, D1). Two rules survive the port unchanged, because both were
// learned rather than designed:
//
//   * A sync writes only the REPO-owned columns. `archived` belongs to the app —
//     someone demoted the slide in the picker — and a sync that overwrote it
//     would silently un-archive a slide somebody deliberately removed from the
//     picker. Making an archive durable in git is a separate, deliberate step.
//
//   * A slide's required clearances are derived from the images it actually
//     references, using the SAME manifest key the verify gate derives, not from
//     the single `entitlement` label in meta.yaml. A slide may name images from
//     more than one customer and every one has to be cleared. This is what lets
//     the builder grey a slide out while you are picking, instead of failing a
//     build forty seconds later.

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import * as db from "./supabase.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SLIDES = path.join(REPO, "library", "slides");

/** The content hash a published recipe records, so drift is a comparison. */
export function slideHash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

// meta.yaml's top level is plain `key: value`, and bringing a YAML parser into
// the app for that would be a dependency it does not otherwise have. Lists are
// read in the one shape the library uses.
function readMeta(text) {
  const out = {};
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([a-z_]+):[ \t]*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, key, rawValue] = m;
    let value = rawValue.trim();
    if (value === "") {
      // a block list, or an empty value
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(lines[++i].replace(/^\s*-\s+/, "").trim().replace(/^['"]|['"]$/g, ""));
      }
      out[key] = items.length ? items : "";
      continue;
    }
    if (/^\[.*\]$/.test(value)) {
      out[key] = value.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      continue;
    }
    value = value.replace(/^['"]|['"]$/g, "");
    out[key] = value === "true" ? true : value === "false" ? false : value;
  }
  return out;
}

/** Chapter blocks from library/chapters.yaml: id, n, title, purpose, slides[]. */
export function readChapters(text) {
  const out = [];
  let cur = null;
  let inSlides = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const id = /^-\s+id:\s*(\S+)/.exec(line);
    if (id) { cur = { id: id[1], n: "", title: "", purpose: "", slides: [] }; out.push(cur); inSlides = false; continue; }
    if (!cur) continue;
    const kv = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) {
      const [, k, v] = kv;
      inSlides = k === "slides";
      if (!inSlides) cur[k] = v.trim().replace(/^['"]|['"]$/g, "");
      continue;
    }
    const item = /^\s+-\s+(\S+)\s*$/.exec(line);
    if (item && inSlides) cur.slides.push(item[1]);
  }
  return out;
}

/**
 * Which clearances a slide needs before a deck may carry it.
 *
 * Empty = safe in a public deck.
 */
export function requiredEntitlements(html, meta, imgEntitlement) {
  const need = new Set();
  const own = meta.entitlement;
  if (own && own !== "public") need.add(own);
  for (const m of String(html).matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const norm = m[1].replace(/\\/g, "/");
    if (!norm.includes("brand/img/")) continue;
    const key = norm.split("brand/img/")[1];
    const ent = imgEntitlement[key] || "public";
    if (ent && ent !== "public") need.add(ent);
  }
  return [...need].sort();
}

async function readLibrary() {
  const manifest = JSON.parse(
    await fsp.readFile(path.join(REPO, "brand", "img", "library.json"), "utf-8"));
  const imgEnt = {};
  for (const im of manifest.images || []) imgEnt[im.file] = im.entitlement || "public";

  const slides = [];
  for (const id of (await fsp.readdir(SLIDES)).sort()) {
    const dir = path.join(SLIDES, id);
    const metaPath = path.join(dir, "meta.yaml");
    const htmlPath = path.join(dir, "slide.html");
    if (!fs.existsSync(metaPath) || !fs.existsSync(htmlPath)) continue;
    const meta = readMeta(await fsp.readFile(metaPath, "utf-8"));
    const html = await fsp.readFile(htmlPath, "utf-8");
    slides.push({
      slide_id: id,
      content_hash: slideHash(await fsp.readFile(htmlPath)),
      chapter: meta.chapter || null,
      role: meta.role || "",
      title: meta.title || "",
      retired: Boolean(meta.retired),
      goal: meta.goal || null,
      entitlements: requiredEntitlements(html, meta, imgEnt),
    });
  }

  const chapters = readChapters(
    await fsp.readFile(path.join(REPO, "library", "chapters.yaml"), "utf-8"));

  return { slides, chapters };
}

/**
 * Mirror library/ into the backend.
 *
 * `check: true` reports what differs and writes nothing — the mode that belongs
 * in CI, because forgetting this sync is invisible: the hosted builder serves
 * the old fragment while the drift flag reports everything current, since the
 * flag compares against the very mirror that did not update.
 */
export async function syncLibrary({ check = false } = {}) {
  const { slides, chapters } = await readLibrary();

  if (check) {
    const have = new Map((await db.selectAll("library_slides",
      { select: "slide_id,content_hash,chapter,retired" })).map((r) => [r.slide_id, r]));
    const stale = [];
    for (const s of slides) {
      const cur = have.get(s.slide_id);
      if (!cur) stale.push(`${s.slide_id}: not in the mirror`);
      else if (cur.content_hash !== s.content_hash) stale.push(`${s.slide_id}: content changed`);
      else if ((cur.chapter || null) !== (s.chapter || null)) stale.push(`${s.slide_id}: moved chapter`);
      else if (Boolean(cur.retired) !== s.retired) stale.push(`${s.slide_id}: retired flag differs`);
    }
    for (const id of have.keys()) {
      if (!slides.some((s) => s.slide_id === id)) stale.push(`${id}: in the mirror, not in the repo`);
    }
    return { stale, slides: slides.length, chapters: chapters.length };
  }

  await db.upsert("library_slides", slides, "slide_id");
  await db.upsert("library_chapters", chapters.map((ch) => ({
    id: ch.id, n: String(ch.n || ""), title: ch.title,
    purpose: ch.purpose || "", slides: ch.slides,
  })), "id");

  const archived = await db.selectAll("library_slides",
    { select: "slide_id", archived: "is.true" });
  return {
    slides: slides.length,
    chapters: chapters.length,
    live: slides.filter((s) => !s.retired).length,
    archivedInApp: archived.length,
    archivedBack: 0,
  };
}

/** Which published decks are behind the library, and by how many pages. */
export async function drift() {
  const [libRows, decks, versions] = await Promise.all([
    db.selectAll("library_slides", { select: "slide_id,content_hash" }),
    db.selectAll("decks", { select: "id,slug,title,current_version_n,archived" }),
    db.selectAll("deck_versions", { select: "deck_id,n,recipe" }),
  ]);
  const libHash = new Map(libRows.map((r) => [r.slide_id, r.content_hash]));
  const byDeck = new Map();
  for (const v of versions) byDeck.set(`${v.deck_id}:${v.n}`, v.recipe);

  const out = [];
  for (const d of decks) {
    if (d.archived || !d.current_version_n) continue;
    const recipe = byDeck.get(`${d.id}:${d.current_version_n}`);
    if (!recipe?.chapters) continue;   // published before recipes: no honest answer
    const behind = [];
    for (const ch of recipe.chapters) {
      for (const s of ch.slides || []) {
        const now = libHash.get(s.slide_id);
        if (now === undefined) behind.push({ slide_id: s.slide_id, why: "no longer in the library" });
        else if (now !== s.content_hash) behind.push({ slide_id: s.slide_id, why: "content changed" });
      }
    }
    if (behind.length) out.push({ slug: d.slug, title: d.title, behind });
  }
  return out;
}
