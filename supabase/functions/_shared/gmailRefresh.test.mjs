import assert from "node:assert/strict";
import test from "node:test";

import { classifyGmailRefreshError, refreshGmailAccessToken } from "./gmailRefresh.ts";

const refresh = (status, payload) => refreshGmailAccessToken({
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  fetchImpl: async () => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }),
});

test("invalid_grant maps to OAUTH_INVALID_GRANT", async () => {
  assert.deepEqual(await refresh(400, { error: "invalid_grant", error_description: "must never escape" }), { ok: false, code: "OAUTH_INVALID_GRANT", httpStatus: 400 });
});

test("invalid_client maps to OAUTH_INVALID_CLIENT", async () => {
  assert.deepEqual(await refresh(401, { error: "invalid_client", error_description: "must never escape" }), { ok: false, code: "OAUTH_INVALID_CLIENT", httpStatus: 401 });
});

test("unknown and malformed provider failures map to OAUTH_REFRESH_OTHER", async () => {
  assert.equal(classifyGmailRefreshError({ error: "temporarily_unavailable" }), "OAUTH_REFRESH_OTHER");
  assert.equal(classifyGmailRefreshError("raw provider response"), "OAUTH_REFRESH_OTHER");
  assert.deepEqual(await refresh(500, { error: "temporarily_unavailable", error_description: "private detail" }), { ok: false, code: "OAUTH_REFRESH_OTHER", httpStatus: 500 });
});

test("successful refresh returns the token only to the server caller", async () => {
  assert.deepEqual(await refresh(200, { access_token: "server-only-access", token_type: "Bearer", scope: "openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic" }), {
    ok: true, code: "OAUTH_REFRESH_OK", httpStatus: 200, accessToken: "server-only-access",
    grantedOpenId: true, grantedEmail: true, grantedGmailSend: true, grantedGmailSettingsBasic: true,
  });
});

test("semantic email grant accepts literal and Google userinfo.email representations", async () => {
  const suffix = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.settings.basic";
  const literal = await refresh(200, { access_token: "server-only-access", scope: `openid email ${suffix}` });
  const google = await refresh(200, { access_token: "server-only-access", scope: `openid https://www.googleapis.com/auth/userinfo.email ${suffix}` });
  assert.equal(literal.ok && literal.grantedEmail, true);
  assert.equal(google.ok && google.grantedEmail, true);
});

test("missing scope metadata becomes false booleans without inference", async () => {
  const result = await refresh(200, { access_token: "server-only-access" });
  assert.equal(result.grantedOpenId, false);
  assert.equal(result.grantedEmail, false);
  assert.equal(result.grantedGmailSend, false);
  assert.equal(result.grantedGmailSettingsBasic, false);
});
