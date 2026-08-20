// Thin fetch wrappers around the server API.
//
// Every call carries the signed-in member's token. The server refuses anything
// without one, so this is the single place identity is attached — a request that
// forgets it fails loudly rather than silently acting as nobody.

import { token, ensureSession } from "./auth.js";

// Wrap fetch so the header is never forgotten, and a 401 is a clear message
// rather than a mystery.
export async function authedFetch(url, opts = {}) {
  await ensureSession();
  const t = token();
  const res = await fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
  if (res.status === 401) {
    const err = new Error("Your session has expired. Reload to sign in again.");
    err.status = 401;
    throw err;
  }
  return res;
}

async function j(url, opts) {
  const res = await authedFetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const getIndex = () => j("/api/index");
export const refresh = () => j("/api/refresh", { method: "POST" });

export const importGraphics = (payload) =>
  j("/api/import-graphics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

// Publish status now lives in the backend publish_log table (v3). These names
// are unchanged so social.js needs no edit; only the endpoint moved.
export const getSocialStatus = () => j("/api/publish-log");
export const putSocialStatus = (slug, data) =>
  j(`/api/publish-log/${encodeURIComponent(slug)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

// Removes the built output folder. Destructive and irreversible; the caller is
// expected to have taken a typed confirmation first.
export const deleteSocialOutput = (channel, slug) =>
  j(`/api/social-output/${encodeURIComponent(channel)}/${encodeURIComponent(slug)}`, { method: "DELETE" });

// Stage a new customer (name + logo dataURL + brief) into dump/_app/<slug>/.
export const customerIntake = (payload) =>
  j("/api/customer-intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

// === Last 30 days research ==================================================
const txt = (url) => authedFetch(url).then((r) => { if (!r.ok) throw new Error("not found"); return r.text(); });

export const getResearch = () => j("/api/research");
export const getBrain = () => j("/api/research/brain");
export const getBrainMd = () => txt("/api/research/brain.md");
export const getResearchRun = (slug) => j(`/api/research/runs/${encodeURIComponent(slug)}`);
export const getResearchRunRaw = (slug) => txt(`/api/research/runs/${encodeURIComponent(slug)}/raw`);
export const getResearchPost = (file) => txt(`/api/research/posts/${encodeURIComponent(file)}`);
export const promoteIdea = (file, hero) =>
  j(`/api/research/posts/${encodeURIComponent(file)}/promote`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(hero || {}),
  });
export const getPerformance = () => j("/api/research/performance");
export const putPerformance = (slug, data) =>
  j(`/api/research/performance/${encodeURIComponent(slug)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
export const rebuildBrain = () => j("/api/research/rebuild", { method: "POST" });
export const syncResearch = () => j("/api/research/sync", { method: "POST" });
export const researchBriefUrl = (slug) => `/repo/research/last30days/runs/${encodeURIComponent(slug)}/brief.html`;

export const getKnowledgeTree = () => j("/api/knowledge");
export const getKnowledgeFile = (path) =>
  authedFetch(`/api/knowledge/${path.split("/").map(encodeURIComponent).join("/")}`).then((r) => {
    if (!r.ok) throw new Error("not found");
    return r.text();
  });

// === Deck Studio v3 backend =================================================
const jpost = (url, obj) =>
  j(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj || {}) });

export const getDecks = () => j("/api/decks");
export const getSlideUsage = () => j("/api/slide-usage");
export const getDeck = (id) => j(`/api/decks/${id}`);
export const getDeckVersionHtml = (id, n) =>
  authedFetch(`/api/decks/${id}/versions/${n}/html`).then((r) => { if (!r.ok) throw new Error("no version"); return r.text(); });
export const deckViewUrl = (id, n) => `/api/decks/${id}/versions/${n}/view`;
export const deckPdfUrl = (id, n) => `/api/decks/${id}/versions/${n}/pdf`;
// Page 1 at full page-format resolution -- the download for a social image.
export const deckPngUrl = (id, n) => `/api/decks/${id}/versions/${n}/png`;
export const saveDeckVersion = (id, html, change_note) => jpost(`/api/decks/${id}/versions`, { html, change_note });
export const restoreDeckVersion = (id, n) => jpost(`/api/decks/${id}/restore`, { n });
export const setDeckMaster = (id, is_master) => jpost(`/api/decks/${id}/master`, { is_master });
export const registerDeckAsset = (id, source, cache_version) => jpost(`/api/decks/${id}/assets`, { source, cache_version });
export const personalizeDeck = (id, payload) => jpost(`/api/decks/${id}/personalize`, payload);
export const buildDeck = (id) => jpost(`/api/decks/${id}/build`, {});
// One PATCH for everything about the artifact that is not its content: title,
// filename core, note, star, post text. None of them makes a version.
export const patchDeck = (id, patch) =>
  j(`/api/decks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
export const renameDeck = patchDeck;

// Download the PDF for a version. The server prints on demand when the version
// has no PDF yet, so what arrives always matches what is on screen. A verify
// FAIL comes back as 409 with the report; the caller decides whether to offer
// the explicit unverified download.
export async function downloadDeckPdf(id, n, { unverified = false } = {}) {
  const url = `/api/decks/${id}/versions/${n}/pdf${unverified ? "?unverified=1" : ""}`;
  const res = await authedFetch(url);
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch {}
    const err = new Error(body.error || res.statusText);
    err.status = res.status;
    err.verify_report = body.verify_report;
    err.canDownloadUnverified = body.can_download_unverified;
    throw err;
  }
  const disp = res.headers.get("Content-Disposition") || "";
  const name = (/filename="([^"]+)"/.exec(disp) || [])[1] || `deck-v${n}.pdf`;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return name;
}
export const getJob = (jobId) => j(`/api/jobs/${jobId}`);
export const getCustomers2 = () => j("/api/customers2");
// Sends: which version of a deck went to whom, and when. Pinned to a version,
// so the timeline can say "they hold v1, we are on v3" without guessing.
export const getCustomerSends = (slug) => j(`/api/customers2/${encodeURIComponent(slug)}/sends`);
export const recordSend = (deckId, payload) =>
  jpost(`/api/decks/${deckId}/sends`, payload);
export const createCustomer2 = (payload) => jpost("/api/customers2", payload);

// === accounts + audit (Deck Studio cloud) ===================================
export const getAccounts = () => j("/api/accounts");
export const updateAccount = (id, patch) =>
  j(`/api/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
export const createAccount = (payload) => jpost("/api/accounts", payload);
export const resetAccountPassword = (id, password) =>
  jpost(`/api/accounts/${id}/password`, { password });
export const getAudit = (params = {}) =>
  j("/api/audit?" + new URLSearchParams(params).toString());

// === the deck builder (Deck Studio 3) =======================================
// The chapter set + every slide's pickable state, from the backend mirrors, so
// this works hosted as well as locally.
export const getLibraryChapters = () => j("/api/library/chapters");
// Archive demotes a slide from the picker. It is NOT the repo's `retired` flag:
// the app never writes library/. `check-drift.py --apply-archives` promotes it.
export const archiveSlide = (slideId, archived, note = "") =>
  jpost(`/api/library/slides/${encodeURIComponent(slideId)}/archive`, { archived, note });
// Build a deck from a chapter recipe. Runs the CLI pipeline, so verify blocks.
// Returns { job_id } immediately: the pipeline is five real gates over 30-60
// seconds, and watching them arrive is the difference between a progress bar
// and a disabled button.
export const startRecipeBuild = (recipe) => jpost("/api/build", recipe);
export const getBuildJob = (jobId) => j(`/api/build/${encodeURIComponent(jobId)}`);

// Everything the builder needs to open a deck: published picks, unpublished
// draft, and the facts a new version inherits and may not change.
export const getDeckRecipe = (id) => j(`/api/decks/${id}/recipe`);

// The working recipe, saved server-side so composing survives a reload and is
// not trapped in one browser. Never a version: publishing is what makes one.
export const getDeckDraft = (id) => j(`/api/decks/${id}/draft`);
export const putDeckDraft = (id, draft) =>
  j(`/api/decks/${id}/draft`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }),
  });
export const clearDeckDraft = (id) => j(`/api/decks/${id}/draft`, { method: "DELETE" });
