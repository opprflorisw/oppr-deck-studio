// Thin fetch wrappers around the server API.

async function j(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const getIndex = () => j("/api/index");
export const refresh = () => j("/api/refresh", { method: "POST" });

export const listDrafts = () => j("/api/drafts");
export const getDraft = (slug) => j(`/api/drafts/${encodeURIComponent(slug)}`);
export const putDraft = (slug, data) =>
  j(`/api/drafts/${encodeURIComponent(slug)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
export const deleteDraft = (slug) =>
  j(`/api/drafts/${encodeURIComponent(slug)}`, { method: "DELETE" });

export const slideHistory = (id) => j(`/api/history/slide/${encodeURIComponent(id)}`);
export const slideVersion = (id, hash) =>
  fetch(`/api/history/slide/${encodeURIComponent(id)}/${encodeURIComponent(hash)}`).then((r) => r.text());

export const importGraphics = (payload) =>
  j("/api/import-graphics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export const listSocialDrafts = () => j("/api/social-drafts");
export const getSocialDraft = (slug) => j(`/api/social-drafts/${encodeURIComponent(slug)}`);
export const putSocialDraft = (slug, data) =>
  j(`/api/social-drafts/${encodeURIComponent(slug)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const deleteSocialDraft = (slug) => j(`/api/social-drafts/${encodeURIComponent(slug)}`, { method: "DELETE" });

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
const txt = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error("not found"); return r.text(); });

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
  fetch(`/api/knowledge/${path.split("/").map(encodeURIComponent).join("/")}`).then((r) => {
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
  fetch(`/api/decks/${id}/versions/${n}/html`).then((r) => { if (!r.ok) throw new Error("no version"); return r.text(); });
export const deckViewUrl = (id, n) => `/api/decks/${id}/versions/${n}/view`;
export const deckPdfUrl = (id, n) => `/api/decks/${id}/versions/${n}/pdf`;
export const saveDeckVersion = (id, html, change_note) => jpost(`/api/decks/${id}/versions`, { html, change_note });
export const restoreDeckVersion = (id, n) => jpost(`/api/decks/${id}/restore`, { n });
export const setDeckMaster = (id, is_master) => jpost(`/api/decks/${id}/master`, { is_master });
export const registerDeckAsset = (id, source, cache_version) => jpost(`/api/decks/${id}/assets`, { source, cache_version });
export const personalizeDeck = (id, payload) => jpost(`/api/decks/${id}/personalize`, payload);
export const buildDeck = (id) => jpost(`/api/decks/${id}/build`, {});
export const renameDeck = (id, patch) =>
  j(`/api/decks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });

// Download the PDF for a version. The server prints on demand when the version
// has no PDF yet, so what arrives always matches what is on screen. A verify
// FAIL comes back as 409 with the report; the caller decides whether to offer
// the explicit unverified download.
export async function downloadDeckPdf(id, n, { unverified = false } = {}) {
  const url = `/api/decks/${id}/versions/${n}/pdf${unverified ? "?unverified=1" : ""}`;
  const res = await fetch(url);
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
export const createCustomer2 = (payload) => jpost("/api/customers2", payload);
