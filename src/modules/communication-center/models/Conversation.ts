import type { InboxFolder, InboxMessage } from "./InboxMessage";

/**
 * Sprint 25.6 — the Conversation List shows this, never individual
 * messages ("Liste tek tek mail göstermeyecek. Conversation gösterecek.").
 */
export type Conversation = {
  id: string;
  counterpartName: string;
  companyId: string | null;
  contactId: string | null;
  matched: boolean;
  folder: InboxFolder;
  lastMessage: InboxMessage;
  messages: readonly InboxMessage[];
  messageCount: number;
  unreadCount: number;
};
