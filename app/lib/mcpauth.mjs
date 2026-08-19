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
  // Both claims are REQUIRED, not merely honoured when present. Checking them
  // only `if (typeof … === "number")` meant a token that simply omitted `exp`
  // never expired, and one that omitted `iss` skipped the issuer test -- the two
  // checks whose whole purpose is to bound a token in time and origin, disabled
  // by leaving them out. This file's premise is fail-closed; absent is not pass.
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  if (typeof claims.nbf === "number" && claims.nbf > now + 60) return null;

  // The issuer must be THIS project. Without it, a validly-signed token from any
  // other Supabase project whose JWKS we happened to fetch would pass.
  const wantIss = `${supabaseUrl()}/auth/v1`;
  if (claims.iss !== wantIss) return null;

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

  // The strict reading, kept first so it starts working the day Supabase honours
  // the `resource` parameter without anyone having to remember this file.
  if (list.includes(resourceUrl)) return true;

  // MEASURED 2026-08-10, not assumed: Supabase's OAuth 2.1 server IGNORES the
  // RFC 8707 `resource` parameter. A full authorization_code flow passing
  // `resource` on both /authorize and /token still returns aud="authenticated".
  // So the audience check the MCP spec asks for is not available here, and
  // demanding it rejects every real token -- which is a 401 loop, not security.
  //
  // `client_id` is what recovers most of it. It appears ONLY on a token minted
  // through the OAuth server for a registered client that a person consented to;
  // an ordinary browser session token (the kind the app itself holds, and the
  // kind that would leak from localStorage) carries session_id/aal/amr and no
  // client_id at all. So a session token still cannot be spent here, which is
  // the substance of what the audience check was protecting.
  //
  // What this does NOT prove is that the token was minted for THIS resource
  // rather than another client of the same project. That residual gap closes
  // when Supabase honours `resource`; until then the gate is: valid signature,
  // this issuer, an OAuth-issued token, and an active @oppr.ai member.
  if (list.includes("authenticated") && claims?.client_id) return true;

  // Last resort for an identity provider that offers neither: opt-in, so nobody
  // discovers later that audience checking was quietly off.
  if (process.env.MCP_REQUIRE_AUDIENCE === "0" && list.includes("authenticated")) return true;

  return false;
}

/**
 * Why a token was refused, in words a person can act on.
 *
 * Without this an audience rejection and a missing token produce the identical
 * 401, so a token that is perfectly valid but carries Supabase's generic
 * `aud: "authenticated"` sends Claude round the OAuth loop forever with nothing
 * to read. Supabase's OAuth server could not be reached to confirm which
 * audience it issues (it is disabled on this project), so the case is named
 * rather than assumed.
 */
export function refusalReason(claims) {
  if (!claims) return "Authentication required";
  const aud = Array.isArray(claims.aud) ? claims.aud.join(",") : String(claims.aud || "");
  return `Token audience "${aud}" is not this MCP server. ` +
         `If your identity provider cannot set it, run with MCP_REQUIRE_AUDIENCE=0.`;
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
