// Signing in (Deck Studio cloud).
//
// Email and password, against Supabase Auth. This replaced email magic links
// (2026-08-03): a link is one round trip through an inbox for every sign-in, it
// is single-use so a second click reads as "broken", and the email rate limit
// locks you out of your own tool for an hour. A password is typed once and the
// session then lasts a week.
//
// Accounts are still not self-serve. Only @oppr.ai addresses can exist at all
// (the database refuses any other), and an owner creates each one with its first
// password, on the Accounts page or with `python tools\manage-users.py`.
//
// The session token lives in localStorage and rides on every /api call as an
// Authorization header. The server resolves it to a member on each request.

import { el, esc } from "./util.js";

const KEY = "oppr.session";

let config = null;   // { supabase_url, anon_key, domain }
let session = null;  // { access_token, refresh_token, expires_at }
let member = null;   // { id, email, full_name, role }

export const currentMember = () => member;
export const token = () => session?.access_token || "";
export const canWrite = () => member?.role === "owner" || member?.role === "editor";
export const isOwner = () => member?.role === "owner";

function load() {
  try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { session = null; }
}
function save(s) {
  session = s;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

async function api(path, opts = {}) {
  return fetch(`${config.supabase_url}${path}`, {
    ...opts,
    headers: {
      apikey: config.anon_key,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

// Supabase reports failures in two shapes depending on the endpoint's age:
// {error, error_description} and {error_code, msg}. Read both, then say
// something a person can act on.
function authError(body, fallback) {
  const code = body?.error_code || body?.error || "";
  const text = body?.msg || body?.error_description || body?.message || "";
  if (/invalid_credentials|invalid_grant/.test(code) || /Invalid login credentials/i.test(text)) {
    return "That email and password do not match.";
  }
  if (/email_not_confirmed/.test(code)) return "That account has not been confirmed yet. Ask an owner.";
  if (/over_request_rate_limit|rate limit/i.test(code + text)) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  if (/weak_password/.test(code)) return "That password is too weak. Use at least 8 characters.";
  return text || fallback;
}

// Swap an expiring session for a fresh one. Without this you are signed out
// roughly hourly, which for an app you leave open all day is the whole
// difference between usable and not.
async function refresh() {
  if (!session?.refresh_token) return false;
  const r = await api("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!r.ok) { save(null); return false; }
  save(await r.json());
  // Re-mirror the new access token into the HttpOnly cookie.
  //
  // That cookie is what gates /repo and /deck-cache, because an <img>, an
  // <iframe> and a download link cannot send an Authorization header. The
  // server sets it ONLY on /api/me, and its value is the access token, which
  // expires in about an hour. Without this ping the cookie kept the token we
  // just replaced: /api/* calls carried on fine on the fresh bearer while every
  // slide fragment, thumbnail and brand image started coming back "sign in
  // first" and rendering that text as the slide.
  try { await fetch("/api/me", { headers: { Authorization: `Bearer ${token()}` } }); }
  catch { /* the next /api/me will fix it; the session itself is still good */ }
  return true;
}

// Called by api.js around every request: returns true if we now hold a usable
// session. Refreshes once when the server says the token is no longer good.
export async function ensureSession() {
  if (!session) return false;
  const exp = (session.expires_at || 0) * 1000;
  if (exp && Date.now() > exp - 60_000) return refresh();
  return true;
}

export async function signOut() {
  try { await api("/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${token()}` } }); }
  catch { /* the local session is what matters */ }
  save(null);
  member = null;
  location.reload();
}

// Change your own password. Goes through the local agent rather than straight to
// Supabase so it lands in the audit log like every other consequential action.
export async function changePassword(password) {
  const r = await fetch("/api/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ password }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Could not change the password.");
  return true;
}

// Boot: returns the signed-in member, or renders the sign-in screen and returns
// null (the page reloads once a sign-in succeeds).
export async function requireMember(mountEl) {
  config = await fetch("/api/config").then((r) => r.json()).catch(() => null);
  if (!config?.configured) {
    mountEl.classList.add("signed-out");
    mountEl.replaceChildren(el(`<div class="signin"><div class="signin-box">
      <h1>Deck Studio</h1>
      <p class="note">The backend is not configured. Set <span class="mono">SUPABASE_URL</span>
      and <span class="mono">SUPABASE_ANON_KEY</span> in <span class="mono">.env</span>.</p>
    </div></div>`));
    return null;
  }

  load();

  if (await ensureSession()) {
    const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token()}` } });
    if (r.ok) {
      member = (await r.json()).member;
      return member;
    }
    save(null);
  }

  renderSignIn(mountEl);
  return null;
}

function renderSignIn(mountEl, notice = "") {
  const box = el(`
    <div class="signin">
      <div class="signin-box">
        <div class="signin-brand"><span class="wm">oppr<b>.</b></span> <span class="side-app">Deck Studio</span></div>
        <h1>Sign in</h1>
        <p class="note">Deck Studio is for <b>@${esc(config.domain)}</b> accounts. An owner creates
          your account and gives you its first password; you can change it once you are in.</p>
        <div class="field">
          <label for="si-email">Work email</label>
          <input id="si-email" type="email" autocomplete="username" placeholder="you@${esc(config.domain)}">
        </div>
        <div class="field">
          <label for="si-pass">Password</label>
          <input id="si-pass" type="password" autocomplete="current-password">
        </div>
        <button class="primary full" id="si-go">Sign in</button>
        <p class="note" id="si-msg"></p>
      </div>
    </div>`);

  const msg = (t, bad) => {
    const n = box.querySelector("#si-msg");
    n.textContent = t;
    n.className = "note" + (bad ? " warn-text" : "");
  };

  const send = async () => {
    const email = box.querySelector("#si-email").value.trim().toLowerCase();
    const password = box.querySelector("#si-pass").value;
    if (!email.endsWith("@" + config.domain)) {
      return msg(`That is not an @${config.domain} address.`, true);
    }
    if (!password) return msg("Enter your password.", true);

    box.querySelector("#si-go").disabled = true;
    msg("Signing in…");
    try {
      const r = await api("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        box.querySelector("#si-go").disabled = false;
        return msg(authError(body, "Could not sign in."), true);
      }
      save(body);

      // The password was right, which is not the same as being allowed in: the
      // account may be disabled. Say which of the two it is.
      const me = await fetch("/api/me", { headers: { Authorization: `Bearer ${token()}` } });
      if (!me.ok) {
        save(null);
        box.querySelector("#si-go").disabled = false;
        return msg("That password is right, but this account has no access to Deck Studio. Ask an owner to restore it.", true);
      }
      location.reload();
    } catch (e) {
      box.querySelector("#si-go").disabled = false;
      msg(e.message || "Could not sign in.", true);
    }
  };

  if (notice) msg(notice, true);

  box.querySelector("#si-go").addEventListener("click", send);
  for (const id of ["#si-email", "#si-pass"]) {
    box.querySelector(id).addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  }
  // #app is a sidebar grid; the sign-in screen is a full page, so drop the
  // grid or the card renders inside the 220px sidebar column.
  mountEl.classList.add("signed-out");
  mountEl.replaceChildren(box);
  setTimeout(() => box.querySelector("#si-email").focus(), 40);
}
