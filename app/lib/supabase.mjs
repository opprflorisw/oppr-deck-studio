// Supabase client for the agent (Deck Studio v3). PostgREST + Storage over the
// SECRET key, so it bypasses RLS. Server-side ONLY: this module and its key
// never reach the browser (the front end talks only to the agent — proxy-only).

import { env } from "./env.mjs";

const BUCKET = "deck-files";

function cfg() {
  const e = env();
  if (!e.SUPABASE_URL || !e.SUPABASE_SECRET_KEY) {
    throw new Error("supabase-not-configured");
  }
  return { url: e.SUPABASE_URL.replace(/\/$/, ""), key: e.SUPABASE_SECRET_KEY };
}

function headers(extra = {}) {
  const { key } = cfg();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

// --- PostgREST ---------------------------------------------------------------

export async function select(table, params = {}) {
  const { url } = cfg();
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`${url}/rest/v1/${table}?${qs}`, { headers: headers() });
  if (!r.ok) throw new Error(`select ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// PostgREST caps a response at the project's "Max rows" (1000 by default) and
// says NOTHING when it truncates: a short read is indistinguishable from a small
// table. Every list that can grow past that has to page, and the lesson was
// learned the expensive way -- collide.mjs, whose whole job is to not be wrong
// about which decks a name would break, was the first to need it. It lived there
// alone while /api/decks, /api/slide-usage, the customer counts and the MCP
// listings all read unpaged. Same fix, one place.
const PAGE = 500;

export async function selectAll(table, params = {}) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const page = await select(table, { ...params, offset: String(from), limit: String(PAGE) });
    out.push(...page);
    // A short page is the end. Trusting a count would need a second round trip
    // that could itself be stale.
    if (page.length < PAGE) return out;
  }
}

// Call a Postgres function. Used for the things that must happen as one unit --
// publishing a version, creating a deck with its v1 -- because two HTTP calls
// have nothing holding them together, and a failure between them leaves a deck
// pointing at a version that does not exist.
export async function rpc(fn, args = {}) {
  const { url } = cfg();
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function insert(table, rows) {
  const { url } = cfg();
  const r = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`insert ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// `match` takes RAW values; the `eq.` is added here. Passing an already-prefixed
// value ("eq.3", "in.(a,b)") yields `eq.eq.3`, which matches no rows and returns
// 200 -- a silent no-op that reads exactly like success. The Python client grew
// an operator passthrough after being bitten by that; this one refuses instead,
// because a filter that means two different things depending on how you spell it
// is worse than one that only accepts one spelling.
export async function update(table, match, values) {
  const { url } = cfg();
  for (const [k, v] of Object.entries(match)) {
    if (typeof v === "string" && /^(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|not)\./.test(v)) {
      throw new Error(
        `update ${table}: match.${k} is "${v}", but match values are raw -- ` +
        `the eq. is added for you. As written this asks for ${k}=eq.${v}, which matches nothing.`);
    }
  }
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(match).map(([k, v]) => [k, `eq.${v}`]))
  ).toString();
  const r = await fetch(`${url}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(values),
  });
  if (!r.ok) throw new Error(`update ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function del(table, match) {
  const { url } = cfg();
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(match).map(([k, v]) => [k, `eq.${v}`]))
  ).toString();
  const r = await fetch(`${url}/rest/v1/${table}?${qs}`, { method: "DELETE", headers: headers() });
  if (!r.ok) throw new Error(`delete ${table}: ${r.status} ${await r.text()}`);
}

export async function upsert(table, rows, onConflict) {
  const { url } = cfg();
  const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// --- Storage -----------------------------------------------------------------

export async function upload(objectPath, buffer, contentType = "application/octet-stream") {
  const { url } = cfg();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "true" }),
    body: buffer,
  });
  if (!r.ok) throw new Error(`upload ${objectPath}: ${r.status} ${await r.text()}`);
  return objectPath;
}

export async function download(objectPath) {
  const { url } = cfg();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, { headers: headers() });
  // The status rides on the error. A caller that has to tell "this object is not
  // there" from "the request did not get through" cannot do it from a message,
  // and treating the second as the first is how a failed read turns into a
  // silently different document.
  if (!r.ok) {
    const e = new Error(`download ${objectPath}: ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return Buffer.from(await r.arrayBuffer());
}

// One level of a Storage "directory". Storage has no directories, so a prefix
// ending in "/" is the closest thing: entries with a null id are the synthetic
// folder rows Storage returns for deeper keys, and are reported as such.
export async function list(prefix, limit = 1000) {
  const { url } = cfg();
  const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefix, limit, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!r.ok) throw new Error(`list ${prefix}: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return rows.map((e) => ({ name: e.name, isFolder: e.id === null }));
}

export async function copyObject(src, dst) {
  const { url } = cfg();
  const r = await fetch(`${url}/storage/v1/object/copy`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ bucketId: BUCKET, sourceKey: src, destinationKey: dst }),
  });
  if (!r.ok) throw new Error(`copy ${src}->${dst}: ${r.status} ${await r.text()}`);
}

export const CONTENT_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".pdf": "application/pdf",
};
