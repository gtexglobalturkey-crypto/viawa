import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helper = await readFile(new URL("./gmailIdentity.ts", import.meta.url), "utf8");
const verify = await readFile(new URL("../gmail-identity-verify/index.ts", import.meta.url), "utf8");
const send = await readFile(new URL("../organizer-report-email-send/index.ts", import.meta.url), "utf8");

test("diagnostic requires an authenticated active admin", () => {
  assert.match(verify, /auth\.getUser/);
  assert.match(verify, /member\?\.is_active/);
  assert.match(verify, /member\.role !== "admin"/);
});

test("diagnostic has no report, recipient, MIME, Gmail send, or database mutation", () => {
  assert.doesNotMatch(verify, /organizer_report|recipient|messageBody|MIME|messages\/send|\.insert\(|\.update\(|\.delete\(/);
});

test("raw provider data and credentials never escape", () => {
  assert.doesNotMatch(helper + verify, /console\.|error_description|JSON\.stringify\([^)]*(?:accessToken|payload)|headers:\s*headers/);
  assert.match(verify, /JSON\.stringify\(\{ ok, result \}\)/);
});

test("send uses split safe codes before preserving the existing Gmail send", () => {
  assert.match(send, /verifyGmailIdentityAlias/);
  assert.match(send, /finalize\("failed", identityResult\)/);
  assert.match(send, /users\/me\/messages\/send/);
  assert.doesNotMatch(send, /GMAIL_IDENTITY_OR_ALIAS_INVALID/);
});
