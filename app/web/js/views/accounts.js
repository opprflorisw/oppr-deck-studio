// Accounts: who can get into Deck Studio, what they may do, and what they did.
//
// The domain is the gate — only @oppr.ai addresses can create an account at all,
// enforced in the database, not here. So this page is not about keeping people
// out; it is about seeing who is in and what they may do.
//
// Reworked 2026-08-20. The old page put three always-visible controls on every
// row — a bare role <select>, Set password, Remove access — which made the list
// read as a control panel instead of a roster, and a scroll wheel over the
// select could change someone's role by accident. Now the row states facts
// (name, email, role, status, last seen) and one **Manage** button expands a
// panel UNDER the row with the deliberate actions: the role as three described
// choices, the password, and access. Your own row manages your own password, so
// the separate "Your password" section is gone — you are an account like the
// others, managed where accounts are managed.

import { $, $$, el, esc, toast , backdropClose } from "../util.js";
import * as api from "../api.js";
import { icon, ibtn } from "../icons.js";
import { currentMember, changePassword } from "../auth.js";

// What each role means, in the words shown wherever a role is chosen or worn.
// Ordered least to most powerful, so reading down the list reads as "more".
const ROLES = [
  { id: "viewer", label: "Viewer", what: "Can look and download, but not change anything." },
  { id: "editor", label: "Editor", what: "Can build customer decks, edit artifacts, save versions and print." },
  { id: "owner", label: "Owner", what: "Everything, including the masters, the library and these accounts." },
];
const roleOf = (id) => ROLES.find((r) => r.id === id) || { id, label: id, what: "" };

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
  // Owners first, then editors, then viewers, alphabetical inside each — the
  // order the roles carry weight in, not the order people signed up in.
  const rank = { owner: 0, editor: 1, viewer: 2 };
  accounts.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9)
    || String(a.full_name || a.email).localeCompare(String(b.full_name || b.email)));

  const wrap = el(`
    <div>
      <p class="note">Only <b>@oppr.ai</b> addresses can have an account — the database refuses
        any other. There is no self-serve signup: an owner adds each colleague and hands them
        their first password.</p>

      <div class="section-head"><h2>People</h2><span class="section-count">${accounts.length}</span>
        ${can_manage ? `<button class="primary sm spacer" id="add-account">${ibtn("add", "Add a colleague")}</button>` : ""}</div>
      <div class="acct-list" id="rows"></div>
      ${can_manage ? "" : `<p class="note">Only an owner can change roles or reset a password.
        You can change your own password under <b>Manage</b> on your row.</p>`}

      <div class="section-head"><h2>Recent activity</h2></div>
      <p class="note">Everything the audit log recorded, newest first — from the app and from
        Claude over the connector alike.</p>
      <div id="audit"><div class="loading">Loading…</div></div>
    </div>`);

  const rows = $("#rows", wrap);
  for (const a of accounts) rows.append(accountRow(a, can_manage, me));

  $("#add-account", wrap)?.addEventListener("click", () => {
    openAddDialog((created) => rows.append(accountRow(created, true, me)));
  });

  api.getAudit({ limit: 60 })
    .then(({ entries }) => $("#audit", wrap).replaceChildren(auditList(entries)))
    .catch(() => { $("#audit", wrap).innerHTML = `<p class="note">Could not load the activity log.</p>`; });

  return wrap;
}

// ------------------------------------------------------------------ the row

function accountRow(a, canManage, me) {
  const isMe = me && a.id === me.id;
  const role = roleOf(a.role);
  // Everyone can manage themself (their password); an owner can manage anyone.
  const manageable = isMe || canManage;

  const row = el(`
    <div class="acct-row ${a.disabled ? "is-disabled" : ""}">
      <div class="acct-line">
        <span class="avatar">${esc((a.full_name || a.email)[0].toUpperCase())}</span>
        <div class="acct-id">
          <div class="acct-name"><b>${esc(a.full_name || a.email.split("@")[0])}</b>
            ${isMe ? `<span class="tags">you</span>` : ""}
            <span class="badge badge--role badge--${esc(a.role)}">${esc(role.label)}</span>
            ${a.disabled ? `<span class="pill-status draft">access removed</span>` : ""}
          </div>
          <div class="acct-sub note">
            <span class="mono">${esc(a.email)}</span>
            <span class="dot">&middot;</span>
            <span>${a.last_seen_at ? "last seen " + esc(a.last_seen_at.slice(0, 10)) : "never signed in"}</span>
            <span class="dot">&middot;</span>
            <span>${esc(role.what)}</span>
          </div>
        </div>
        ${manageable ? `<button class="ghost sm acct-manage" aria-expanded="false">${ibtn("settings", "Manage")}</button>` : ""}
      </div>
      <div class="acct-panel" hidden></div>
    </div>`);

  const btn = $(".acct-manage", row);
  btn?.addEventListener("click", () => {
    const panel = $(".acct-panel", row);
    const open = !panel.hidden;
    panel.hidden = open;
    btn.setAttribute("aria-expanded", String(!open));
    if (open) { panel.replaceChildren(); return; }
    panel.replaceChildren(isMe ? selfPanel() : managePanel(a, row));
  });

  return row;
}

