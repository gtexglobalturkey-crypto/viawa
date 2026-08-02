import type { Conversation } from "./Conversation";
import type { InboxFolder, InboxMessage } from "./InboxMessage";

function sortByReceivedAtDescending(
  messages: readonly InboxMessage[],
): InboxMessage[] {
  return [...messages].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
}

/**
 * Sprint 25.6 — groups messages into Conversations. A conversation's own
 * folder/counterpart/matched state always mirrors its most recent
 * message (messages are expected to already share one conversationId per
 * counterpart — see InboxMessage.conversationId's own note on the v1
 * "one conversation per matched company" heuristic).
 *
 * companyNamesById is an optional display-name lookup (never required —
 * an unmatched or unresolved company id just falls back to the message's
 * own `from` address, exactly like a normal mail client would show
 * whatever identifies the sender).
 */
export function groupMessagesIntoConversations(
  messages: readonly InboxMessage[],
  companyNamesById: Readonly<Record<string, string>> = {},
): Conversation[] {
  const byConversationId = new Map<string, InboxMessage[]>();

  for (const message of messages) {
    const existing =
      byConversationId.get(message.conversationId) ?? [];

    existing.push(message);
    byConversationId.set(message.conversationId, existing);
  }

  const conversations: Conversation[] = [];

  for (const [
    conversationId,
    groupMessages,
  ] of byConversationId) {
    const sortedMessages =
      sortByReceivedAtDescending(groupMessages);
    const lastMessage = sortedMessages[0];

    const counterpartName =
      (lastMessage.companyId &&
        companyNamesById[lastMessage.companyId]) ||
      lastMessage.from;

    conversations.push({
      id: conversationId,
      counterpartName,
      companyId: lastMessage.companyId,
      contactId: lastMessage.contactId,
      matched: lastMessage.matched,
      folder: lastMessage.folder,
      lastMessage,
      messages: sortedMessages,
      messageCount: sortedMessages.length,
      unreadCount: sortedMessages.filter(
        (message) => !message.isRead,
      ).length,
    });
  }

  return conversations.sort((a, b) =>
    b.lastMessage.receivedAt.localeCompare(
      a.lastMessage.receivedAt,
    ),
  );
}

export function filterConversationsByFolder(
  conversations: readonly Conversation[],
  folder: InboxFolder,
): Conversation[] {
  return conversations.filter(
    (conversation) => conversation.folder === folder,
  );
}

export function countUnreadInFolder(
  conversations: readonly Conversation[],
  folder: InboxFolder,
): number {
  return filterConversationsByFolder(
    conversations,
    folder,
  ).reduce(
    (sum, conversation) =>
      sum + conversation.unreadCount,
    0,
  );
}
