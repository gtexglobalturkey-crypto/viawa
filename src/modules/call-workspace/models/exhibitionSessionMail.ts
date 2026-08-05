import type { CommunicationAttachment } from "../../communication/models/CommunicationAttachment";
import type { GeneratedDocumentRecord } from "../../document-engine/models/GeneratedDocumentRecord";
import type { SelectedExhibitionDocument } from "../../exhibitions/models/SelectedExhibitionDocument";
import type { PriceResult } from "../pricing/models/PriceResult";
import type { ExhibitionSessionStore } from "./exhibitionSessionDraft";
import {
  getSessionDraft,
  withSessionDraft,
} from "./exhibitionSessionDraft";

// Same pattern as EmailComposer.tsx / useCommunicationWorkspace.ts —
// duplicated rather than imported from either (both are out of scope this
// sprint, see Kısıtlar), kept here so the Workspace Email Panel's own
// recipient validation is pure and independently testable.
export const WORKSPACE_EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWorkspaceEmail(
  email: string,
): string {
  return email.trim().toLowerCase();
}

export type RecipientValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Same rules as useCommunicationWorkspace.handleSendEmail's own recipient
 * checks — reused here so Workspace Email's send path can't silently
 * diverge: at least one TO, every address well-formed, no address reused
 * across TO/CC/BCC.
 */
export function validateWorkspaceEmailRecipients(input: {
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
}): RecipientValidationResult {
  if (input.to.length === 0) {
    return {
      ok: false,
      reason:
        "Göndermek için en az bir geçerli TO alıcısı seçin.",
    };
  }

  const allRecipients = [
    ...input.to,
    ...input.cc,
    ...input.bcc,
  ];

  if (
    allRecipients.some(
      (email) => !WORKSPACE_EMAIL_PATTERN.test(email),
    )
  ) {
    return {
      ok: false,
      reason: "Alıcı e-posta adreslerinden biri geçersiz.",
    };
  }

  if (
    new Set(allRecipients).size !== allRecipients.length
  ) {
    return {
      ok: false,
      reason:
        "Aynı e-posta adresi TO, CC veya BCC alanlarında birden fazla kez kullanılamaz.",
    };
  }

  return { ok: true };
}

export function createWorkspaceEmailSendOperationKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `workspace-email-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Sprint 25.4B — everything the Workspace Email Panel needs to remember
 * about a single fuar's in-progress email, held only in the Exhibition
 * Session draft (see exhibitionSessionDraft.ts) until it's actually sent.
 * Never auto-persisted — a page reload loses it, same as every other
 * draft field.
 */
export type WorkspaceEmailDraft = {
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  subject: string;
  body: string;
  templateId: string;
  attachments: readonly CommunicationAttachment[];
  quotationSummaryIncluded: boolean;
  /**
   * Sprint 25.4B Section K — lives on the draft itself (not a component
   * ref) specifically so it survives the panel being closed and reopened:
   * an unfinished draft keeps the same key until it's actually sent, so a
   * close/reopen or a retry can never produce two emails rows for what
   * the user experiences as one send. A fresh key is only ever minted
   * right after a successful send, once this draft is reset for the next
   * mail — see useWorkspaceEmailDraft.ts.
   */
  sendOperationKey: string;
  updatedAt: string;
};

export function createEmptyWorkspaceEmailDraft(
  templateId: string,
): WorkspaceEmailDraft {
  return {
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    body: "",
    templateId,
    attachments: [],
    quotationSummaryIncluded: false,
    sendOperationKey: createWorkspaceEmailSendOperationKey(),
    updatedAt: new Date().toISOString(),
  };
}

// No real SMTP/API delivery exists yet (see Sprint 25.4 analysis) — the
// only thing "sending" actually does today is write a row to the emails
// table. This is the one real mode; the type exists so a future real
// delivery mode has somewhere to slot in without reshaping every caller.
export type WorkspaceEmailDeliveryMode = "viawa-record";

/**
 * A single completed "send" (really: "recorded to VIAWA"), kept in the
 * Exhibition Session's mailEvents[] until "Görüşmeyi Tamamla" links it
 * into the opportunity's real timeline — see
 * CustomerWorkspace.commitWorkspaceSession. A fuar's call can produce more
 * than one of these (e.g. an information package now, a quotation later),
 * so this is always a list, never a single slot.
 */
export type WorkspaceEmailEvent = {
  /** Same value as sendOperationKey — also doubles as this event's identity for dedup/idempotency. */
  id: string;
  sendOperationKey: string;
  recordedAt: string;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  subject: string;
  templateId: string;
  attachments: readonly CommunicationAttachment[];
  quotationSummaryIncluded: boolean;
  contractIncluded: boolean;
  emailRecordId: string | null;
  deliveryMode: WorkspaceEmailDeliveryMode;
  status: string;
  /**
   * Set the moment the Commit Engine successfully writes this event's
   * timeline summary during "Görüşmeyi Tamamla" — null until then. This
   * is the idempotency guard: a retried commit only links events where
   * this is still null, so a partially-failed commit never double-writes
   * a timeline entry for an event it already linked.
   */
  timelineLinkedAt: string | null;
};

export function unlinkedMailEvents(
  events: readonly WorkspaceEmailEvent[],
): WorkspaceEmailEvent[] {
  return events.filter(
    (event) => event.timelineLinkedAt === null,
  );
}

/**
 * Appends a new send to the targeted fuar's mailEvents[], deduped by
 * sendOperationKey — if createEmailForSendOperation resolved to an
 * already-existing row (a genuine retry within the same panel session),
 * this is a no-op rather than a second local event for the same send.
 */
export function withMailEventAppended(
  store: ExhibitionSessionStore,
  exhibitionId: string | null,
  event: WorkspaceEmailEvent,
): ExhibitionSessionStore {
  const draft = getSessionDraft(store, exhibitionId);

  if (
    draft.mailEvents.some(
      (existing) =>
        existing.sendOperationKey ===
        event.sendOperationKey,
    )
  ) {
    return store;
  }

  return withSessionDraft(store, exhibitionId, {
    mailEvents: [...draft.mailEvents, event],
  });
}

/**
 * Marks the given events (by id) as linked into the opportunity timeline —
 * called by the Commit Engine, one fuar at a time, only for the events it
 * actually just wrote a timeline entry for. Never touches any other
 * fuar's mailEvents, and never re-marks an event that's already linked.
 */
export function withMailEventsLinked(
  store: ExhibitionSessionStore,
  exhibitionId: string | null,
  linkedEventIds: readonly string[],
  linkedAt: string,
): ExhibitionSessionStore {
  if (linkedEventIds.length === 0) {
    return store;
  }

  const draft = getSessionDraft(store, exhibitionId);
  const linkedIds = new Set(linkedEventIds);

  return withSessionDraft(store, exhibitionId, {
    mailEvents: draft.mailEvents.map((event) =>
      linkedIds.has(event.id) && event.timelineLinkedAt === null
        ? { ...event, timelineLinkedAt: linkedAt }
        : event,
    ),
  });
}

/**
 * Sprint 25.4B Section E/H — the panel is locked to the fuar it was
 * opened for (panelSessionExhibitionId), which can differ from whatever
 * the sidebar is showing right now if the user switches fuar while the
 * panel stays open. Repository selections are live workspace state keyed
 * by the *sidebar's* current fuar, so they must be filtered down to only
 * the locked fuar's own documents before ever reaching the attachment
 * list — otherwise a fuar switch mid-panel would silently attach another
 * fuar's repository picks to this draft.
 */
export function filterRepositoryDocumentsForSession(
  documents: readonly SelectedExhibitionDocument[],
  panelSessionExhibitionId: string,
): SelectedExhibitionDocument[] {
  return documents.filter(
    (document) =>
      document.exhibitionId === panelSessionExhibitionId,
  );
}

/**
 * Sprint 25.4E — the ONE attachment source for Workspace Email. No
 * template placeholders, no Document Basket, no defaults: an attachment
 * exists here if and only if the user explicitly checked it off in the
 * Exhibition Repository panel (the caller must already have filtered
 * `documents` down to the locked panelSessionExhibitionId via
 * filterRepositoryDocumentsForSession above). Deliberately NOT
 * buildCommunicationAttachments (attachmentService.ts) — that helper's
 * template-placeholder fallback and Document Basket merge are exactly
 * what produced the "5 belge otomatik geldi" bug this fixes; its global
 * behavior for Communication Center is left untouched by not being
 * called here at all. Every field is real metadata carried over from the
 * repository selection — nothing here is invented.
 */
export function buildWorkspaceEmailAttachments(
  documents: readonly SelectedExhibitionDocument[],
): CommunicationAttachment[] {
  return documents.map((document) => ({
    id: `exhibition-workspace:${document.exhibitionId}:${document.role}`,
    fileName: document.fileName,
    source: "exhibition-workspace",
    displayName: document.displayName,
    exhibitionId: document.exhibitionId,
    exhibitionRole: document.role,
    fileUrl: document.resolvedUrl,
    mimeType: document.mimeType,
  }));
}

/**
 * SPRINT 26.2 — extracted out of resolveContractAttachmentForSession so
 * the "which contract" answer has exactly one implementation, shared by
 * both the Workspace Email attachment (below) and the "Sözleşme Gönder"
 * → Dropbox Sign trigger (CustomerWorkspace.handleWorkspaceEmailEvent) —
 * the two must never be able to disagree about which document a given
 * send refers to. Same rules as before: opportunityId required,
 * exhibitionId exact match, highest version wins.
 */
export function findLatestContractDocument(
  generatedDocuments: readonly GeneratedDocumentRecord[],
  exhibitionId: string,
  opportunityId: string | null,
): GeneratedDocumentRecord | null {
  if (!opportunityId) {
    return null;
  }

  const candidates = generatedDocuments.filter(
    (document) =>
      document.documentType === "participation-contract" &&
      document.exhibitionId === exhibitionId &&
      document.opportunityId === opportunityId,
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((newest, candidate) =>
    candidate.version > newest.version ? candidate : newest,
  );
}

/**
 * BUG-S26-002 — the "Sözleşme" template's own attachment source, entirely
 * separate from buildWorkspaceEmailAttachments above (which stays exactly
 * as Sprint 25.4E left it — Repository selections only). Picks the single
 * most recent generated contract for THIS fuar and THIS opportunity, if
 * one exists:
 *   - opportunityId is required — without a real opportunity there is
 *     nothing to strictly scope "same opportunity" against, so no
 *     contract is attached (matches "aynı opportunity" kuralı).
 *   - exhibitionId must match exactly (never another fuar's contract).
 *   - "most recent" = highest version among the matches.
 * Every generatedDocuments record only exists after the user has already
 * confirmed/saved/uploaded it (see CustomerWorkspace.handleDocumentConfirmed) —
 * there is no separate "draft" status to filter out.
 */
export function resolveContractAttachmentForSession(
  generatedDocuments: readonly GeneratedDocumentRecord[],
  exhibitionId: string,
  opportunityId: string | null,
): CommunicationAttachment | null {
  const latest = findLatestContractDocument(
    generatedDocuments,
    exhibitionId,
    opportunityId,
  );

  if (!latest) {
    return null;
  }

  return {
    id: `generated-contract:${latest.id}`,
    fileName: latest.signedPdfFileName ?? latest.fileName,
    source: "generated-contract",
    displayName: `Sözleşme (${latest.contractNumber})`,
    exhibitionId: latest.exhibitionId,
    // BUG-S26-002.1 — prefer the signed copy's own data URL; fall back to
    // the freshly generated (not-yet-signed) PDF's data URL so the
    // attachment is openable as soon as it's created, not only after
    // signing. Never re-generates/re-uploads — both are already-captured
    // bytes on this same record (see BUG-S26-001.3/BUG-S26-002).
    fileUrl:
      latest.signedPdfDataUrl ??
      latest.pdfDataUrl,
    mimeType: "application/pdf",
  };
}

/**
 * SPRINT 26.2 — VIAWA's one official signature-request trigger: a
 * "Sözleşme Gönder" send is the Contract template AND it actually
 * carried the real generated PDF (contractIncluded, set by
 * useWorkspaceEmailDraft.handleSend from resolveContractAttachmentForSession
 * above). Any other template, or a Contract-template send where no real
 * contract existed yet to attach, must never trigger Dropbox Sign.
 * Pure so the decision itself is unit-testable without a React harness —
 * see CustomerWorkspace.handleWorkspaceEmailEvent for the one caller.
 */
export function shouldTriggerSignatureRequestForEmailEvent(
  event: Pick<
    WorkspaceEmailEvent,
    "templateId" | "contractIncluded"
  >,
): boolean {
  return (
    event.templateId === "Contract" &&
    event.contractIncluded
  );
}

// Sprint 25.2 / Adım 2.1 — RFC 6068's addr-spec-list: individual
// addresses may need escaping (rare for a well-formed email address, but
// still possible for non-ASCII/space characters), while "@" and "."
// themselves are valid, unreserved-enough URI characters that must stay
// literal — encodeURI (not encodeURIComponent) is the one built-in that
// does exactly this, and it's applied per-address, before joining, so
// the "," separator itself is never touched/encoded.
function encodeMailtoAddress(
  address: string,
): string {
  return encodeURI(address.trim());
}

// Sprint 25.2.2 — RFC 6068 hfield values need RFC 3986 percent-encoding
// (the same generic-URI encoding encodeMailtoAddress above already uses
// for the address segment) — NOT URLSearchParams. URLSearchParams
// serializes with application/x-www-form-urlencoded (RFC 1866/the HTML
// form-submission convention), which encodes a space as "+". That "+"
// is only ever meant to be decoded back to a space by something that
// itself speaks x-www-form-urlencoded (an HTTP server reading a query
// string, or URLSearchParams's own parser) — a mailto: URI is not that;
// RFC 6068 mail clients decode hfields as plain percent-encoded text, so
// a literal "+" a strict client like Outlook receives stays a literal
// "+", never a space. encodeURIComponent has no such ambiguity: a space
// always becomes %20, and a literal "+" in the source text (e.g. a
// plus-addressed CC) is itself escaped to %2B, so it can never be
// misread as an encoded space either.
function encodeMailtoFieldValue(
  value: string,
): string {
  return encodeURIComponent(value);
}

/**
 * Sprint 25.2 / Adım 2 → 2.1 → 2.2 — the Contract template's replacement
 * for "Gönder": builds a mailto: URL from the draft's own to/cc/bcc/
 * subject/body, unchanged/unregenerated, so the user's default mail
 * client (Outlook) opens pre-filled and they attach the already-
 * downloaded PDF themselves. The primary recipient(s) go in the mailto:
 * address segment itself (RFC 6068 — comma-joined, each address
 * individually encoded via encodeMailtoAddress above); subject/body are
 * listed before cc/bcc — RFC 6068 itself doesn't require a particular
 * hfield order, but this is the conventional, widely-documented order
 * for maximum compatibility with real-world mailto parsers (notably
 * Outlook's), which are known to be sensitive to it. Every hfield goes
 * through encodeMailtoFieldValue above — no manual concatenation of
 * unescaped values anywhere. An empty draft.to still produces a valid
 * `mailto:?...` (no address segment at all), never a broken URL.
 */
export function buildContractMailtoUrl(
  draft: Pick<
    WorkspaceEmailDraft,
    "to" | "cc" | "bcc" | "subject" | "body"
  >,
): string {
  const hfields: string[] = [
    `subject=${encodeMailtoFieldValue(draft.subject)}`,
    `body=${encodeMailtoFieldValue(draft.body)}`,
  ];

  if (draft.cc.length > 0) {
    hfields.push(
      `cc=${encodeMailtoFieldValue(draft.cc.join(","))}`,
    );
  }

  if (draft.bcc.length > 0) {
    hfields.push(
      `bcc=${encodeMailtoFieldValue(draft.bcc.join(","))}`,
    );
  }

  const primaryRecipients = draft.to
    .map(encodeMailtoAddress)
    .join(",");

  return `mailto:${primaryRecipients}?${hfields.join("&")}`;
}

export type QuotationPriceSource = {
  standType: string;
  standAreaSqm: number;
  currency: string;
  grandTotal: number;
};

/**
 * Sprint 25.4B Section I — the one rule for where a Quotation email's
 * price content comes from. Draft price (this fuar's Exhibition Session,
 * calculated but not yet committed to an opportunity) always wins over an
 * already-persisted opportunity's approved price — a fresher, in-progress
 * calculation should never be shadowed by a stale saved one. Returns null
 * only when neither exists, which the caller must treat as "block the
 * Quotation template selection", never as a technical error.
 */
export function resolveQuotationPriceSource(input: {
  draftPriceResult: { result: PriceResult } | null;
  approvedOpportunityPrice: QuotationPriceSource | null;
}): QuotationPriceSource | null {
  if (input.draftPriceResult) {
    const { result } = input.draftPriceResult;

    return {
      standType: result.appliedInput.standType,
      standAreaSqm: result.appliedInput.standAreaSqm,
      currency: result.currency,
      grandTotal: result.grandTotal,
    };
  }

  return input.approvedOpportunityPrice;
}

// Turkish, one-line summary of a single mail event for the opportunity
// timeline — used by the Commit Engine's mail-linking step.
export function formatWorkspaceEmailEventSummary(
  event: WorkspaceEmailEvent,
): string {
  const recipients = [
    ...event.to,
    ...event.cc,
    ...event.bcc,
  ].join(", ") || "—";

  const attachmentNames =
    event.attachments
      .map((attachment) => attachment.fileName)
      .join(", ") || "Yok";

  return [
    `Alıcı: ${recipients}`,
    `Konu: ${event.subject}`,
    `Ekler: ${attachmentNames}`,
    event.quotationSummaryIncluded
      ? "Teklif özeti eklendi."
      : null,
    event.contractIncluded
      ? "Sözleşme eklendi."
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" · ");
}
