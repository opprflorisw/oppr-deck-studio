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

export function go(path) {
  if (current() === path) dispatch();
  else location.hash = path;
}

export function dispatch() {
  const path = current();
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
