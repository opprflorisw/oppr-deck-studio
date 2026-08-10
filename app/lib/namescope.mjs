// Which customer names the verify gate watches for, and under which clearance.
//
// This used to be a hardcoded table of ten companies in two places. That made
// registering a customer a half-measure: Rhyze could be added on the Customers
// page, but no deck could be *cleared* for Rhyze and no deck naming Rhyze was
// ever gated, so the newest customers were exactly the ones the leak rule did
// not cover. The customers table drives it now.
//
// The built-in table stays, and is never renamed or removed: published decks
// carry `allowed_entitlements` naming these scopes, and changing a scope slug
// would retroactively fail decks that were correct when they were built. So the
// registered customers are merged ON TOP of it, never over it.
//
// `tools/verifylib.py` implements this identically for the CLI, and
// `tools/check-verify-parity.py` feeds both the same customers and diffs the
// findings, so the two cannot drift.

// One clearance slug per customer (2026-08-01). Historical contract: do not edit.
export const BUILTIN_NAME_SCOPE = {
  mutares: "mutares", holliday: "holliday", venator: "venator",
  attero: "attero", keeeper: "keeeper", omniplast: "omniplast",
  sonneborn: "sonneborn", host: "host", selo: "selo", wavin: "wavin",
};

// Two customer names are ordinary English words, so \bname\b would fail any deck
// containing "the plant that would host it" or "select". Same trade-off as the
// Python side: a bare "HoSt" slips through, which the visual pass can catch,
// rather than a false FAIL that trains people to ignore the gate.
export const BUILTIN_NAME_PATTERN = {
  host: "host\\s*bioenergy",
  selo: "\\bselo\\b(?!ct)",
};

// The same character set Python's re.escape() escapes, so a pattern derived here
// is byte-identical to the one verifylib.build_name_scope derives. Whitespace is
// excluded because the caller splits on it first — escaping a space and then
// substituting the run for \s+ leaves a stray backslash behind, which is exactly
// how these two drifted the first time.
const escapeRx = (s) => s.replace(/[()[\]{}?*+\-|^$\\.&~#]/g, "\\$&");

// The first word of a slug or name, which is how a derived scope is tested for
// collision with a built-in one: the "HoSt Bioenergy" customer row would
// otherwise derive a second scope (`host-bioenergy`) matching the same text the
// built-in `host` scope already claims, and a deck correctly cleared for `host`
// would start failing on a scope it had no way to know about.
const head = (s) => String(s || "").toLowerCase().split(/[-\s]+/)[0];

/**
 * A registered customer's effective clearance slug, or "" when a built-in scope
 * already covers it. This is also what the New deck dialog offers as a
 * clearance, so the chip you can tick and the scope the gate enforces are the
 * same string by construction.
 */
export function clearanceForCustomer(customer) {
  const slug = String(customer?.slug || "").toLowerCase();
  if (!slug) return "";
  if (BUILTIN_NAME_SCOPE[slug]) return BUILTIN_NAME_SCOPE[slug];
  const h = head(slug);
  if (BUILTIN_NAME_SCOPE[h]) return BUILTIN_NAME_SCOPE[h];
  const hn = head(customer?.name);
  if (BUILTIN_NAME_SCOPE[hn]) return BUILTIN_NAME_SCOPE[hn];
  return slug;
}

/**
 * The pattern a registered customer's name would be gated by, or "" when a
 * built-in scope already claims it (and therefore already has a hand-tuned
 * pattern that must not be replaced).
 *
 * Split out so the COLLISION GUARD and the GATE derive the pattern from one
 * piece of code. Registering a customer creates a gated term, so a customer
 * called "Core" would make `\bcore\b` a failing word and retroactively break
 * every deck using it. The guard dry-runs this pattern against published decks
 * before accepting the name; if it derived the pattern separately from
 * buildNameScope, the prediction and the enforcement could disagree, which is
 * the whole failure mode this file exists to prevent.
 */
export function patternForCustomer(customer) {
  const scope = clearanceForCustomer(customer);
  if (!scope || BUILTIN_NAME_SCOPE[scope]) return "";
  // Match the company NAME as it would be written on a slide, not the slug:
  // "HoSt Bioenergy" is written with a space, and a slug never appears in copy.
  const label = String(customer?.name || customer?.slug || "").trim().toLowerCase();
  if (!label) return "";
  return `\\b${label.split(/\s+/).map(escapeRx).join("\\s+")}\\b`;
}

/**
 * The scopes the gate enforces: the built-in table, plus one entry per
 * registered customer not already covered by it.
 * @returns {Array<{name: string, scope: string, pattern: string}>}
 */
export function buildNameScope(customers = []) {
  const out = [];
  for (const [name, scope] of Object.entries(BUILTIN_NAME_SCOPE)) {
    out.push({ name, scope, pattern: BUILTIN_NAME_PATTERN[name] || `\\b${escapeRx(name)}\\b` });
  }
  const seen = new Set(out.map((e) => e.scope));
  for (const c of customers || []) {
    const scope = clearanceForCustomer(c);
    if (!scope || seen.has(scope)) continue;   // built-in wins, and never twice
    const pattern = patternForCustomer(c);
    if (!pattern) continue;
    out.push({ name: scope, scope, pattern });
    seen.add(scope);
  }
  return out;
}
