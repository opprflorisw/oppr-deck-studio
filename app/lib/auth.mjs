// Who is asking (Deck Studio cloud).
//
// Until now the app had no concept of a caller: it was one person on localhost,
// and the secret key was the whole permission model. Now every /api request must
// carry a Supabase session token, and this module turns that token into a member
// or into a refusal.
//
// The check is done against Supabase itself (`/auth/v1/user`), not by decoding
// the JWT locally, so a revoked or expired session stops working immediately
// rather than at token expiry. Results are cached briefly because the editor
// makes bursts of calls and every one would otherwise be a round trip.

import { supabaseUrl, anonKey, secretKey } from "./env.mjs";

const TTL_MS = 30_000;
const cache = new Map(); // token -> { at, member }

function rest(path, token, extra = {}) {
  return fetch(`${supabaseUrl()}${path}`, {
    ...extra,
    headers: {
      apikey: anonKey() || secretKey(),
      Authorization: `Bearer ${token}`,
      ...(extra.headers || {}),
    },
  });
}

// Resolve a bearer token to { id, email, role, disabled, token } or null.
export async function memberFor(token) {
  if (!token) return null;
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.member;

  let member = null;
  try {
    const r = await rest("/auth/v1/user", token);
    if (r.ok) {
      const user = await r.json();
      const email = String(user?.email || "").toLowerCase();
      // Belt and braces. The database refuses to create a non-@oppr.ai account
      // at all, so this should be unreachable — which is exactly why it is here:
      // if it ever fires, the gate below it has failed.
      if (user?.id && email.endsWith("@oppr.ai")) {
        const p = await rest(
          `/rest/v1/profiles?id=eq.${user.id}&select=id,email,full_name,role,disabled`,
          token,
        );
        const rows = p.ok ? await p.json() : [];
        const profile = rows[0];
        if (profile && !profile.disabled) {
          member = { ...profile, token };
        }
      }
    }
  } catch {
    member = null;
  }

  cache.set(token, { at: Date.now(), member });
  if (cache.size > 200) cache.clear();
  return member;
}

export const COOKIE = "oppr_sess";

export function bearerFrom(req) {
  const h = req.headers?.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  // Fall back to the session cookie.
  //
  // This is not a convenience: an <img src="/repo/...">, an <iframe> and a
  // download link cannot carry an Authorization header, so subresources would be
  // the one unauthenticated hole in an otherwise gated app. Browsers do send
  // cookies on those requests, so the cookie is what protects /repo and
  // /deck-cache. HttpOnly, so page scripts cannot read it.
  return cookieFrom(req, COOKIE);
}

export function cookieFrom(req, name) {
  const raw = req.headers?.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

// SameSite=Strict: this app is never embedded elsewhere and has no cross-site
// flow, so there is no reason to send the session anywhere but here.
export function sessionCookie(token, secure) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=604800",
  ];
  if (secure) bits.push("Secure");
  return bits.join("; ");
}

export function clearedCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export const canWrite = (m) => Boolean(m) && (m.role === "owner" || m.role === "editor");
export const isOwner = (m) => Boolean(m) && m.role === "owner";

// Record an action. Never throws: an audit write must not be able to fail the
// operation it is describing, but a silent gap would be worse than a noisy one,
// so failures are logged to the server console.
export async function audit(member, action, deckId = null, detail = {}) {
  if (!member) return;
  try {
    const r = await fetch(`${supabaseUrl()}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        apikey: secretKey(),
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        actor_id: member.id,
        actor_email: member.email,
        action,
        deck_id: deckId,
        detail,
      }),
    });
    if (!r.ok) process.stderr.write(`audit ${action} failed: ${r.status}\n`);
  } catch (e) {
    process.stderr.write(`audit ${action} failed: ${e.message}\n`);
  }
}

// Touch last_seen_at, at most once a minute per member, so the Accounts page can
// show who is actually using this.
const seen = new Map();
export async function touch(member) {
  if (!member) return;
  const last = seen.get(member.id) || 0;
  if (Date.now() - last < 60_000) return;
  seen.set(member.id, Date.now());
  try {
    await fetch(`${supabaseUrl()}/rest/v1/profiles?id=eq.${member.id}`, {
      method: "PATCH",
      headers: {
        apikey: secretKey(),
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
    });
  } catch { /* not worth failing a request over */ }
}
