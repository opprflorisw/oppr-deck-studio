// Accounts: who can get into Deck Studio, and who has been in it lately.
//
// The domain is the gate — only @oppr.ai addresses can create an account at all,
// enforced in the database, not here. So this page is not about keeping people
// out; it is about seeing who is in and what they may do.

import { $, $$, el, esc, toast } from "../util.js";
import * as api from "../api.js";
import { icon } from "../icons.js";
import { currentMember, changePassword } from "../auth.js";

const ROLES = {
  owner: "Everything, including managing these accounts",
  editor: "Can change artifacts, save versions and print",
  viewer: "Can look and download, but not change anything",
};

// The area frame mounts what this returns, synchronously, so return the
// container now and fill it when the data arrives. Returning a promise renders
// the string "[object Promise]".
export function render() {
  const box = el(`<div><div class="loading">Loading accounts…</div></div>`);
  api.getAccounts()
    .then((data) => box.replaceChildren(view(data)))
    .catch((e) => box.replaceChildren(el(`<div class="empty"><p>${esc(e.message)}</p></div>`)));
  return box;
}

function view(data) {
  const { accounts, can_manage } = data;
  const me = currentMember();

  const wrap = el(`
    <div>
      <p class="note">Deck Studio is restricted to <b>@oppr.ai</b> addresses, and the database
        refuses any other. Sign-in is email and password; accounts are not self-serve, so an owner
        adds each colleague and gives them their first password.
        ${can_manage ? "As owner you decide what each person may do." : ""}</p>
      <div class="section-head"><h2>Accounts</h2><span class="section-count">${accounts.length}</span>
        ${can_manage ? `<button class="primary sm spacer" id="add-account">Add a colleague</button>` : ""}</div>
      <div id="new-account"></div>
      <div id="rows"></div>
      ${can_manage ? "" : `<p class="note">Only an owner can change roles.</p>`}
      <div class="section-head"><h2>Your password</h2></div>
      <div id="my-password"></div>
      <div class="section-head"><h2>Recent activity</h2></div>
      <div id="audit"><div class="loading">Loading…</div></div>
    </div>`);

  const rows = $("#rows", wrap);
  for (const a of accounts) rows.append(accountRow(a, can_manage, me));

  $("#my-password", wrap).append(myPasswordForm());

  $("#add-account", wrap)?.addEventListener("click", () => {
    const slot = $("#new-account", wrap);
    if (slot.firstChild) return slot.replaceChildren();
    slot.replaceChildren(addAccountForm((created) => {
      slot.replaceChildren();
      rows.prepend(accountRow(created, true, me));
    }));
  });

  api.getAudit({ limit: 40 })
    .then(({ entries }) => $("#audit", wrap).replaceChildren(auditList(entries)))
    .catch(() => { $("#audit", wrap).innerHTML = `<p class="note">Could not load the activity log.</p>`; });

  return wrap;
}

function accountRow(a, canManage, me) {
  const isMe = me && a.id === me.id;
  const row = el(`
    <div class="deck-row">
      <div class="head">
        <span class="avatar">${esc((a.full_name || a.email)[0].toUpperCase())}</span>
        <h3>${esc(a.full_name || a.email.split("@")[0])}${isMe ? ' <span class="tags">you</span>' : ""}</h3>
        <span class="mono note">${esc(a.email)}</span>
        ${a.disabled ? `<span class="pill-status draft">no access</span>` : ""}
        <span class="note">${a.last_seen_at ? "seen " + esc(a.last_seen_at.slice(0, 10)) : "never signed in"}</span>
        <div class="spacer row-actions">
          ${canManage && !isMe
            ? `<select class="role-pick">${Object.keys(ROLES).map((r) =>
                `<option value="${r}"${r === a.role ? " selected" : ""}>${r}</option>`).join("")}</select>
               <button class="ghost sm reset-pw">Set password</button>
               <button class="ghost sm toggle">${a.disabled ? "Restore access" : "Remove access"}</button>`
            : `<span class="badge">${esc(a.role)}</span>`}
        </div>
      </div>
      <p class="note acct-note">${esc(ROLES[a.role] || "")}</p>
      <div class="pw-slot"></div>
    </div>`);

  $(".role-pick", row)?.addEventListener("change", async (e) => {
    const role = e.target.value;
    try {
      await api.updateAccount(a.id, { role });
      $(".acct-note", row).textContent = ROLES[role] || "";
      toast(`${a.email} is now ${role}.`);
    } catch (err) { toast(err.message || "could not change the role"); }
  });

  $(".toggle", row)?.addEventListener("click", async (e) => {
    const disabled = !a.disabled;
    if (disabled && !confirm(`Remove ${a.email}'s access to Deck Studio?`)) return;
    try {
      await api.updateAccount(a.id, { disabled });
      a.disabled = disabled;
      e.target.textContent = disabled ? "Restore access" : "Remove access";
      toast(disabled ? `${a.email} can no longer sign in.` : `${a.email} can sign in again.`);
    } catch (err) { toast(err.message || "could not change access"); }
  });

  $(".reset-pw", row)?.addEventListener("click", () => {
    const slot = $(".pw-slot", row);
    if (slot.firstChild) return slot.replaceChildren();
    slot.replaceChildren(setPasswordForm(a, () => slot.replaceChildren()));
  });

  return row;
}

