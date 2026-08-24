import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const oauth = await import(new URL("./gmailOAuth.ts", import.meta.url));
const authorize = await readFile(new URL("../gmail-oauth-authorize/index.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../gmail-oauth-callback/index.ts", import.meta.url), "utf8");

const config = {
  clientId: "client-id",
  clientSecret: "not-a-real-secret",
  redirectUri: "https://example.supabase.co/functions/v1/gmail-oauth-callback",
  senderAlias: "viafa@expoviafair.com",
  owningMailbox: "ahmet@expoviafair.com",
};

test("authorization start requires an authenticated active VIAWA admin", () => {
  assert.match(authorize, /Authorization/);
  assert.match(authorize, /admin\.auth\.getUser/);
  assert.match(authorize, /application_users/);
  assert.match(authorize, /member\?\.is_active/);
  assert.match(authorize, /member\.role !== "admin"/);
  assert.match(authorize, /response\("Active VIAWA admin access is required\.", 403\)/);
});

test("authorization start handles browser preflight without generating OAuth state", () => {
  assert.match(authorize, /request\.method === "OPTIONS"/);
  assert.match(authorize, /response\("ok", 200\)/);
  assert.match(authorize, /"Access-Control-Allow-Origin": "\*"/);
  for (const header of ["authorization", "apikey", "content-type", "x-client-info"]) assert.equal(authorize.includes(header), true, header);
  const optionsBranch = authorize.split(/if \(request\.method === "OPTIONS"\)/)[1].split(";")[0];
  assert.doesNotMatch(optionsBranch, /createOAuthState|buildGoogleAuthorizationUrl|auth\.getUser/);
});

test("every authorize response uses the shared CORS response wrapper", () => {
  assert.doesNotMatch(authorize.replace(/return new Response\(body,[\s\S]*?\n\}/, ""), /new Response\(/);
  assert.match(authorize, /response\("Unauthorized", 401\)/);
  assert.match(authorize, /response\("Active VIAWA admin access is required\.", 403\)/);
  assert.match(authorize, /response\("Method not allowed", 405\)/);
  assert.match(authorize, /response\("Gmail authorization could not be started\.", 503\)/);
});

test("state is signed, expiring, and rejects mismatch or expiry", async () => {
  const state = await oauth.createOAuthState({ viawaUserId: "user-1", clientSecret: config.clientSecret, nowMs: 1_000, nonce: "nonce-1" });
  assert.equal((await oauth.validateOAuthState({ state, clientSecret: config.clientSecret, nowMs: 2_000 }))?.viawaUserId, "user-1");
  assert.equal(await oauth.validateOAuthState({ state: `${state}x`, clientSecret: config.clientSecret, nowMs: 2_000 }), null);
  assert.equal(await oauth.validateOAuthState({ state, clientSecret: config.clientSecret, nowMs: 1_000 + 11 * 60 * 1000 }), null);
});

test("authorization URL uses least privilege scopes and fixed server configuration", () => {
  const url = new URL(oauth.buildGoogleAuthorizationUrl(config, "signed-state"));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(url.searchParams.get("login_hint"), config.owningMailbox);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.match(url.searchParams.get("prompt"), /consent/);
  assert.deepEqual(url.searchParams.get("scope").split(" "), [...oauth.GMAIL_OAUTH_SCOPES]);
  assert.equal(url.searchParams.get("scope").includes("mail.google.com/"), false);
  assert.equal(url.searchParams.get("scope").includes("gmail.readonly"), false);
  assert.equal(authorize.includes("request.json"), false);
});

test("callback rejects state mismatch and code exchange failure", () => {
  assert.match(callback, /validateOAuthState/);
  assert.match(callback, /invalid or expired/);
  assert.match(callback, /tokenResponse\.ok/);
  assert.match(callback, /Google did not accept the authorization code/);
  assert.match(callback, /statePayload\.viawaUserId/);
  assert.match(callback, /member\.role !== "admin"/);
});

test("wrong Google mailbox is rejected without fallback", () => {
  assert.equal(oauth.isConfiguredMailbox("ahmet@expoviafair.com", config.owningMailbox), true);
  assert.equal(oauth.isConfiguredMailbox("other@expoviafair.com", config.owningMailbox), false);
  assert.match(callback, /not the configured VIAWA mailbox/);
  assert.doesNotMatch(callback, /fallback/i);
});

test("only the exact accepted VIAFA send-as alias passes", () => {
  assert.equal(oauth.isAcceptedSenderAlias({ sendAsEmail: "viafa@expoviafair.com", verificationStatus: "accepted" }, config.senderAlias), true);
  assert.equal(oauth.isAcceptedSenderAlias({ sendAsEmail: "other@expoviafair.com", verificationStatus: "accepted" }, config.senderAlias), false);
  assert.equal(oauth.isAcceptedSenderAlias({ sendAsEmail: "viafa@expoviafair.com", verificationStatus: "pending" }, config.senderAlias), false);
  assert.equal(oauth.isAcceptedSenderAlias(null, config.senderAlias), false);
  assert.match(callback, /missing or not accepted/);
});

test("tokens and secrets never reach logs, frontend, or database", () => {
  const combined = `${authorize}\n${callback}`;
  assert.doesNotMatch(combined, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|\.from\([^)]*token/i);
  assert.doesNotMatch(combined, /refresh_token[^\n]*(?:Response|page\()/);
  assert.match(callback, /Cache-Control": "no-store/);
  assert.match(callback, /application\/octet-stream/);
  assert.doesNotMatch(callback, /tokens\.refresh_token[^\n]*(?:page\(|JSON\.stringify|authorizationUrl)/);
});

test("callback scope failure exposes only normalized safe grant booleans", () => {
  assert.match(callback, /scopeFieldReturned/);
  assert.match(callback, /https:\/\/www\.googleapis\.com\/auth\/userinfo\.email/);
  assert.match(callback, /openid: \$\{diagnostic\.openid\}/);
  assert.match(callback, /email: \$\{diagnostic\.email\}/);
  assert.match(callback, /gmail\.send: \$\{diagnostic\.gmailSend\}/);
  assert.match(callback, /gmail\.settings\.basic: \$\{diagnostic\.gmailSettingsBasic\}/);
  assert.doesNotMatch(callback, /JSON\.stringify\(tokens\)|console\.|error_description/);
});
