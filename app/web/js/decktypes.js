// The deck types, named and ordered in one place.
//
// Before this the index split decks into "Masters" and "Company decks", which
// described how they were tagged rather than what they are. In practice the
// company decks ARE the masters: one reusable deck per type, and everything else
// is a copy made for a named customer. So there are two kinds of deck, not three:
//
//   COMPANY DECKS   one per type, reusable, the thing you copy from
//   CUSTOMER DECKS  a copy made for one named customer
//
// The order below is the order they appear in, and it runs the way a
// conversation does: the shortest first-touch deck first, the fullest last.
//
// `type` on a deck row is still free text (a deck published before a type
// existed keeps whatever it had). Anything not listed here still shows, under
// its own raw type, at the end. This registry decides presentation, never what
// the backend will accept.

export const DECK_TYPES = [
  {
    id: "teaser",
    label: "Teaser",
    blurb: "The shortest cut. Enough to earn thirty minutes.",
  },
  {
    id: "management-outlook",
    label: "Management Outlook",
    blurb: "For the people who decide, at the level they decide at.",
  },
  {
    id: "product-showcase",
    label: "Product Showcase",
    blurb: "What the product actually is, shown rather than described.",
  },
  {
    id: "engagement",
    label: "How we work together",
    blurb: "The proposal: the Analyze, the Proof of Value and what each costs.",
  },
  {
    id: "customer",
    label: "Customer deck (generic)",
    blurb: "The starting point for a named customer. Copy it, then make it theirs.",
  },
  {
    id: "investor",
    label: "Investor deck",
    blurb: "The company, for people funding it rather than buying from it.",
  },
];

const BY_ID = new Map(DECK_TYPES.map((t) => [t.id, t]));

export const typeLabel = (id) => BY_ID.get(id)?.label || id || "No type";
export const typeBlurb = (id) => BY_ID.get(id)?.blurb || "";
export const knownType = (id) => BY_ID.has(id);

// Registry order first; anything unrecognised keeps its place at the end rather
// than disappearing, because an unlisted type is a deck someone still owns.
export function typeRank(id) {
  const i = DECK_TYPES.findIndex((t) => t.id === id);
  return i === -1 ? DECK_TYPES.length : i;
}

// A deck belongs to a customer when it was made for one. `audience_kind` is the
// deliberate signal; `client_slug` is the fallback for decks published before
// the audience field existed, so a customer deck never lands in the wrong list
// just because it predates the model.
export const isCustomerDeck = (d) =>
  d.audience_kind === "customer" || Boolean(d.client_slug);
