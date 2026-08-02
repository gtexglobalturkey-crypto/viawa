export type GeneratedDocumentStatus =
  | "pdf-generated"
  | "sent-for-signature"
  | "signed";

/**
 * An immutable record of one generated document version. Never edited in
 * place once created — a re-generation for the same contract creates a
 * new record with version+1 (see engine/documentVersioning.ts). Kept in
 * memory for this sprint (see report: no migration yet), mirroring how
 * ApprovedPriceSnapshot itself is kept — the shape is already what a
 * future `generated_documents` table would look like.
 */
// Only provider wired up this sprint. Adobe Sign, if added later, is
// another literal in this same union — no provider abstraction needed
// yet for a single provider.
export type SignatureProvider = "dropbox-sign";

export type GeneratedDocumentRecord = {
  id: string;
  documentType: "participation-contract";
  contractNumber: string;
  version: number;
  companyId: string;
  exhibitionId: string;
  opportunityId?: string;
  approvedSnapshotId: string;
  fileName: string;
  filePath?: string;
  status: GeneratedDocumentStatus;
  createdAt: string;

  // Set once "İmzaya Gönder" is used (status becomes "sent-for-signature").
  signatureProvider?: SignatureProvider;

  // Set once the user manually uploads the signed PDF (status becomes
  // "signed"). No backend yet, so the file itself — not just a path —
  // is stored as a data URL, same place GeneratedDocumentRecord already
  // lives (company-scoped localStorage).
  signedPdfDataUrl?: string;
  signedPdfFileName?: string;

  // Populated once the real Dropbox Sign API is wired up — not written
  // this sprint (see dropboxSignService.ts, still a stub).
  signatureRequestId?: string;
  signatureRequestUrl?: string;

  // ISO timestamps for the signature lifecycle, distinct from createdAt
  // (which marks the PDF's own generation).
  signatureSentAt?: string;
  signatureCompletedAt?: string;

  // SPRINT 26.2.2 — whether the signature request behind
  // signatureRequestId was sent in Dropbox Sign test mode (not legally
  // binding), resolved server-side only (see dropbox-sign-send/
  // testModeResolution.ts) — never settable by the client. Lets the UI
  // show the correct test-vs-production message instead of assuming.
  signatureTestMode?: boolean;

  // BUG-S26-001.3 — set once the Document Service has generated and
  // stored this PDF in the private contract-documents Storage bucket
  // (server-side upload; the browser never uploads this file itself —
  // see contractPdfService.ts/contractPdfStorageIdentity.ts). The
  // "official" copy Dropbox Sign reads from. Independent of
  // signedPdfDataUrl below, which is the separately-uploaded
  // post-signature copy.
  storageBucket?: "contract-documents";
  storagePath?: string;
  storageUploadedAt?: string;
  storageSize?: number;
  storageMimeType?: "application/pdf";

  // BUG-S26-001.3 — the actual generated (not-yet-signed) PDF bytes, as a
  // base64 data URL, captured directly from the Document Service's
  // response at generation time. Lets the app offer an immediate open/
  // download action and survives a page reload (same reason
  // signedPdfDataUrl below is a data URL and not an object URL).
  pdfDataUrl?: string;

  // BUG-S26.003.2 — set once a "signed" record has been moved into the
  // company's Firma Arşivi (on Won closure). References the SAME
  // storageBucket/storagePath above — archiving never re-uploads or
  // duplicates the PDF, it only stamps this record as archived.
  archivedToCompanyArchiveAt?: string;
};