// The management panel for someone else: role, password, access — stacked, each
// with the sentence that says what pressing it does. This is where "buttons
// under dropdowns" lives: nothing floats off to the right any more.
function managePanel(a, row) {
  const box = el(`
    <div>
      <div class="acct-block">
        <h4>Role</h4>
        <div class="rolecards">
          ${ROLES.map((r) => `
            <label class="rolecard ${r.id === a.role ? "on" : ""}">
              <input type="radio" name="role-${esc(a.id)}" value="${esc(r.id)}" ${r.id === a.role ? "checked" : ""}>
              <b>${esc(r.label)}</b>
              <span>${esc(r.what)}</span>
            </label>`).join("")}
        </div>
        <p class="note">Takes effect on their next request — nothing they have open needs a
          new sign-in.</p>
      </div>

      <div class="acct-block">
        <h4>Password</h4>
        ${passwordField(`rp-${a.id}`, "New password for " + a.email, suggestPassword())}
        <div class="row-actions">
          <button class="ghost sm" id="rp-go">Set this password</button>
          <span class="note" id="rp-msg"></span>
        </div>
      </div>

      <div class="acct-block">
        <h4>Access</h4>
        <p class="note">${a.disabled
          ? "Access is removed: they cannot sign in and the connector refuses them. Restoring it brings back the same account, history intact."
          : "Removing access blocks sign-in and the connector immediately. Nothing is deleted — the account and its history stay, and access can be restored."}</p>
        <button class="ghost sm danger" id="acc-toggle">${a.disabled ? "Restore access" : "Remove access"}</button>
      </div>
    </div>`);

  // Picking a role card applies it. A card click is a deliberate act in a way a
  // select's scroll-wheel change never was, and the rest of the app applies on
  // click too (the star, the posted box).
  $$(".rolecard input", box).forEach((input) => input.addEventListener("change", async () => {
    try {
      await api.updateAccount(a.id, { role: input.value });
      a.role = input.value;
      $$(".rolecard", box).forEach((c) => c.classList.toggle("on", $("input", c).checked));
      repaintRow(a, row);
      toast(`${a.email} is now ${roleOf(a.role).label.toLowerCase()}.`);
    } catch (err) {
      toast(err.message || "Could not change the role.");
      $$(".rolecard input", box).forEach((i) => { i.checked = i.value === a.role; });
    }
  }));

  wireSuggest(box);
  $("#rp-go", box).addEventListener("click", async () => {
    $("#rp-go", box).disabled = true;
    try {
      await api.resetAccountPassword(a.id, $(`#rp-${CSS.escape(a.id)}`, box).value);
      toast(`New password set for ${a.email}. Pass it to them yourself.`);
      $("#rp-msg", box).textContent = "Set. Hand it over in person or on a call.";
    } catch (e) {
      $("#rp-msg", box).textContent = e.message || "Could not set the password.";
    } finally {
      $("#rp-go", box).disabled = false;
    }
  });

  $("#acc-toggle", box).addEventListener("click", async (e) => {
    const disabled = !a.disabled;
    if (disabled && !confirm(`Remove ${a.email}'s access to Deck Studio?`)) return;
    try {
      await api.updateAccount(a.id, { disabled });
      a.disabled = disabled;
      e.target.textContent = disabled ? "Restore access" : "Remove access";
      repaintRow(a, row);
      toast(disabled ? `${a.email} can no longer sign in.` : `${a.email} can sign in again.`);
    } catch (err) { toast(err.message || "Could not change access."); }
  });

  return box;
}

