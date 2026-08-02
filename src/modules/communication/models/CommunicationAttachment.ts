import type { DocumentBasketRole } from "../../call-workspace/document-basket";
import type { ExhibitionDocumentId } from "../../exhibitions/models/ExhibitionDocument";

export type CommunicationAttachmentSource =
  | "template"
  | "document-basket"
  | "exhibition-workspace"
  // BUG-S26-002 — the opportunity's own generated contract PDF, auto-
  // attached when the "Sözleşme" template is selected (see
  // resolveContractAttachmentForSession in exhibitionSessionMail.ts).
  | "generated-contract";

export type CommunicationAttachment = {
  id: string;
  fileName: string;
  source: CommunicationAttachmentSource;
  documentRole?: DocumentBasketRole;
  /** Set only when source is "exhibition-workspace". */
  displayName?: string;
  exhibitionId?: string;
  exhibitionRole?: ExhibitionDocumentId;
  fileUrl?: string;
  mimeType?: string;
};

const DATA_URL_PATTERN = /^data:/i;
const PDF_DATA_URL_PATTERN = /^data:application\/pdf[;,]/i;
const NAVIGABLE_URL_PATTERN = /^(https?:\/\/|\/)/i;

/**
 * BUG-S26-002.1 — the ONE place that decides whether a Workspace Email
 * attachment can be opened in a new tab, source-agnostic (contract,
 * brochure, floor plan, price list, exhibition calendar — anything with
 * a real `fileUrl`, never hard-coded to "generated-contract"). Never
 * invents a URL: `fileUrl` is always populated upstream (see
 * buildWorkspaceEmailAttachments / resolveContractAttachmentForSession)
 * from an already-captured source (a repository document's own URL, or a
 * generated PDF's own data URL) — this function only validates what's
 * already there, it never derives a storage path into a guessed public
 * URL. A bare `data:` URL is only trusted when it's identifiably a PDF
 * (by its own data URL prefix or the attachment's mimeType) — an
 * ordinary http(s)/relative URL is trusted as-is, since navigating to it
 * is exactly what the browser would do for a normal link.
 */
export function resolveOpenableAttachmentUrl(
  attachment: Pick<
    CommunicationAttachment,
    "fileUrl" | "mimeType"
  >,
): string | null {
  const url = attachment.fileUrl?.trim();

  if (!url) {
    return null;
  }

  if (DATA_URL_PATTERN.test(url)) {
    const isPdfDataUrl =
      PDF_DATA_URL_PATTERN.test(url);
    const isPdfMimeType =
      attachment.mimeType ===
      "application/pdf";

    return isPdfDataUrl || isPdfMimeType
      ? url
      : null;
  }

  return NAVIGABLE_URL_PATTERN.test(url)
    ? url
    : null;
}
