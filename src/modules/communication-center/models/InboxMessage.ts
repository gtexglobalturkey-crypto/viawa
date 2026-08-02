/**
 * Sprint 25.6 — Communication Center v1's own, provider-independent
 * message shape. Nothing in this module reads directly from any mail
 * provider (there isn't one — "Gerçek Gmail / Outlook entegrasyonu YOK")
 * or from the Workspace/Commit Engine's own types; every message shown
 * here, regardless of where it actually came from, gets mapped into this
 * one shape first (see emailRecordMapper.ts for the one real source that
 * exists today: Workspace Email's own `emails` table rows).
 */

// "viawa-internal" is the only real provider today (Workspace Email's own
// send record, via the emails table) — a distinct id per future provider
// (e.g. "gmail", "outlook") slots in here without reshaping this type.
export type InboxMessageProvider = "viawa-internal";

// The only three folders this v1 has — see Sol Menü constraint (no
// Waiting Reply / Risk / AI / Spam / Drafts yet).
export type InboxFolder = "inbox" | "sent" | "archive";

export type InboxMessageStatus =
  | "draft"
  | "sending"
  | "sent"
  | "failed";

export type InboxMessageAttachment = {
  id: string;
  fileName: string;
};

export type InboxMessage = {
  id: string;
  provider: InboxMessageProvider;
  externalMessageId: string;
  /**
   * Groups messages into a Conversation (see Conversation.ts) — v1's
   * heuristic is "one conversation per matched company" (see
   * emailRecordMapper.ts), not real email threading (References/In-Reply-To
   * headers), since there is no real provider to read those from yet.
   */
  conversationId: string;
  folder: InboxFolder;
  from: string;
  to: readonly string[];
  cc: readonly string[];
  subject: string;
  bodyPreview: string;
  receivedAt: string;
  companyId: string | null;
  contactId: string | null;
  /**
   * Sprint 25.6 Section "Company Matching" — preparation only. True here
   * simply means "this message is already linked to a real company id"
   * (which every Workspace Email send always is); no automatic matching
   * logic exists in this module.
   */
  matched: boolean;
  status: InboxMessageStatus;
  isRead: boolean;
  attachments: readonly InboxMessageAttachment[];
};
