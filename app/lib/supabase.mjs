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

export async function update(table, match, values) {
  const { url } = cfg();
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
  if (!r.ok) throw new Error(`download ${objectPath}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
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
