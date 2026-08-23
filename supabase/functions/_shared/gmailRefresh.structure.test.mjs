import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helper = await readFile(new URL("./gmailRefresh.ts", import.meta.url), "utf8");
const verify = await readFile(new URL("../gmail-refresh-verify/index.ts", import.meta.url), "utf8");
const send = await readFile(new URL("../organizer-report-email-send/index.ts", import.meta.url), "utf8");

test("verification requires an authenticated active admin", () => {
  assert.match(verify, /auth\.getUser/);
  assert.match(verify, /application_users/);
  assert.match(verify, /member\?\.is_active/);
  assert.match(verify, /member\.role !== "admin"/);
  assert.match(verify, /UNAUTHORIZED/);
  assert.match(verify, /ADMIN_REQUIRED/);
});

test("verification has no send, alias, MIME, report, or database mutation side effect", () => {
  assert.doesNotMatch(verify, /messages\/send|sendAs|GMAIL_SENDER_ALIAS|MIME|organizer_report|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(verify, /recipient|subject|messageBody/);
});

test("public verification response exposes only safe result fields", () => {
  assert.match(verify, /\{ ok: true, result: "OAUTH_REFRESH_OK" \}/);
  assert.match(verify, /\{ ok: false, result: result\.code \}/);
  assert.doesNotMatch(verify, /result\.accessToken|error_description|console\.|JSON\.stringify\([^)]*(?:token|payload)/i);
});

test("helper allow-lists provider error classes and discards descriptions and raw responses", () => {
  assert.match(helper, /error === "invalid_grant"/);
  assert.match(helper, /error === "invalid_client"/);
  assert.match(helper, /OAUTH_REFRESH_OTHER/);
  assert.doesNotMatch(helper, /error_description|console\./);
});

test("organizer send uses mapped refresh codes without changing Gmail send behavior", () => {
  assert.match(send, /refreshGmailAccessToken/);
  assert.match(send, /finalize\("failed", tokenResult\.code\)/);
  assert.match(send, /users\/me\/messages\/send/);
});
