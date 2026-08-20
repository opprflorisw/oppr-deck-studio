// Unpublished new decks, kept in this browser.
//
// A deck that has never been published has no row in the backend, so its
// working recipe has nowhere in the backend to live. It stays here until the
// first publish gives it a row; after that the draft is the deck's own
// `draft_recipe` and this store is not involved.
//
// Its own module because two places need to read it and neither should have to
// import the other: the builder writes drafts, and the Decks page lists them.
// The list used to live on a second page of its own, which is exactly the
// duplicate the Decks page already was.

const KEY = "oppr.builder.drafts.v3";

export function localDrafts() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}

export function writeLocalDrafts(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
}

export function dropLocalDraft(id) {
  const all = localDrafts();
  delete all[id];
  writeLocalDrafts(all);
}

// Newest first, as [id, draft] pairs — the order both readers want.
export function draftList() {
  return Object.entries(localDrafts())
    .sort((a, b) => String(b[1].saved_at || "").localeCompare(String(a[1].saved_at || "")));
}
