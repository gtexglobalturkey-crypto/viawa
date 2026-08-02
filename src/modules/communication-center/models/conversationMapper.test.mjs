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
  countUnreadInFolder,
  filterConversationsByFolder,
  groupMessagesIntoConversations,
} = await import(new URL("./conversationMapper.ts", import.meta.url));

function message(overrides = {}) {
  return {
    id: "msg-1",
    provider: "viawa-internal",
    externalMessageId: "msg-1",
    conversationId: "company-1",
    folder: "sent",
    from: "VIAWA",
    to: ["contact@example.com"],
    cc: [],
    subject: "Konu",
    bodyPreview: "Önizleme",
    receivedAt: "2026-08-01T10:00:00.000Z",
    companyId: "company-1",
    contactId: null,
    matched: true,
    status: "sent",
    isRead: true,
    attachments: [],
    ...overrides,
  };
}

test("groupMessagesIntoConversations: groups messages sharing a conversationId into one conversation", () => {
  const conversations = groupMessagesIntoConversations([
    message({ id: "a" }),
    message({ id: "b" }),
    message({ id: "c", conversationId: "company-2", companyId: "company-2" }),
  ]);

  assert.equal(conversations.length, 2);
  const companyOne = conversations.find((c) => c.id === "company-1");
  assert.equal(companyOne.messageCount, 2);
});

test("groupMessagesIntoConversations: lastMessage is the most recently received one, messages sorted newest first", () => {
  const conversations = groupMessagesIntoConversations([
    message({
      id: "older",
      receivedAt: "2026-08-01T09:00:00.000Z",
      subject: "Older",
    }),
    message({
      id: "newer",
      receivedAt: "2026-08-01T11:00:00.000Z",
      subject: "Newer",
    }),
  ]);

  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].lastMessage.id, "newer");
  assert.deepEqual(
    conversations[0].messages.map((m) => m.id),
    ["newer", "older"],
  );
});

test("groupMessagesIntoConversations: unreadCount counts only unread messages in the group", () => {
  const conversations = groupMessagesIntoConversations([
    message({ id: "a", isRead: false }),
    message({ id: "b", isRead: false }),
    message({ id: "c", isRead: true }),
  ]);

  assert.equal(conversations[0].unreadCount, 2);
});

test("groupMessagesIntoConversations: counterpartName prefers the resolved company name over the raw from address", () => {
  const conversations = groupMessagesIntoConversations(
    [message({ companyId: "company-1", from: "VIAWA" })],
    { "company-1": "ABC Makina" },
  );

  assert.equal(conversations[0].counterpartName, "ABC Makina");
});

test("groupMessagesIntoConversations: falls back to the from address when the company name isn't resolved", () => {
  const conversations = groupMessagesIntoConversations(
    [message({ companyId: "company-9", from: "VIAWA" })],
    { "company-1": "ABC Makina" },
  );

  assert.equal(conversations[0].counterpartName, "VIAWA");
});

test("groupMessagesIntoConversations: conversations are sorted by most recent last message first", () => {
  const conversations = groupMessagesIntoConversations([
    message({
      id: "a",
      conversationId: "company-1",
      companyId: "company-1",
      receivedAt: "2026-08-01T08:00:00.000Z",
    }),
    message({
      id: "b",
      conversationId: "company-2",
      companyId: "company-2",
      receivedAt: "2026-08-01T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(
    conversations.map((c) => c.id),
    ["company-2", "company-1"],
  );
});

test("filterConversationsByFolder: keeps only conversations whose folder matches", () => {
  const conversations = groupMessagesIntoConversations([
    message({ id: "a", conversationId: "company-1", folder: "sent" }),
    message({ id: "b", conversationId: "company-2", folder: "inbox" }),
  ]);

  const sent = filterConversationsByFolder(conversations, "sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, "company-1");
});

test("countUnreadInFolder: sums unreadCount only across the given folder", () => {
  const conversations = groupMessagesIntoConversations([
    message({
      id: "a",
      conversationId: "company-1",
      folder: "inbox",
      isRead: false,
    }),
    message({
      id: "b",
      conversationId: "company-2",
      folder: "sent",
      isRead: false,
    }),
  ]);

  assert.equal(countUnreadInFolder(conversations, "inbox"), 1);
  assert.equal(countUnreadInFolder(conversations, "sent"), 1);
  assert.equal(countUnreadInFolder(conversations, "archive"), 0);
});
