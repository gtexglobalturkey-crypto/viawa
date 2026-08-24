import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helper = await readFile(new URL("./gmailUserInfo.ts", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../gmail-userinfo-verify/index.ts", import.meta.url), "utf8");

test("endpoint requires authenticated active admin", () => {
  assert.match(endpoint, /auth\.getUser/);
  assert.match(endpoint, /member\?\.is_active/);
  assert.match(endpoint, /member\.role !== "admin"/);
});
test("endpoint returns only safe UserInfo and grant fields", () => {
  assert.match(endpoint, /userinfoResult: userinfo\.code, grantedOpenId: refresh\.grantedOpenId, grantedEmail: refresh\.grantedEmail/);
  assert.doesNotMatch(endpoint, /result\.accessToken|console\.|error_description|grantedGmailSend|grantedGmailSettingsBasic/);
});
test("diagnostic cannot send, inspect aliases, access reports, or mutate DB", () => {
  assert.doesNotMatch(endpoint, /messages\/send|sendAs|GMAIL_SENDER_ALIAS|organizer_report|recipient|MIME|\.insert\(|\.update\(|\.delete\(/);
});
test("helper never returns provider payload or email", () => {
  assert.doesNotMatch(helper, /console\.|error_description/);
  assert.match(helper, /Promise<\{ code: GmailUserInfoCode; httpStatus: number \}>/);
});
