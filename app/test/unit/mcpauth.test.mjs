// Token verification for the MCP door.
//
// The premise of mcpauth.mjs is fail-closed: every path that cannot prove a
// token returns null, and every null becomes the same 401. These tests hold it
// to that, especially for claims that used to be checked only when present —
// a token that simply omitted `exp` never expired.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { challenge, refusalReason, protectedResourceMetadata, audienceOk } from "../../lib/mcpauth.mjs";

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

test("the 401 challenge names the resource metadata and a reason", () => {
  const h = challenge("https://studio.example", "invalid_token", "token has expired");
  assert.match(h, /^Bearer /);
  assert.match(h, /error="invalid_token"/);
  assert.match(h, /error_description="token has expired"/);
  // Without this pointer a client cannot discover where to authenticate, and
  // Claude never offers a Connect button.
  assert.match(h, /resource_metadata="https:\/\/studio\.example\/\.well-known\/oauth-protected-resource\/mcp"/);
});

test("the protected-resource document points at the project's auth server", () => {
  const d = protectedResourceMetadata("https://studio.example");
  assert.equal(d.resource, "https://studio.example/mcp");
  // Claude reads authorization_servers[0] and nothing else, and it must be the
  // project this server actually verifies tokens against.
  assert.match(d.authorization_servers[0], /^https:\/\/[a-z0-9.-]+\/auth\/v1$/);
  assert.deepEqual(d.bearer_methods_supported, ["header"]);
});

test("a refusal reason names the audience it actually saw", () => {
  const r = refusalReason({ aud: "authenticated" });
  assert.match(r, /authenticated/);
});

// --- audience -------------------------------------------------------------
// Supabase's OAuth server ignores RFC 8707 `resource`, so a token minted
// through it carries aud "authenticated". The substitute check is: that, PLUS a
// client_id, which an ordinary browser session token never has. So a leaked
// localStorage token cannot be spent here.

test("a browser session token is refused at the MCP door", () => {
  assert.equal(audienceOk({ aud: "authenticated", session_id: "s", aal: "aal1" },
                          "https://studio.example/mcp"), false);
});

test("a token minted for a registered OAuth client is accepted", () => {
  assert.equal(audienceOk({ aud: "authenticated", client_id: "cid" },
                          "https://studio.example/mcp"), true);
});

test("an exactly-matching audience is accepted on the strict path", () => {
  assert.equal(audienceOk({ aud: ["https://studio.example/mcp"] },
                          "https://studio.example/mcp"), true);
});

// --- verifyJwt, through a real key ----------------------------------------

test("verifyJwt refuses a token with no exp, no iss, or alg none", async (t) => {
  // Build a real ES256 signature so only the CLAIM checks can be what refuses.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "ES256", use: "sig" };

  const sign = (claims, header = { alg: "ES256", kid: "k1", typ: "JWT" }) => {
    const body = `${b64u(header)}.${b64u(claims)}`;
    const sig = crypto.sign("sha256", Buffer.from(body),
                            { key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${body}.${sig.toString("base64url")}`;
  };

  // Serve our JWKS instead of Supabase's. The issuer the module demands comes
  // from its own configured project, so ask it rather than guessing.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });
  t.after(() => { globalThis.fetch = realFetch; });

  const { verifyJwt, protectedResourceMetadata: prm } = await import("../../lib/mcpauth.mjs");
  const iss = prm("http://x").authorization_servers[0];

  assert.ok(await verifyJwt(sign({ sub: "u", iss, exp: now() + 600 })),
            "a well-formed token is accepted");
  assert.equal(await verifyJwt(sign({ sub: "u", iss })), null,
               "no exp: a token that never expires is not a token we accept");
  assert.equal(await verifyJwt(sign({ sub: "u", exp: now() + 600 })), null,
               "no iss: the issuer check must not be skippable by omission");
  assert.equal(await verifyJwt(sign({ sub: "u", iss: "https://other.supabase.co/auth/v1", exp: now() + 600 })),
               null, "another project's issuer");
  assert.equal(await verifyJwt(sign({ sub: "u", iss, exp: now() + 600 },
                                    { alg: "ES256", kid: "unknown", typ: "JWT" })), null,
               "a kid we cannot find");
  assert.equal(await verifyJwt(sign({ sub: "u", iss, exp: now() - 10 })), null, "expired");
  assert.equal(await verifyJwt(sign({ sub: "u", iss, exp: now() + 600 },
                                    { alg: "none", kid: "k1" })), null, "alg none");
  assert.equal(await verifyJwt("not.a.jwt"), null, "garbage");
  assert.equal(await verifyJwt(""), null, "empty");
});
