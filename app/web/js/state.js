// App + draft state, with localStorage persistence for the working draft.

import { ENTITLEMENT_RANK } from "./util.js";

export const state = {
  index: null,
  composeMode: false,
  slideView: localStorage.getItem("oppr.slideView") || "cards", // cards | sections | table
  filter: { role: "", entitlement: "", section: "", q: "" },
  draft: loadDraft(),
};

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

export function draftClearanceRank() {
  return ENTITLEMENT_RANK[state.draft.intent.entitlement || "public"] ?? 0;
}
export function slideExceedsClearance(entitlement) {
  return (ENTITLEMENT_RANK[entitlement] ?? 0) > draftClearanceRank();
}

export function addSlide(id) {
  const s = slideById(id);
  if (!s) return;
  state.draft.slides.push({ source: "library", id: s.id, role: s.role, title: s.title, thumb: s.thumb, comment: "" });
  saveDraftLocal();
}
