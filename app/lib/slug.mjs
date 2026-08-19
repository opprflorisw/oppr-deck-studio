// Slugs, in one place.
//
// There were five implementations: server.mjs, jobs.mjs, assemble.mjs, mcp.mjs
// and deckstudio.py. Four agreed; mcp.mjs did not — it normalised to NFKD first
// and never stripped leading or trailing hyphens, so the same company registered
// through Claude and through the browser got different slugs ("Café" → cafe vs
// caf, "Rhyze -" → rhyze- vs rhyze). A slug is an identity, and an identity that
// depends on which door you came through is not one.
//
// NFKD is the better behaviour, so it is the one kept: "Café" should be "cafe",
// not "caf". The Python side matches this exactly and is checked by
// app/test/unit/slug.test.mjs against the same table of cases.

/**
 * A URL- and filename-safe identity for a name.
 *
 * Decompose accents and drop the combining marks (so é becomes e rather than
 * disappearing), lowercase, remove anything that is not a word character, space
 * or hyphen, then collapse runs of separators and trim them from both ends.
 */
export function slugify(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // combining marks left by the decomposition
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// What a stored slug is allowed to look like. Anything that fails this never
// reaches a query, a filename or a storage path.
export const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

export const isSlug = (s) => typeof s === "string" && s.length > 0 && s.length <= 100 && SLUG_RE.test(s);

/** Slugify, then refuse the result if it is not usable. Returns "" on failure. */
export function safeSlug(s, max = 80) {
  const out = slugify(s).slice(0, max).replace(/-+$/, "");
  return isSlug(out) ? out : "";
}
