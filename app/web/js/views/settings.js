// Settings — how the studio is wired, and how to connect Claude to it.
//
// Two tabs, and the order is the point. "Connect Claude" is a thing you come
// here to DO; the file browser is a thing you come here to read. The MCP address
// used to live only in a chat message and a spec under `.scratch/`, which means
// the one instruction a colleague needs in order to use Deck Studio from their
// phone was the one instruction the tool itself never said.

import { $, el, esc } from "../util.js";
import * as api from "../api.js";
import * as knowledge from "./knowledge.js";

export function renderBody(tab = "connect") {
  if (tab === "files") return knowledge.renderBody("config");
  return connect();
}

// The tool list is FETCHED, not typed. It used to be a hand-maintained copy of
// lib/mcptools.mjs, and it had already drifted: it promised a page count that
// the tool never returned. A page describing what a connector can do is worth
// exactly as much as its agreement with the connector.
let TOOLS = null;

function connect() {
  // Derived, never hardcoded: the server builds the same address from the host
  // the request arrived on, so whichever deployment you are reading this from is
  // the deployment this address points at.
  const addr = `${location.origin}/mcp`;

  // Reading this from `npm run dev` is the one case where the honest address is
  // the wrong one to hand a colleague: it resolves on this laptop and nowhere
  // else. Say so here rather than let someone paste it into a phone.
  const isLocal = ["127.0.0.1", "localhost", "::1"].includes(location.hostname);

  const box = el(`
    <div class="setup">
      <p class="note">Deck Studio has a second front door. Point Claude at it and you can
        register a customer, <b>build their deck from the slide library</b>, check it, publish it,
        get the PDF and record that it went out — from the desktop app, the web app or your phone,
        without opening this one.</p>

      <div class="panel">
        <h2>The address</h2>
        <div class="prompt-box"><code>${esc(addr)}</code></div>
        ${isLocal ? `<p class="note"><b>This is the local agent.</b> The address works from Claude on
          this machine only. Open Settings on the hosted app to get the one to share with the team.</p>` : ""}
        <p class="note" id="mcp-status">Checking that this deployment answers…</p>
      </div>

      <div class="panel">
        <h2>Adding it in Claude</h2>
        <ol class="setup-steps">
          <li>Open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.
            <span class="note">(The wording moves between releases; it is the option that asks for a URL.)</span></li>
          <li>Name it <b>Deck Manager</b> and paste the address above. There is nothing else to fill in —
            no key, no token.</li>
          <li>Click <b>Connect</b>. A browser window opens on Deck Studio and asks you to sign in
            with your Oppr email and password, then to approve the connection.</li>
          <li>Approve it. Claude comes back with the tools listed below.</li>
        </ol>
        <p class="note">It acts as <b>you</b>: same account, same role, same limits. Nothing it does
          can exceed what you are allowed to do in this app.</p>
      </div>

      <div class="panel">
        <h2>What Claude can do with it</h2>
        <div class="tool-lists"><p class="note">Loading the tool list…</p></div>
      </div>

      <div class="panel">
        <h2>What it deliberately cannot do</h2>
        <p class="note">There is no tool for editing a company deck, changing the slide library,
          archiving a slide, or moving which deck is the master. That absence is the boundary, not
          an omission: work that affects one customer's artifact is a connector job, and work that
          changes every deck built from then on stays here, with an owner behind it.</p>
        <p class="note">Building a customer's deck <b>is</b> a connector job: pick slides from the
          library, fill in the deck's details, check it, publish it, get the PDF. Composing a deck
          never changes what the library holds.</p>
      </div>

      <div class="panel">
        <h2>When it will not connect</h2>
        <ul class="setup-tools">
          <li><b>It asks again and again</b><span>Remove the connector and add it back. A half-finished
            authorization leaves a registration Claude keeps retrying.</span></li>
          <li><b>The sign-in window is on a different address</b><span>Expected. The consent page opens on
            whichever host the Supabase project calls home, and your session there is separate from
            this one — so you sign in once more, in that window.</span></li>
          <li><b>Every tool answers "authentication required"</b><span>The project's OAuth server is
            switched off. An owner turns it on in the Supabase dashboard under
            <b>Authentication → OAuth Server</b>.</span></li>
        </ul>
      </div>
    </div>`);

  // Live check. Discovery is unauthenticated by design — it is how Claude learns
  // where to get a token — so the page can prove the door exists before you have
  // gone anywhere near it. A missing or wrong document here is exactly the case
  // where Claude shows a plain error instead of a Connect button.
  fetch("/.well-known/oauth-protected-resource/mcp")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d) => {
      const ok = d.resource === addr;
      const line = $("#mcp-status", box);
      line.innerHTML = ok
        ? `Answering. Sign-in is handled by <span class="mono">${esc(d.authorization_servers?.[0] || "?")}</span>.`
        : `This deployment answers, but calls itself <span class="mono">${esc(d.resource || "?")}</span>.
           Use that address instead — Claude refuses a pairing where the two disagree.`;
    })
    .catch((e) => {
      $("#mcp-status", box).textContent =
        `This deployment did not answer the discovery request (${e.message}). Claude cannot connect until it does.`;
    });

  // The tools, from the server that serves them.
  api.authedFetch("/api/mcp-tools")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((d) => {
      TOOLS = d.tools || [];
      const reads = TOOLS.filter((t) => t.read);
      const writes = TOOLS.filter((t) => !t.read);
      const list = (items) => `<ul class="setup-tools">${items.map((t) =>
        `<li><b>${esc(t.title)}</b><span>${esc(t.description)}</span></li>`).join("")}</ul>`;
      $(".tool-lists", box).innerHTML =
        `<p class="note">Reading — any active account, including a viewer.</p>${list(reads)}` +
        `<p class="note">Changing — editors and owners only. Everything here affects one ` +
        `customer's artifact; nothing here changes what future decks are made of.</p>${list(writes)}`;
    })
    .catch(() => {
      $(".tool-lists", box).innerHTML =
        `<p class="note">The tool list could not be loaded. Reload the page.</p>`;
    });

  return box;
}
