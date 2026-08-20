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

// A view that throws must never fail SILENTLY: before this guard, an exception
// mid-render left the previous page mounted under the new URL, which reads as
// "the button does nothing" — the worst possible error report. The router does
// not own the mount target, so it paints the error into #main directly; crude,
// but crude and visible beats clean and invisible.
function renderError(path, err) {
  console.error(`route ${path} failed:`, err);
  const m = document.getElementById("main");
  if (!m) return;
  m.innerHTML = "";
  const box = document.createElement("div");
  box.className = "empty";
  box.innerHTML = `<p>This page hit an error while rendering.</p><p class="note mono"></p>
    <p class="note">Reload the page; if it keeps happening, this text is the bug report.</p>`;
  box.querySelector(".mono").textContent = `${path}: ${err?.message || err}`;
  m.append(box);
}

export function dispatch() {
  const path = currentPath();
  for (const [rx, handler] of routes) {
    const m = path.match(rx);
    if (!m) continue;
    try {
      const out = handler(...m.slice(1).map(decodeURIComponent));
      // Async views reject later; catch that leg too.
      if (out && typeof out.catch === "function") out.catch((e) => renderError(path, e));
    } catch (e) {
      renderError(path, e);
    }
    return;
  }
  notFound(path);
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
