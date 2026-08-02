// Accounts: who can get into Deck Studio, and who has been in it lately.
//
// The domain is the gate — only @oppr.ai addresses can create an account at all,
// enforced in the database, not here. So this page is not about keeping people
// out; it is about seeing who is in and what they may do.

import { $, $$, el, esc, toast } from "../util.js";
import * as api from "../api.js";
import { icon } from "../icons.js";
import { currentMember } from "../auth.js";

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
      <p class="note">Deck Studio is restricted to <b>@oppr.ai</b> addresses. Anyone at Oppr can
        sign in with a link to their work email; nobody else can create an account, because the
        database refuses it. ${can_manage ? "As owner you decide what each person may do." : ""}</p>
      <div class="section-head"><h2>Accounts</h2><span class="section-count">${accounts.length}</span></div>
      <div id="rows"></div>
      ${can_manage ? "" : `<p class="note">Only an owner can change roles.</p>`}
      <div class="section-head"><h2>Recent activity</h2></div>
      <div id="audit"><div class="loading">Loading…</div></div>
    </div>`);

  const rows = $("#rows", wrap);
  for (const a of accounts) rows.append(accountRow(a, can_manage, me));

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
               <button class="ghost sm toggle">${a.disabled ? "Restore access" : "Remove access"}</button>`
            : `<span class="badge">${esc(a.role)}</span>`}
        </div>
      </div>
      <p class="note acct-note">${esc(ROLES[a.role] || "")}</p>
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

  return row;
}

const VERB = {
  "version.save": "saved a version of",
  "version.restore": "restored a version of",
  "deck.rename": "renamed",
  "deck.master": "changed the master tag on",
  "deck.personalize": "personalized",
  "build.run": "printed",
  "account.update": "changed an account",
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
