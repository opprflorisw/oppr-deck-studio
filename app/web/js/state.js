// App + draft state, with localStorage persistence for the working draft.


export const state = {
  index: null,
  // Deck Studio v3: decks + customers come from the backend (Supabase via the
  // agent), not from index.json. `ok:false` means the backend is unreachable.
  backend: { decks: [], customers: [], ok: true },
  // slideId -> [artifact slug]. Derived from published content, not from
  // disk folders (those are build scratch and get deleted after publish).
  slideUsage: {},
  composeMode: false,
  slideView: localStorage.getItem("oppr.slideView") || "cards", // cards | sections | table
  filter: { role: "", entitlement: "", section: "", q: "" },
  draft: loadDraft(),
};

export const deckById = (id) => state.backend.decks.find((d) => d.id === id);
export const customerById = (id) => state.backend.customers.find((c) => c.id === id);

// Refresh the backend slice; sets ok=false if the agent/back end is offline.
export async function loadBackend(api) {
  try {
    const [decks, customers, usage] = await Promise.all([
      api.getDecks(), api.getCustomers2(), api.getSlideUsage().catch(() => ({ usage: {} })),
    ]);
    state.backend = { decks: decks.decks || [], customers: customers.customers || [], ok: true };
    state.slideUsage = usage.usage || {};
  } catch {
    state.backend = { decks: [], customers: [], ok: false };
    state.slideUsage = {};
  }
  return state.backend;
}

export function blankDraft() {
  return {
    slug: "", title: "", type: "",
    intent: { audience: "", client: "", language: "en", entitlement: "public", goal: "", presenter: "" },
    vars: { deck_footer: "", cover_meta: "" },
    slides: [],
    source_deck: null,
  };
}

export function loadDraft() {
  try { return { ...blankDraft(), ...JSON.parse(localStorage.getItem("oppr.draft") || "{}") }; }
  catch { return blankDraft(); }
}

export function saveDraftLocal() {
  localStorage.setItem("oppr.draft", JSON.stringify(state.draft));
  updateDraftCount();
}

export function setDraft(d) {
  state.draft = { ...blankDraft(), ...d };
  saveDraftLocal();
}

export function updateDraftCount() {
  const n = state.draft.slides.length;
  document.querySelectorAll("[data-draft-count]").forEach((e) => (e.textContent = n));
}

export function setSlideView(v) {
  state.slideView = v;
  localStorage.setItem("oppr.slideView", v);
}

export const slideById = (id) => state.index?.slides.find((s) => s.id === id);

// Clearance is per customer (2026-08-01), not a rank. It used to be a rank, and
// that quietly stopped working the moment `named-customer` was split into one
// slug per customer: Holliday and Attero were both rank 1, so `1 > 1` was false
// and a Holliday-cleared draft would happily accept Attero material. `public` is
// always allowed; every other slug needs an exact match.
export function slideExceedsClearance(entitlement) {
  const want = entitlement || "public";
  if (want === "public") return false;
  return want !== (state.draft.intent.entitlement || "public");
}

export function addSlide(id) {
  const s = slideById(id);
  if (!s) return;
  state.draft.slides.push({ source: "library", id: s.id, role: s.role, title: s.title, thumb: s.thumb, comment: "" });
  saveDraftLocal();
}
