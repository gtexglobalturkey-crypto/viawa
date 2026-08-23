import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shared = await readFile(new URL("./organizerReportEmail.ts", import.meta.url), "utf8");
const pdf = await readFile(new URL("./organizerReportPdf.ts", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../organizer-report-email-send/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../migrations/20260823170000_create_organizer_report_email_sends.sql", import.meta.url), "utf8");

test("endpoint requires an authenticated active VIAWA user and accepts no sender choice", () => {
  assert.match(endpoint, /auth\.getUser/);
  assert.match(endpoint, /application_users/);
  assert.match(endpoint, /member\?\.is_active/);
  assert.match(endpoint, /new Set\(\["reportId", "recipient", "subject", "messageBody"\]\)/);
  assert.doesNotMatch(endpoint, /body\.(?:sender|senderAlias|mailbox)/);
});

test("provider identity is exact and never falls back from the configured alias", () => {
  assert.match(endpoint, /required\("GMAIL_OWNING_MAILBOX"\)/);
  assert.match(endpoint, /required\("GMAIL_SENDER_ALIAS"\)/);
  assert.match(endpoint, /gmailIdentityIsReady/);
  assert.match(shared, /isConfiguredMailbox/);
  assert.match(shared, /isAcceptedSenderAlias/);
  assert.match(shared, /From: VIAFA/);
  assert.doesNotMatch(endpoint, /fallback/i);
});

test("immutable stored snapshot produces the attached PDF with the exact report ID", () => {
  assert.match(endpoint, /from\("organizer_report_snapshots"\)/);
  assert.match(endpoint, /generateOrganizerReportPdf\(report\)/);
  assert.match(endpoint, /%PDF-/);
  assert.match(pdf, /Report ID: \$\{model\.reportId\}/);
  assert.match(shared, /\$\{input\.reportId\}\.pdf/);
});

test("Gmail acceptance and durable evidence are both required for success", () => {
  assert.match(endpoint, /users\/me\/messages\/send/);
  assert.match(endpoint, /typeof gmailResult\.id !== "string"/);
  assert.match(endpoint, /status: "accepted"/);
  assert.match(endpoint, /provider_message_id: gmailResult\.id/);
  assert.match(endpoint, /if \(finalizeError \|\| !finalized\)/);
  assert.match(endpoint, /sent: true/);
});

test("idempotency blocks concurrent and unknown retries and reuses accepted evidence", () => {
  assert.match(shared, /SHA-256/);
  assert.match(endpoint, /send_operation_key/);
  assert.match(endpoint, /existing\.status === "accepted"/);
  assert.match(endpoint, /existing\.status === "pending" \|\| existing\.status === "unknown"/);
  assert.match(endpoint, /\.eq\("status", "failed"\)/);
});

test("ledger cannot be written by the browser and final evidence is immutable", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* anon, authenticated/i);
  assert.match(migration, /grant select, insert, update .* service_role/i);
  assert.match(migration, /old\.status in \('accepted', 'unknown'\)/i);
  assert.match(migration, /send_operation_key text not null unique/i);
  assert.doesNotMatch(migration, /policy/i);
});

test("tokens are server-only and never logged or returned", () => {
  assert.match(endpoint, /GMAIL_OAUTH_REFRESH_TOKEN/);
  assert.doesNotMatch(endpoint, /console\./);
  assert.doesNotMatch(endpoint, /json\([^\n]*(?:tokenData|refreshToken|gmailHeaders)/);
  assert.doesNotMatch(endpoint, /json\([^\n]*(?:access_token|refresh_token)/);
});
