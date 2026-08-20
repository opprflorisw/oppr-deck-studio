// App state: the library index, the backend slice (decks + customers) and the
// library browsing filters.
//
// The old COMPOSE-MODE draft lived here too — a working deck kept in
// localStorage, added to from the slide library through a bottom tray. It was
// removed on 2026-08-20 with the rest of that flow: the builder replaced it, and
// the toggle that switched it on had already been deleted at boot, so nothing
// could reach it. Deck drafts now live in drafts.js (the builder's own store).


export const state = {
  index: null,
  // Deck Studio v3: decks + customers come from the backend (Supabase via the
  // agent), not from index.json. `ok:false` means the backend is unreachable.
  backend: { decks: [], customers: [], ok: true },
  // slideId -> [artifact slug]. Derived from published content, not from
  // disk folders (those are build scratch and get deleted after publish).
  slideUsage: {},
  // cards | table. A remembered "sections" from before the two card views
  // merged falls through to cards, which is what it now is.
  slideView: localStorage.getItem("oppr.slideView") === "table" ? "table" : "cards",
  filter: { role: "", entitlement: "", section: "", q: "" },
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
  // The rail reads the count itself at render time (sidebar.js), so it survives
  // navigation. This only nudges it to redraw once the decks have arrived.
  document.dispatchEvent(new CustomEvent("oppr:backend-loaded"));
  return state.backend;
}

export function setSlideView(v) {
  state.slideView = v;
  localStorage.setItem("oppr.slideView", v);
}

export const slideById = (id) => state.index?.slides.find((s) => s.id === id);