// Your own panel: the one thing you can do to yourself is change your password.
// (The server refuses to let an owner demote or disable themself, so those
// controls would only exist to show an error.)
function selfPanel() {
  const box = el(`
    <div>
      <div class="acct-block">
        <h4>Your password</h4>
        <p class="note">Changing it signs out nothing you have open; it takes effect the next
          time you sign in.</p>
        ${passwordField("mp-pass", "New password")}
        <div class="row-actions">
          <button class="ghost sm" id="mp-go">Change my password</button>
          <span class="note" id="mp-msg"></span>
        </div>
      </div>
    </div>`);

  wireSuggest(box);
  $("#mp-go", box).addEventListener("click", async () => {
    $("#mp-go", box).disabled = true;
    $("#mp-msg", box).textContent = "Changing…";
    try {
      await changePassword($("#mp-pass", box).value);
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

// Redraw the facts line after a change, without rebuilding the open panel.
function repaintRow(a, row) {
  const role = roleOf(a.role);
  row.classList.toggle("is-disabled", Boolean(a.disabled));
  const name = $(".acct-name", row);
  $(".badge--role", name).outerHTML =
    `<span class="badge badge--role badge--${esc(a.role)}">${esc(role.label)}</span>`;
  $(".pill-status", name)?.remove();
  if (a.disabled) name.append(el(`<span class="pill-status draft">access removed</span>`));
  const sub = $$(".acct-sub > span", row);
  sub[sub.length - 1].textContent = role.what;
}

// ------------------------------------------------------------ adding someone

function openAddDialog(onCreated) {
  const m = el(`<div class="modal"><div class="modal-box">
    <header><b>${icon("person", 18)} Add a colleague</b>
      <button class="ghost icon-only close" title="Close">${icon("close")}</button></header>
    <div class="modal-body">
      <div class="field"><label for="na-email">Work email</label>
        <input id="na-email" type="email" placeholder="colleague@oppr.ai" autocomplete="off">
        <p class="note">Must be @oppr.ai — anything else is refused by the database.</p></div>
      <div class="field"><label for="na-name">Name</label>
        <input id="na-name" type="text" placeholder="Full name" autocomplete="off"></div>

      <div class="field"><label>Role</label>
        <div class="rolecards">
          ${ROLES.map((r) => `
            <label class="rolecard ${r.id === "editor" ? "on" : ""}">
              <input type="radio" name="na-role" value="${esc(r.id)}" ${r.id === "editor" ? "checked" : ""}>
              <b>${esc(r.label)}</b>
              <span>${esc(r.what)}</span>
            </label>`).join("")}
        </div></div>

      ${passwordField("na-pass", "First password", suggestPassword())}
      <p class="note">Shown in clear text on purpose: you hand this to them yourself, and a
        masked field you cannot read is how a password gets mistyped twice. They can change
        it once they are in.</p>

      <div class="modal-actions">
        <span class="note" id="na-msg"></span>
        <button class="primary" id="na-go">Create the account</button>
      </div>
    </div>
  </div></div>`);

  const close = () => m.remove();
  $(".close", m).addEventListener("click", close);
  backdropClose(m, close);
  wireSuggest(m);
  $$(".rolecard input", m).forEach((i) => i.addEventListener("change", () => {
    $$(".rolecard", m).forEach((c) => c.classList.toggle("on", $("input", c).checked));
  }));

  $("#na-go", m).addEventListener("click", async () => {
    const email = $("#na-email", m).value.trim().toLowerCase();
    const payload = {
      email,
      password: $("#na-pass", m).value,
      full_name: $("#na-name", m).value.trim(),
      role: $(".rolecard input:checked", m)?.value || "editor",
    };
    $("#na-go", m).disabled = true;
    $("#na-msg", m).textContent = "Creating…";
    try {
      const created = await api.createAccount(payload);
      toast(`${email} can now sign in. Pass them the password you set.`);
      close();
      onCreated({ ...created, full_name: payload.full_name, disabled: false, last_seen_at: null });
    } catch (e) {
      $("#na-go", m).disabled = false;
      $("#na-msg", m).textContent = e.message || "Could not create the account.";
    }
  });

  document.body.append(m);
  setTimeout(() => $("#na-email", m).focus(), 30);
}

// ------------------------------------------------------------------ passwords

// A password someone can read out over a call without ambiguity: no l/1/O/0, and
// long enough that it does not matter that it is memorable-ish.
function suggestPassword() {
  const alphabet = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function passwordField(id, label, initial = "") {
  return `
    <div class="field">
      <label for="${esc(id)}">${esc(label)}</label>
      <div class="row-actions">
        <input id="${esc(id)}" type="text" class="mono" autocomplete="new-password" value="${esc(initial)}">
        <button class="ghost sm" data-suggest="${esc(id)}">Suggest</button>
      </div>
    </div>`;
}

function wireSuggest(box) {
  for (const b of $$("[data-suggest]", box)) {
    b.addEventListener("click", () => { $("#" + CSS.escape(b.dataset.suggest), box).value = suggestPassword(); });
  }
}

// ------------------------------------------------------------------ activity

// Every action the audit log records, said as a person would. The old map knew
// nine of them, so the feed printed raw slugs like `deck.build.dryrun` and
// `mcp.tool` — a log dump wearing an activity feed's heading. The object (which
// deck, which tool, which account) comes from `detail`, because "built a deck"
// without saying which is barely information.
function describe(e) {
  const d = e.detail || {};
  const slug = d.slug ? ` <span class="mono">${esc(d.slug)}</span>` : "";
  switch (e.action) {
    case "version.save": return `saved a version${d.n ? ` <span class="tags mono">v${esc(String(d.n))}</span>` : ""}`;
    case "version.restore": return `restored a version${d.n ? ` <span class="tags mono">v${esc(String(d.n))}</span>` : ""}`;
    case "deck.rename": return `renamed a deck${slug}`;
    case "deck.master": return `moved the master tag${slug}`;
    case "deck.personalize": return `personalized a deck${slug}`;
    case "deck.patch": return `changed ${esc(fieldsSaid(d.fields))} on a deck`;
    case "deck.build": return `built and published${slug}`;
    case "deck.build.dryrun": return `checked${slug} without publishing`;
    case "deck.sent": return `recorded a deck as sent${d.recipient ? ` to ${esc(d.recipient)}` : ""}`;
    case "build.run": return `printed a PDF${slug}`;
    case "customer.create": return `registered the customer ${esc(d.name || d.slug || "")}`;
    case "slide.archive": return `archived the library slide <span class="mono">${esc(d.slide_id || "")}</span>`;
    case "slide.restore": return `restored the library slide <span class="mono">${esc(d.slide_id || "")}</span>`;
    case "account.create": return `added the account ${esc(d.email || "")}${d.role ? ` as ${esc(d.role)}` : ""}`;
    case "account.update": return d.role ? `changed an account's role to ${esc(d.role)}`
      : "disabled" in d ? (d.disabled ? "removed an account's access" : "restored an account's access")
      : "changed an account";
    case "account.password": return "set a password for an account";
    case "mcp.tool": return `used <span class="mono">${esc(d.tool || "a tool")}</span> through Claude`;
    default: return esc(e.action);
  }
}

// "note and star", not '["note","starred","updated_by_id"]'.
function fieldsSaid(fields) {
  const words = { post_text: "the post text", note: "the note", starred: "the star",
    title: "the title", pdf_core: "the filename", type: "the type", archived: "archived" };
  const f = (fields || []).filter((x) => x !== "updated_by_id").map((x) => words[x] || x);
  if (!f.length) return "details";
  return f.length === 1 ? f[0] : f.slice(0, -1).join(", ") + " and " + f[f.length - 1];
}

function auditList(entries) {
  if (!entries.length) return el(`<p class="note">Nothing recorded yet.</p>`);
  // Grouped by day, so "what happened Tuesday" is a glance and not arithmetic.
  let lastDay = "";
  const parts = [];
  for (const e of entries) {
    const day = (e.at || "").slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      parts.push(`<div class="audit-day">${esc(day)}</div>`);
    }
    parts.push(`
      <div class="audit-row">
        <span class="audit-time mono">${esc((e.at || "").slice(11, 16))}</span>
        <span class="audit-who">${esc((e.actor_email || "someone").split("@")[0])}</span>
        <span class="audit-what">${describe(e)}</span>
      </div>
      ${e.detail?.change_note ? `<div class="audit-note note">${esc(e.detail.change_note)}</div>` : ""}`);
  }
  return el(`<div class="audit-list">${parts.join("")}</div>`);
}
