// Proving who an MCP caller is (Deck Studio cloud, 2026-08-07).
//
// The browser sends a Supabase session token and `auth.mjs` resolves it by ASKING
// Supabase (`/auth/v1/user`), which is right there: a revoked session stops
// working immediately rather than at token expiry, and the round trip is cheap
// next to an editor's burst of calls.
//
// An MCP caller is different in one way that matters: its token arrives from an
// OAuth 2.1 flow, and the MCP specification is explicit that a resource server
// MUST verify the token was issued FOR IT -- signature, issuer, expiry and
// audience -- and MUST NOT accept or forward a token minted for somebody else.
// That is the confused-deputy hole, and it cannot be checked by asking "is this
// a valid Supabase user"; a token for any other Supabase app would pass that.
//
// So this module verifies the JWT itself against the project's JWKS. Supabase
// signs with ES256 (asymmetric), so the public key is enough and no secret is
// shared. Node's crypto imports a JWK directly, which is why this needs no new
// dependency -- the whole app has three, all for rendering.

import crypto from "node:crypto";
import { supabaseUrl } from "./env.mjs";

// --- JWKS, cached ------------------------------------------------------------
//
// Keys rotate rarely and a fetch per request would put a network round trip in
// front of every tool call. A miss on `kid` busts the cache once, so a rotation
// is picked up without waiting out the TTL.
const JWKS_TTL_MS = 10 * 60_000;
let jwksCache = { at: 0, keys: [] };

async function jwks(force = false) {
  if (!force && Date.now() - jwksCache.at < JWKS_TTL_MS && jwksCache.keys.length) {
    return jwksCache.keys;
  }
  const r = await fetch(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`);
  if (!r.ok) throw new Error(`jwks fetch failed: ${r.status}`);
  const body = await r.json();
  jwksCache = { at: Date.now(), keys: body.keys || [] };
  return jwksCache.keys;
}

const b64urlToBuf = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const jsonPart = (s) => JSON.parse(b64urlToBuf(s).toString("utf-8"));

// ES256 signatures are raw r||s (JOSE), not DER, hence `dsaEncoding`. Getting
// this wrong fails every signature with no useful error, so it is spelled out.
const ALGS = {
  ES256: { hash: "sha256", opts: { dsaEncoding: "ieee-p1363" } },
  ES384: { hash: "sha384", opts: { dsaEncoding: "ieee-p1363" } },
  RS256: { hash: "sha256", opts: {} },
  RS512: { hash: "sha512", opts: {} },
};

/**
 * Verify a JWT against the project JWKS and return its claims, or null.
 *
 * Deliberately returns null rather than throwing: every caller turns a failure
 * into the same 401 challenge, and an exception path invites a `catch` that
 * accidentally continues.
 */
export async function verifyJwt(token) {
  if (!token || token.split(".").length !== 3) return null;
  const [h, p, s] = token.split(".");

  let header, claims;
  try { header = jsonPart(h); claims = jsonPart(p); }
  catch { return null; }

  const alg = ALGS[header.alg];
  if (!alg) return null;                       // never trust `none`, never guess

  let keys = await jwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {                                   // possible rotation: one retry
    keys = await jwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  let ok = false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    ok = crypto.verify(alg.hash, Buffer.from(`${h}.${p}`), { key, ...alg.opts }, b64urlToBuf(s));
  } catch { return null; }
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp <= now) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;

  // The issuer must be THIS project. Without it, a validly-signed token from any
  // other Supabase project whose JWKS we happened to fetch would pass.
  const wantIss = `${supabaseUrl()}/auth/v1`;
  if (claims.iss && claims.iss !== wantIss) return null;

  return claims;
}

/**
 * Does this token's audience permit it to be spent HERE?
 *
 * The spec says: reject tokens that do not name this resource in `aud`. Supabase
 * has historically issued user tokens with `aud: "authenticated"`, and whether
 * its OAuth 2.1 server honours the RFC 8707 `resource` parameter and sets `aud`
 * to the resource URL could not be verified while that server was disabled.
 *
 * So this is written to be STRICT the moment Supabase gives us something strict
 * to check, and to fail closed rather than silently accept anything in the
 * meantime. `MCP_REQUIRE_AUDIENCE=0` is the documented escape hatch for the
 * interim, and it is opt-in precisely so nobody discovers later that audience
 * checking was never on.
 */
export function audienceOk(claims, resourceUrl) {
  const aud = claims?.aud;
  const list = Array.isArray(aud) ? aud : (aud ? [aud] : []);
  if (list.includes(resourceUrl)) return true;

  // Supabase's generic audience. Accepting it means trusting "a valid user of
  // THIS project" rather than "a token minted for this resource" -- weaker, but
  // still project-scoped because `iss` was already checked above.
  const lenient = process.env.MCP_REQUIRE_AUDIENCE === "0";
  if (lenient && list.includes("authenticated")) return true;

  return false;
}

/**
 * The RFC 9728 Protected Resource Metadata document.
 *
 * `resource` must equal the URL the user typed into Claude, path included, or
 * the client refuses the pairing. Claude reads only the FIRST entry of
 * `authorization_servers`.
 */
export function protectedResourceMetadata(baseUrl) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [`${supabaseUrl()}/auth/v1`],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "email", "profile"],
  };
}

/**
 * The `WWW-Authenticate` value for a 401.
 *
 * This header on a 401 is the ONLY thing that makes Claude start an OAuth flow
 * and show a Connect button. A 200 carrying `isError: true` and the words
 * "please sign in" is handed to the model as an ordinary tool result, and the
 * user simply reads an apology instead of being offered a way in. That is the
 * single most common way one of these servers fails, so it is stated here rather
 * than left to whoever writes the next route.
 */
export function challenge(baseUrl, error = "invalid_token", description = "Authentication required") {
  return `Bearer error="${error}", error_description="${description}", ` +
         `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp", ` +
         `scope="openid email"`;
}
