// BUG-S26-001.3 — the Document Service uploads the generated PDF to the
// private `contract-documents` Storage bucket, at a path the server
// derives deterministically rather than returning in its response (the
// PDF endpoint's contract is fixed — see DOKUNULMAYACAKLAR). This mirrors
// that exact derivation — document-service/src/storage/contractPdfStorage.ts
// `documentRecordId()` — so the frontend can record a real,
// dereferenceable storageBucket/storagePath on GeneratedDocumentRecord
// (needed by dropboxSignService.ts's "İmzaya Gönder", which reads the PDF
// directly from Storage using that path). SHA-256 is a fixed, standard
// digest, so Web Crypto here and Node's crypto over there produce
// byte-identical output for the same input string — see the accompanying
// test, which cross-checks this against a Node-computed value.
//
// If document-service/src/storage/contractPdfStorage.ts's own formula
// ever changes, this must change with it.
export async function computeContractPdfDocumentRecordId(
  companyId: string,
  opportunityId: string,
  approvedSnapshotId: string,
): Promise<string> {
  const input = `participation-contract:${companyId}:${opportunityId}:${approvedSnapshotId}`;
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );

  const hex = Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildContractPdfStoragePath(
  userId: string,
  companyId: string,
  documentRecordId: string,
  fileName: string,
): string {
  return `${userId}/${companyId}/${documentRecordId}/${fileName}`;
}

// BUG-S26.2.4 — the inverse of buildContractPdfStoragePath above: pulls
// the deterministic documentRecordId (the path's 3rd segment) back out
// of an already-built storagePath. The ONLY safe way to recover it —
// GeneratedDocumentRecord.id is a separate, random client-side
// identifier (createDocumentId() in ContractPreviewModal.tsx) that was
// NEVER the same value as documentRecordId, and must never be sent to
// dropbox-sign-send as generatedDocumentId (see dropboxSignService.ts —
// sending document.id there is what produced the 422 "Contract document
// path is invalid." on every real request).
//
// Deliberately dumb: no URL-decoding, no "."/".." resolution, no
// normalization — this only recognizes the exact, already-known
// 4-segment shape (userId/companyId/documentRecordId/fileName) and
// rejects anything else, including any empty segment. It never asserts
// ownership/trust — whether the path actually belongs to the requesting
// user is still verified only by the Edge Function
// (validateStoragePathOwnership); this helper is a pure parser.
export function extractGeneratedDocumentStorageIdentity(
  storagePath: string | undefined,
): string | null {
  if (!storagePath) {
    return null;
  }

  const segments = storagePath.split("/");

  if (segments.length !== 4) {
    return null;
  }

  const trimmedSegments = segments.map(
    (segment) => segment.trim(),
  );

  if (
    trimmedSegments.some(
      (segment) => segment.length === 0,
    )
  ) {
    return null;
  }

  return trimmedSegments[2];
}
