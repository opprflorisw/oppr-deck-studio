// The top-level areas of the customer-first app. Pure metadata (no view imports)
// so both the sidebar and the router can read it. Each area is one icon button in
// the sidebar. Tabbed areas render their sub-views as top tabs (each with its own
// icon); an area with no `tabs` is a single page (Customers, Decks).
//
// Decks and Social output used to share one "Output" area, which buried both a
// tab deep and left no room to split social by what the piece actually is. They
// are now siblings in the sidebar, and Social output's tabs are its categories.

// The nav is grouped by what you are doing, not by what the code calls things.
// A flat list of seven made Accounts sit next to Knowledge as if they were the
// same kind of thing; they are not. Work you ship is on top, the system it is
// built from is in the middle, and the two administrative pages are pinned to
// the bottom where a settings drawer belongs.
//
// `group` names the section a sidebar area belongs to; `foot: true` moves it to
// the pinned bottom block. Both are read only by the sidebar — the router does
// not care.
export const NAV_GROUPS = [
  { id: "work", title: "Work" },
  { id: "system", title: "System" },
];

export const AREAS = [
  { id: "customers", title: "Customers", icon: "building", home: true, group: "work" },
  { id: "decks", title: "Decks", icon: "monitor", group: "work" },
  { id: "build", title: "Deck builder", icon: "compose", group: "work" },
  { id: "social", title: "Social output", icon: "share", group: "work", tabs: [
    { id: "all", label: "All", icon: "layers" },
    { id: "carousel", label: "Carousels", icon: "cards" },
    { id: "job-description", label: "Job descriptions", icon: "building" },
    { id: "post", label: "Posts", icon: "text" },
  ]},
  { id: "research", title: "Last 30 days", icon: "brain", group: "work", tabs: [
    { id: "brain", label: "Brain", icon: "brain" },
    { id: "runs", label: "Runs", icon: "history" },
    { id: "posts", label: "Ideas", icon: "bulb" },
    { id: "performance", label: "Performance", icon: "spark" },
  ]},
  // The design kit spans three of the Library's tabs (icons, design system,
  // brand), so it belongs to the AREA rather than to any one of them.
  { id: "library", title: "Library", icon: "layers", group: "system",
    action: {
      label: "Design kit",
      icon: "download",
      href: "/repo/library/kit/oppr-design-kit.zip",
      download: "oppr-design-kit.zip",
      title: "Icons, the design system and the brand kit in one self-contained zip, with an offline viewer. Built by tools/build-library-kit.py.",
    },
    tabs: [
    { id: "slides", label: "Slides", icon: "cards" },
    { id: "graphics", label: "Graphics", icon: "image" },
    { id: "icons", label: "Icons", icon: "spark" },
    { id: "design-system", label: "Design system", icon: "grid" },
    { id: "brand", label: "Brand", icon: "brandmark" },
  ]},
  { id: "knowledge", title: "Knowledge", icon: "book", group: "system", tabs: [
    { id: "philosophy", label: "Design philosophy", icon: "bulb" },
    { id: "best-practices", label: "Best practices", icon: "info" },
    { id: "recipes", label: "Recipes", icon: "text" },
  ]},
  // The bottom block: who can get in, and how the studio is wired. Neither is
  // something you open to do the work, which is why neither is in the flow above.
  { id: "accounts", title: "Accounts", icon: "person", foot: true },
  { id: "settings", title: "Settings", icon: "settings", foot: true },
];

export const areaById = (id) => AREAS.find((a) => a.id === id);

// The path to open an area. A home area has no tabs → its bare path; a tabbed area
// reopens on its remembered tab (falling back to the first).
export function areaPath(area) {
  if (!area.tabs) return `/${area.id}`;
  const last = localStorage.getItem("oppr.tab." + area.id);
  const valid = area.tabs.some((t) => t.id === last);
  return `/${area.id}/${valid ? last : area.tabs[0].id}`;
}
