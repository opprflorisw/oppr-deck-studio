// Accounts, from the command line.
//
// The break-glass path: when nobody can sign in, the Accounts page cannot help,
// because reaching it requires an account. This needs only the service key.
//
// Ported from tools/manage-users.py. The rules it enforces are the database's,
// not this file's — @oppr.ai and invitation-only are triggers on auth.users, so
// a bug here cannot let someone in who should not be.

import crypto from "node:crypto";
import { env, supabaseUrl } from "./env.mjs";
import * as db from "./supabase.mjs";

const ROLES = new Set(["owner", "editor", "viewer"]);

function adminHeaders() {
  const key = env().SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function admin(pathname, init = {}) {
  const r = await fetch(`${supabaseUrl()}/auth/v1${pathname}`, { ...init, headers: adminHeaders() });
  const body = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

// An unambiguous alphabet: no l/1/I, no O/0. A first password is read off a
// screen and typed by someone else, and "was that an ell or a one" is a support
// call.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function suggestPassword(len = 16) {
  const bytes = crypto.randomBytes(len * 2);
  let out = "";
  for (let i = 0; out.length < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function listAccounts() {
  const profiles = await db.selectAll("profiles",
    { select: "id,email,full_name,role,disabled,created_at,last_seen_at", order: "email.asc" });
  return profiles;
}

/**
 * Create an account.
 *
 * The invitation is written FIRST, because a trigger on auth.users refuses any
 * address that is not invited, and consumed by the trigger that writes the
 * profile — which is what makes an invitation single-use. If the user creation
 * then fails, the invitation is revoked rather than left as a standing
 * permission nobody remembers granting.
 */
export async function addAccount({ email, fullName = "", role = "editor", password = "" }) {
  const addr = String(email || "").trim().toLowerCase();
  if (!addr.endsWith("@oppr.ai")) throw new Error("Deck Studio accounts are @oppr.ai only");
  if (!ROLES.has(role)) throw new Error(`role must be one of: ${[...ROLES].join(", ")}`);
  const pw = password || suggestPassword();
  if (pw.length < 8) throw new Error("a password must be at least 8 characters");

  await db.upsert("invited_emails", [{ email: addr }], "email");
  let user;
  try {
    user = await admin("/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: addr, password: pw, email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {},
      }),
    });
  } catch (e) {
    await db.del("invited_emails", { email: addr }).catch(() => {});
    throw e;
  }

  if (role !== "editor" || fullName) {
    await db.update("profiles", { id: user.id },
      { ...(role !== "editor" ? { role } : {}), ...(fullName ? { full_name: fullName } : {}) });
  }
  return { id: user.id, email: addr, role, password: pw };
}

export async function setPassword(email, password = "") {
  const addr = String(email || "").trim().toLowerCase();
  const [profile] = await db.select("profiles", { email: `eq.${addr}`, select: "id" });
  if (!profile) throw new Error(`no account for ${addr}`);
  const pw = password || suggestPassword();
  if (pw.length < 8) throw new Error("a password must be at least 8 characters");
  await admin(`/admin/users/${profile.id}`, { method: "PUT", body: JSON.stringify({ password: pw }) });
  return { email: addr, password: pw };
}

export async function setRole(email, role) {
  if (!ROLES.has(role)) throw new Error(`role must be one of: ${[...ROLES].join(", ")}`);
  const addr = String(email || "").trim().toLowerCase();
  const rows = await db.update("profiles", { email: addr }, { role });
  if (!rows.length) throw new Error(`no account for ${addr}`);
  return rows[0];
}

export async function setDisabled(email, disabled) {
  const addr = String(email || "").trim().toLowerCase();
  const rows = await db.update("profiles", { email: addr }, { disabled });
  if (!rows.length) throw new Error(`no account for ${addr}`);
  return rows[0];
}

/** The `studio users ...` subcommand, kept here so the CLI stays a thin shell. */
export async function usersCommand(positional, flags, io) {
  const { say, die, green, dim, yellow } = io;
  const [sub, ...rest] = positional;

  if (!sub || sub === "list") {
    const rows = await listAccounts();
    if (!rows.length) return say("no accounts yet");
    const w = Math.max(...rows.map((r) => r.email.length));
    for (const r of rows) {
      const flagsText = [r.role, r.disabled ? yellow("no access") : "",
                         r.last_seen_at ? dim(`seen ${String(r.last_seen_at).slice(0, 10)}`) : dim("never signed in")]
        .filter(Boolean).join("  ");
      say(`  ${r.email.padEnd(w)}  ${flagsText}`);
    }
    return;
  }

  if (sub === "add") {
    const email = rest[0];
    if (!email) return die("studio users add <email> [--name N] [--role owner|editor|viewer]");
    const made = await addAccount({
      email, fullName: typeof flags.name === "string" ? flags.name : "",
      role: typeof flags.role === "string" ? flags.role : "editor",
      password: typeof flags.password === "string" ? flags.password : "",
    });
    say(`${green("created")} ${made.email} (${made.role})`);
    say(`  first password: ${made.password}`);
    say(dim("  They should change it after signing in (Accounts -> Your password)."));
    return;
  }

  if (sub === "password") {
    const email = rest[0];
    if (!email) return die("studio users password <email>");
    const r = await setPassword(email, typeof flags.password === "string" ? flags.password : "");
    say(`${green("reset")} ${r.email}`);
    say(`  new password: ${r.password}`);
    return;
  }

  if (sub === "role") {
    const [email, role] = rest;
    if (!email || !role) return die("studio users role <email> <owner|editor|viewer>");
    const r = await setRole(email, role);
    say(`${green("updated")} ${r.email} is now ${r.role}`);
    return;
  }

  if (sub === "disable" || sub === "enable") {
    const email = rest[0];
    if (!email) return die(`studio users ${sub} <email>`);
    const r = await setDisabled(email, sub === "disable");
    say(`${green("updated")} ${r.email} ${r.disabled ? "can no longer sign in" : "can sign in again"}`);
    return;
  }

  die(`no users subcommand "${sub}". Try: list, add, password, role, disable, enable`);
}
