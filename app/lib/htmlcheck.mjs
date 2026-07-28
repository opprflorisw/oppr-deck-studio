// Structural fingerprint + save validation (Deck Studio v3, §3).
//
// The editor's three verbs (text, style nudge, image swap) all preserve the
// document's STRUCTURE: they change text content, the `style` attribute, and
// an <img> src value, nothing else. A save is legitimate only if the tag +
// structural-attribute stream is byte-identical to the version it edits. This
// runs on the server so the boundary never depends on the browser behaving.
//
// Zero-dependency: no DOM in Node. A regex tag-walker over `<[^>]+>` that skips
// the contents of <style>, <script>, and comments (their innards are not deck
// structure — inlined CSS and the deck-meta manifest).

const STRUCTURAL_ATTR_VALUES = ["class", "data-slide-id", "data-role", "data-slot"];
const PRESENCE_ATTRS = ["src", "href"];

// HTML void elements: serialized with no closing tag by both Python and the
// browser, so a self-closing slash on them contributes no close token.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"]);

// Remove regions whose contents are not structural.
function stripInert(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "<style></style>")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>");
}

function parseAttrs(tagBody) {
  // tagBody: everything after the tag name inside <...>
  const attrs = {};
  const re = /([a-zA-Z_][\w:-]*)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?/g;
  let m;
  while ((m = re.exec(tagBody))) {
    if (!m[1]) continue;
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  }
  return attrs;
}

export function fingerprint(html) {
  const doc = stripInert(html);
  const tokens = [];
  // Lazy attribute body so a trailing self-close slash lands in group 4, not the
  // attributes. Both server-generated (Python) and browser-serialized HTML must
  // fingerprint identically, so we normalize the two ways they legitimately
  // differ: (1) self-closed SVG elements (<circle/>) which the browser expands to
  // <circle></circle>, and (2) <tbody> which the browser auto-inserts into tables.
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m;
  while ((m = re.exec(doc))) {
    const [, closing, name, body, selfClose] = m;
    const tag = name.toLowerCase();
    if (tag === "tbody") continue; // auto-inserted; not authored structure
    if (tag === "style" || tag === "script") {
      tokens.push(closing ? `/${tag}` : tag);
      continue;
    }
    if (closing) { tokens.push(`/${tag}`); continue; }
    const attrs = parseAttrs(body);
    const names = Object.keys(attrs).filter((a) => a !== "style").sort();
    const parts = [tag, "{" + names.join(",") + "}"];
    for (const a of STRUCTURAL_ATTR_VALUES) {
      if (a in attrs) parts.push(`${a}=${attrs[a]}`);
    }
    for (const a of PRESENCE_ATTRS) {
      if (a in attrs) parts.push(`${a}?`);
    }
    tokens.push(parts.join("|"));
    // a self-closed non-void element serializes as <tag></tag> in the browser
    if (selfClose === "/" && !VOID.has(tag)) tokens.push(`/${tag}`);
  }
  return tokens.join("\n");
}

// Validate a proposed save of `next` over the stored `prev`.
// knownAssets: Set of "assets/<file>" the deck already has (image-swap must
// register the new asset BEFORE the save lands). Returns {ok:true} or
// {ok:false, error, code}.
export function validateSave(prev, next, knownAssets = null) {
  if (typeof next !== "string" || !next.trim()) {
    return { ok: false, error: "empty document", code: "empty" };
  }
  if (Buffer.byteLength(next, "utf-8") > 3_000_000) {
    return { ok: false, error: "document too large (>3 MB)", code: "too-large" };
  }
  // Em dash / placeholder checks run on VISIBLE prose only: the inlined brand
  // CSS legitimately contains em dashes in its comments, and the deck-meta
  // <script> holds the title — neither is deck output the reader sees.
  const visible = stripInert(next);
  if (visible.includes("—") || visible.includes("&mdash;")) {
    return { ok: false, error: "em dash present (use an en dash)", code: "em-dash" };
  }
  if (/\{\{\s*[\w-]+\s*\}\}/.test(visible)) {
    return { ok: false, error: "unfilled {{placeholder}} present", code: "unfilled" };
  }
  // No <script> other than the deck-meta manifest.
  const scripts = next.match(/<script\b[^>]*>/gi) || [];
  for (const s of scripts) {
    if (!/id="deck-meta"/.test(s)) {
      return { ok: false, error: "unexpected <script> in the document", code: "script" };
    }
  }
  // Structure must be identical.
  if (fingerprint(prev) !== fingerprint(next)) {
    return { ok: false, error: "structural change — rebuild this slide via the CLI", code: "structural" };
  }
  // Every assets/ reference must be a known asset of this deck.
  if (knownAssets) {
    const refs = new Set();
    let m;
    const re = /(?:src|href)="(assets\/[^"]+)"/g;
    while ((m = re.exec(next))) refs.add(m[1]);
    const urlRe = /url\(["']?(assets\/[^"')]+)["']?\)/g;
    while ((m = urlRe.exec(next))) refs.add(m[1]);
    for (const ref of refs) {
      if (!knownAssets.has(ref)) {
        return { ok: false, error: `unknown asset ${ref}`, code: "unknown-asset" };
      }
    }
  }
  return { ok: true };
}