// A password someone can read out over a call without ambiguity: no l/1/O/0, and
// long enough that it does not matter that it is memorable-ish.
function suggestPassword() {
  const alphabet = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// The password field, with a generated suggestion. Shown in clear text on
// purpose: whoever creates an account has to pass this to a colleague, and a
// masked field they cannot read is how people end up mistyping it twice.
function passwordField(id, label, initial = "") {
  return `
    <div class="field">
      <label for="${id}">${esc(label)}</label>
      <div class="row-actions">
        <input id="${id}" type="text" class="mono" autocomplete="new-password" value="${esc(initial)}">
        <button class="ghost sm" data-suggest="${id}">Suggest</button>
      </div>
    </div>`;
}

function wireSuggest(box) {
  for (const b of $$("[data-suggest]", box)) {
    b.addEventListener("click", () => { $("#" + b.dataset.suggest, box).value = suggestPassword(); });
  }
}

function addAccountForm(onCreated) {
  const box = el(`
    <div class="deck-row">
      <div class="field">
        <label for="na-email">Work email</label>
        <input id="na-email" type="email" placeholder="colleague@oppr.ai" autocomplete="off">
      </div>
      <div class="field">
        <label for="na-name">Name</label>
        <input id="na-name" type="text" placeholder="Full name" autocomplete="off">
      </div>
      <div class="field">
        <label for="na-role">Role</label>
        <select id="na-role">${Object.keys(ROLES).map((r) =>
          `<option value="${r}"${r === "editor" ? " selected" : ""}>${r}</option>`).join("")}</select>
      </div>
      ${passwordField("na-pass", "First password", suggestPassword())}
      <div class="row-actions">
        <button class="primary sm" id="na-go">Create the account</button>
        <span class="note" id="na-msg"></span>
      </div>
    </div>`);

  wireSuggest(box);

  $("#na-go", box).addEventListener("click", async () => {
    const email = $("#na-email", box).value.trim().toLowerCase();
    const password = $("#na-pass", box).value;
    const payload = { email, password, full_name: $("#na-name", box).value.trim(), role: $("#na-role", box).value };
    $("#na-go", box).disabled = true;
    $("#na-msg", box).textContent = "Creating…";
    try {
      const created = await api.createAccount(payload);
      toast(`${email} can now sign in. Pass them the password you set.`);
      onCreated({ ...created, full_name: payload.full_name, disabled: false, last_seen_at: null });
    } catch (e) {
      $("#na-go", box).disabled = false;
      $("#na-msg", box).textContent = e.message || "Could not create the account.";
    }
  });

  return box;
}

function setPasswordForm(a, done) {
  const box = el(`
    <div>
      ${passwordField("rp-pass", `New password for ${a.email}`, suggestPassword())}
      <div class="row-actions">
        <button class="primary sm" id="rp-go">Set it</button>
        <button class="ghost sm" id="rp-cancel">Cancel</button>
        <span class="note" id="rp-msg"></span>
      </div>
    </div>`);

  wireSuggest(box);
  $("#rp-cancel", box).addEventListener("click", done);

  $("#rp-go", box).addEventListener("click", async () => {
    $("#rp-go", box).disabled = true;
    try {
      await api.resetAccountPassword(a.id, $("#rp-pass", box).value);
      toast(`New password set for ${a.email}.`);
      done();
    } catch (e) {
      $("#rp-go", box).disabled = false;
      $("#rp-msg", box).textContent = e.message || "Could not set the password.";
    }
  });

  return box;
}

function myPasswordForm() {
  const box = el(`
    <div class="deck-row">
      <p class="note">Changing this signs out nothing else you have open; it takes effect the next
        time you sign in.</p>
      ${passwordField("mp-pass", "New password")}
      <div class="row-actions">
        <button class="primary sm" id="mp-go">Change my password</button>
        <span class="note" id="mp-msg"></span>
      </div>
    </div>`);

  wireSuggest(box);

  $("#mp-go", box).addEventListener("click", async () => {
    const password = $("#mp-pass", box).value;
    $("#mp-go", box).disabled = true;
    $("#mp-msg", box).textContent = "Changing…";
    try {
      await changePassword(password);
      $("#mp-pass", box).value = "";
      $("#mp-msg", box).textContent = "";
      toast("Password changed.");
    } catch (e) {
      $("#mp-msg", box).textContent = e.message || "Could not change the password.";
    } finally {
      $("#mp-go", box).disabled = false;
    }
  });

  return box;
}

const VERB = {
  "version.save": "saved a version of",
  "version.restore": "restored a version of",
  "deck.rename": "renamed",
  "deck.master": "changed the master tag on",
  "deck.personalize": "personalized",
  "build.run": "printed",
  "account.update": "changed an account",
  "account.create": "added an account",
  "account.password": "set a password",
};

function auditList(entries) {
  if (!entries.length) return el(`<p class="note">Nothing recorded yet.</p>`);
  return el(`<ul class="findings">${entries.map((e) => `
    <li class="finding">
      <div class="finding-head">
        <b>${esc(e.actor_email || "someone")}</b>
        <span>${esc(VERB[e.action] || e.action)}</span>
        ${e.detail?.n ? `<span class="tags mono">v${esc(String(e.detail.n))}</span>` : ""}
        <span class="tags">${esc((e.at || "").replace("T", " ").slice(0, 16))}</span>
      </div>
      ${e.detail?.change_note ? `<div class="note">${esc(e.detail.change_note)}</div>` : ""}
    </li>`).join("")}</ul>`);
}
