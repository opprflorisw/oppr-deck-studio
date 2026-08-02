// Tiny .env reader for the agent (Deck Studio v3). Real values live only in
// .env (gitignored); nothing committed carries a key. Split on the first '=',
// skip blank / comment lines. The real process environment wins over the file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url)); // app/lib
const REPO_ROOT = path.resolve(APP_DIR, "..", "..");

let _cache = null;

export function env() {
  if (_cache) return _cache;
  const out = {};
  try {
    const txt = fs.readFileSync(path.join(REPO_ROOT, ".env"), "utf-8");
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  } catch {}
  for (const k of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_ANON_KEY"]) {
    if (process.env[k]) out[k] = process.env[k];
  }
  _cache = out;
  return out;
}

export function supabaseConfigured() {
  const e = env();
  return Boolean(e.SUPABASE_URL && e.SUPABASE_SECRET_KEY);
}

export const supabaseUrl = () => (env().SUPABASE_URL || "").replace(/\/$/, "");
export const secretKey = () => env().SUPABASE_SECRET_KEY || "";

// PUBLIC by definition: it ships to the browser so the login screen can talk to
// Supabase Auth. It can read nothing without a signed-in @oppr.ai user — every
// RLS policy grants to `authenticated` only, never to `anon`.
export const anonKey = () => env().SUPABASE_ANON_KEY || "";
