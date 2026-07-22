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

export const getKnowledgeTree = () => j("/api/knowledge");
export const getKnowledgeFile = (path) =>
  fetch(`/api/knowledge/${path.split("/").map(encodeURIComponent).join("/")}`).then((r) => {
    if (!r.ok) throw new Error("not found");
    return r.text();
  });
