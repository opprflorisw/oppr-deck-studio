// Minimal hash router. Routes are registered as [regex, handler(...groups)].

const routes = [];
let notFound = () => {};

export function route(pattern, handler) {
  // pattern like "/slides/:id" -> regex with named-ish groups
  const rx = new RegExp("^" + pattern.replace(/:[^/]+/g, "([^/]+)").replace(/\//g, "\\/") + "$");
  routes.push([rx, handler]);
}

export function setNotFound(fn) { notFound = fn; }

export function current() {
  return location.hash.replace(/^#/, "") || "/slides";
}

// The path a route matches against, without the query. A route pattern is a
// path, so matching the raw hash meant `#/customers/new?for=rhyze` missed the
// literal `/customers/new` route and fell through to `/customers/:slug` with a
// slug of `new?for=rhyze` — which is what made every "New deck" button on a
// customer page land on "No such customer".
export const currentPath = () => current().split("?")[0];

// The query a view reads its arguments from (`?for=<customer>`).
export const query = () => new URLSearchParams(current().split("?")[1] || "");

export function go(path) {
  if (current() === path) dispatch();
  else location.hash = path;
}

export function dispatch() {
  const path = currentPath();
  for (const [rx, handler] of routes) {
    const m = path.match(rx);
    if (m) return handler(...m.slice(1).map(decodeURIComponent));
  }
  notFound(path);
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
