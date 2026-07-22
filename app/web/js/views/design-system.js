// Design system: render the in-repo specimen index in an iframe, with a link to
// the design philosophy page.

import { el } from "../util.js";

export function render() {
  return el(`
    <div>
      <div class="subbar">
        <h1 class="page-title">Design system</h1>
        <a class="ghost" href="#/knowledge/design" style="margin-left:auto">Design philosophy →</a>
      </div>
      <p class="note">Block specimens rendered from the real stylesheets (<span class="mono">library/design-system/</span>). A new slide composes only from these.</p>
      <iframe class="ds-frame" src="/repo/library/design-system/index.html"></iframe>
    </div>`);
}
