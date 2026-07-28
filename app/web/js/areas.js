// The top-level areas of the customer-first app. Pure metadata (no view imports)
// so both the sidebar and the router can read it. Each area is one icon button in
// the sidebar. Tabbed areas render their sub-views as top tabs (each with its own
// icon); an area with no `tabs` is a single page (Customers, Decks).
//
// Decks and Social output used to share one "Output" area, which buried both a
// tab deep and left no room to split social by what the piece actually is. They
// are now siblings in the sidebar, and Social output's tabs are its categories.

export const AREAS = [
  { id: "customers", title: "Customers", icon: "building", home: true },
  { id: "decks", title: "Decks", icon: "monitor" },
  { id: "social", title: "Social output", icon: "share", tabs: [
    { id: "all", label: "All", icon: "layers" },
    { id: "carousel", label: "Carousels", icon: "cards" },
    { id: "job-description", label: "Job descriptions", icon: "building" },
    { id: "post", label: "Posts", icon: "text" },
  ]},
  { id: "library", title: "Library", icon: "layers", tabs: [
    { id: "slides", label: "Slides", icon: "cards" },
    { id: "graphics", label: "Graphics", icon: "image" },
    { id: "icons", label: "Icons", icon: "spark" },
    { id: "design-system", label: "Design system", icon: "grid" },
  ]},
  { id: "knowledge", title: "Knowledge", icon: "book", tabs: [
    { id: "philosophy", label: "Design philosophy", icon: "bulb" },
    { id: "best-practices", label: "Best practices", icon: "info" },
    { id: "recipes", label: "Recipes", icon: "text" },
    { id: "config", label: "Config", icon: "settings" },
  ]},
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
