import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  buildBodyPreview,
  mapEmailRecordsToInboxMessages,
  mapEmailRecordToInboxMessage,
  WORKSPACE_EMAIL_SENDER_LABEL,
} = await import(new URL("./emailRecordMapper.ts", import.meta.url));

function emailRecord(overrides = {}) {
  return {
    id: "email-1",
    company_id: "company-1",
    to_recipients: ["contact@example.com"],
    cc_recipients: [],
    bcc_recipients: [],
    send_operation_key: "op-1",
    subject: "Fuar Bilgi Paketi",
    body: "Sayın Yetkili, ekte bilgi paketini bulabilirsiniz.",
    status: "sent",
    sent_at: "2026-08-01T10:00:00.000Z",
    created_at: "2026-08-01T09:59:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

test("buildBodyPreview: collapses whitespace and returns short text unchanged", () => {
  assert.equal(
    buildBodyPreview("Merhaba,\n\n  Revize teklif rica ederiz.  "),
    "Merhaba, Revize teklif rica ederiz.",
  );
});

test("buildBodyPreview: truncates long text with an ellipsis", () => {
  const longBody = "a".repeat(200);
  const preview = buildBodyPreview(longBody);

  assert.equal(preview.length, 141); // 140 chars + ellipsis
  assert.ok(preview.endsWith("…"));
});

test("buildBodyPreview: empty for null or blank body", () => {
  assert.equal(buildBodyPreview(null), "");
  assert.equal(buildBodyPreview("   "), "");
});

test("mapEmailRecordToInboxMessage: always lands in the sent folder, matched to its real company", () => {
  const message = mapEmailRecordToInboxMessage(emailRecord());

  assert.equal(message.folder, "sent");
  assert.equal(message.provider, "viawa-internal");
  assert.equal(message.conversationId, "company-1");
  assert.equal(message.companyId, "company-1");
  assert.equal(message.matched, true);
  assert.equal(message.contactId, null);
  assert.equal(message.from, WORKSPACE_EMAIL_SENDER_LABEL);
  assert.deepEqual(message.to, ["contact@example.com"]);
  assert.deepEqual(message.attachments, []);
});

test("mapEmailRecordToInboxMessage: prefers sent_at, falls back to created_at", () => {
  const withSentAt = mapEmailRecordToInboxMessage(emailRecord());
  assert.equal(withSentAt.receivedAt, "2026-08-01T10:00:00.000Z");

  const withoutSentAt = mapEmailRecordToInboxMessage(
    emailRecord({ sent_at: null }),
  );
  assert.equal(withoutSentAt.receivedAt, "2026-08-01T09:59:00.000Z");
});

test("mapEmailRecordToInboxMessage: an unrecognized status falls back to 'sent' rather than crashing", () => {
  const message = mapEmailRecordToInboxMessage(
    emailRecord({ status: "some-future-status" }),
  );

  assert.equal(message.status, "sent");
});

test("mapEmailRecordToInboxMessage: a blank subject never leaves the message titleless", () => {
  const message = mapEmailRecordToInboxMessage(
    emailRecord({ subject: "" }),
  );

  assert.equal(message.subject, "(Konu yok)");
});

test("mapEmailRecordsToInboxMessages: maps every record in order", () => {
  const messages = mapEmailRecordsToInboxMessages([
    emailRecord({ id: "a" }),
    emailRecord({ id: "b" }),
  ]);

  assert.deepEqual(
    messages.map((message) => message.externalMessageId),
    ["a", "b"],
  );
});
