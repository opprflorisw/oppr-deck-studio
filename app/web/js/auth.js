// Signing in (Deck Studio cloud).
//
// Supabase Auth, email magic link. No password is ever typed, stored or sent —
// you get a one-time link at your @oppr.ai address. Only @oppr.ai accounts can
// exist at all: the database refuses to create any other, so a wrong address
// fails at signup rather than getting in and being cleaned up later.
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

// Resolve the magic-link fragment the browser lands on after clicking the email.
function consumeLinkFragment() {
  const h = location.hash || "";
  const at = h.indexOf("access_token=");
  if (at === -1) return false;
  const params = new URLSearchParams(h.slice(h.indexOf("#", 1) === -1 ? 1 : h.indexOf("#") + 1));
  const access_token = params.get("access_token");
  if (!access_token) return false;
  save({
    access_token,
    refresh_token: params.get("refresh_token") || "",
    expires_at: Number(params.get("expires_at") || 0),
  });
  // Strip the tokens out of the address bar so they are not in history or in a
  // screenshot.
  history.replaceState(null, "", location.pathname + location.search + "#/customers");
  return true;
}

// Boot: returns the signed-in member, or renders the sign-in screen and never
// resolves (the page reloads when the link is used).
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

  consumeLinkFragment();
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

function renderSignIn(mountEl) {
  const box = el(`
    <div class="signin">
      <div class="signin-box">
        <div class="signin-brand"><span class="wm">oppr<b>.</b></span> <span class="side-app">Deck Studio</span></div>
        <h1>Sign in</h1>
        <p class="note">Deck Studio is for <b>@${esc(config.domain)}</b> accounts. Enter your work
          address and we will email you a link — there is no password.</p>
        <div class="field">
          <label for="si-email">Work email</label>
          <input id="si-email" type="email" autocomplete="email" placeholder="you@${esc(config.domain)}">
        </div>
        <button class="primary full" id="si-go">Email me a sign-in link</button>
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
    if (!email.endsWith("@" + config.domain)) {
      return msg(`That is not an @${config.domain} address.`, true);
    }
    box.querySelector("#si-go").disabled = true;
    msg("Sending…");
    try {
      const r = await api("/auth/v1/otp", {
        method: "POST",
        body: JSON.stringify({ email, create_user: true,
          options: { email_redirect_to: location.origin } }),
      });
      if (r.ok) msg(`Check ${email} for the link. You can close this tab.`);
      else {
        const b = await r.json().catch(() => ({}));
        msg(b.msg || b.message || "Could not send the link.", true);
      }
    } catch (e) {
      msg(e.message || "Could not send the link.", true);
    } finally {
      box.querySelector("#si-go").disabled = false;
    }
  };

  box.querySelector("#si-go").addEventListener("click", send);
  box.querySelector("#si-email").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  // #app is a sidebar grid; the sign-in screen is a full page, so drop the
  // grid or the card renders inside the 220px sidebar column.
  mountEl.classList.add("signed-out");
  mountEl.replaceChildren(box);
  setTimeout(() => box.querySelector("#si-email").focus(), 40);
}
