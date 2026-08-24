import assert from "node:assert/strict";
import test from "node:test";
import { inspectGoogleUserInfo } from "./gmailUserInfo.ts";

const inspect = (status, payload, malformed = false) => inspectGoogleUserInfo({ accessToken: "server-only", fetchImpl: async () => malformed ? new Response("not-json", { status }) : new Response(JSON.stringify(payload), { status }) });

test("UserInfo 401 is classified", async () => assert.deepEqual(await inspect(401, { private: "discarded" }), { code: "USERINFO_HTTP_401", httpStatus: 401 }));
test("UserInfo 403 is classified", async () => assert.deepEqual(await inspect(403, {}), { code: "USERINFO_HTTP_403", httpStatus: 403 }));
test("other non-success is classified", async () => assert.deepEqual(await inspect(429, {}), { code: "USERINFO_HTTP_OTHER", httpStatus: 429 }));
test("malformed JSON is classified", async () => assert.deepEqual(await inspect(200, null, true), { code: "USERINFO_MALFORMED_RESPONSE", httpStatus: 200 }));
test("missing email is classified", async () => assert.deepEqual(await inspect(200, { sub: "opaque" }), { code: "USERINFO_EMAIL_MISSING", httpStatus: 200 }));
test("valid email is classified without returning it", async () => assert.deepEqual(await inspect(200, { sub: "opaque", email: "configured@example.com" }), { code: "USERINFO_EMAIL_OK", httpStatus: 200 }));
