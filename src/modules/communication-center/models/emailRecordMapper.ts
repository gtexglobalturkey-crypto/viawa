import type { EmailRecord } from "../../../types/database";
import type { InboxMessage, InboxMessageStatus } from "./InboxMessage";

// Sprint 25.6 — Workspace Email has no real "who this was sent from"
// concept (the emails table only ever records recipients, never a
// sender) — every Workspace Email send is, by definition, sent by
// VIAWA on the company's behalf, so this is a stable, honest label
// rather than a fabricated address.
export const WORKSPACE_EMAIL_SENDER_LABEL = "VIAWA";

const BODY_PREVIEW_MAX_LENGTH = 140;

export function buildBodyPreview(
  body: string | null,
): string {
  const trimmed = body?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  const singleLine = trimmed
    .replace(/\s+/g, " ")
    .trim();

  return singleLine.length > BODY_PREVIEW_MAX_LENGTH
    ? `${singleLine.slice(0, BODY_PREVIEW_MAX_LENGTH).trimEnd()}…`
    : singleLine;
}

function mapEmailStatus(
  status: string,
): InboxMessageStatus {
  return status === "sending" ||
    status === "sent" ||
    status === "failed" ||
    status === "draft"
    ? status
    : "sent";
}

/**
 * Sprint 25.6 — the one real InboxMessage source that exists in v1: an
 * email Workspace Email already recorded to the `emails` table (see
 * services/supabase/emailService.ts, untouched by this sprint). Always
 * lands in the "sent" folder — this module never writes to the emails
 * table itself, it only reads from it.
 *
 * conversationId is company_id: the v1 heuristic ("one conversation per
 * matched company") described in InboxMessage.ts. company_id is always
 * present on a real emails row, so every mapped message is always
 * matched=true with a real companyId — contactId stays null because the
 * emails table itself never records one (see Sprint 25.4 analysis).
 */
export function mapEmailRecordToInboxMessage(
  email: EmailRecord,
): InboxMessage {
  return {
    id: `viawa-internal:${email.id}`,
    provider: "viawa-internal",
    externalMessageId: email.id,
    conversationId: email.company_id,
    folder: "sent",
    from: WORKSPACE_EMAIL_SENDER_LABEL,
    to: email.to_recipients ?? [],
    cc: email.cc_recipients ?? [],
    subject: email.subject?.trim() || "(Konu yok)",
    bodyPreview: buildBodyPreview(email.body),
    receivedAt: email.sent_at ?? email.created_at,
    companyId: email.company_id,
    contactId: null,
    matched: true,
    status: mapEmailStatus(email.status),
    isRead: true,
    attachments: [],
  };
}

export function mapEmailRecordsToInboxMessages(
  emails: readonly EmailRecord[],
): InboxMessage[] {
  return emails.map(mapEmailRecordToInboxMessage);
}
