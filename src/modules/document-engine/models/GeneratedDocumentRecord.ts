export type GeneratedDocumentStatus =
  | "completed"
  // Legacy value retained so existing localStorage records remain readable.
  | "pdf-generated"
  | "sent-for-signature"
  | "signed";

/** One persisted generation version; PDF data URLs are session-only preview caches. */
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
  pdfSha256?: string;
  status: GeneratedDocumentStatus;
  createdAt: string;

  masterTemplateId?: string;
  googleDocFileId?: string;
  googleDocUrl?: string;
  googlePdfFileId?: string;
  googlePdfUrl?: string;
  generationStatus?: "COMPLETED" | "FAILED";

  // Manual evidence is archived in private Storage and referenced by the database.
  signedPdfDataUrl?: string;
  signedPdfStoragePath?: string;
  signedPdfFileName?: string;


  // Manual post-generation signature evidence remains independent from
  // document generation. No signing provider is required by V1.
  signatureCompletedAt?: string;

  // BUG-S26-001.3 — set once the Document Service has generated and
  // stored this PDF in the private contract-documents Storage bucket
  // (server-side upload; the browser never uploads this file itself —
  // see contractPdfService.ts/contractPdfStorageIdentity.ts). The
  // generated PDF archive. Independent of signedPdfDataUrl below, which
  // is the separately-uploaded post-signature copy.
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
