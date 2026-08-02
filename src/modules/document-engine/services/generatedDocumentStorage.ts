import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

// TEMPORARY repository for this sprint only — see
// call-workspace/pricing/services/approvedPriceSnapshotStorage.ts for the
// same rationale. GeneratedDocumentRecord has no Supabase table yet; this
// localStorage layer keeps a confirmed document's contract number,
// version history and status across a page reload. When a real
// `generated_documents` table exists, replace this file with a
// Supabase-backed service exposing the same load/save signatures —
// CustomerWorkspace should not need to change.

const STORAGE_KEY_PREFIX =
  "viawa.generatedDocuments.v1.";

function storageKeyForCompany(
  companyId: string,
): string {
  return `${STORAGE_KEY_PREFIX}${companyId}`;
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

const KNOWN_STATUS_VALUES = [
  "pdf-generated",
  "sent-for-signature",
  "signed",
];

const KNOWN_SIGNATURE_PROVIDERS = [
  "dropbox-sign",
];

// Each of these fields is optional on GeneratedDocumentRecord, so a
// missing value is valid — only a *present but malformed* value should
// make the whole record get dropped.
function hasValidOptionalSignatureFields(
  value: Record<string, unknown>,
): boolean {
  if (
    value.signatureProvider !==
      undefined &&
    !KNOWN_SIGNATURE_PROVIDERS.includes(
      value.signatureProvider as string,
    )
  ) {
    return false;
  }

  if (
    value.signedPdfDataUrl !==
      undefined &&
    !isNonEmptyString(
      value.signedPdfDataUrl,
    )
  ) {
    return false;
  }

  if (
    value.signedPdfFileName !==
      undefined &&
    !isNonEmptyString(
      value.signedPdfFileName,
    )
  ) {
    return false;
  }

  return true;
}

function isGeneratedDocumentRecord(
  value: unknown,
): value is GeneratedDocumentRecord {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    value.documentType ===
      "participation-contract" &&
    isNonEmptyString(
      value.contractNumber,
    ) &&
    typeof value.version === "number" &&
    Number.isFinite(value.version) &&
    isNonEmptyString(value.companyId) &&
    isNonEmptyString(value.exhibitionId) &&
    isNonEmptyString(
      value.approvedSnapshotId,
    ) &&
    isNonEmptyString(value.fileName) &&
    isNonEmptyString(value.status) &&
    KNOWN_STATUS_VALUES.includes(
      value.status,
    ) &&
    isNonEmptyString(value.createdAt) &&
    hasValidOptionalSignatureFields(value)
  );
}

// Unlike signatureProvider/signedPdfDataUrl/signedPdfFileName above, a
// malformed value in one of these four signature-lifecycle fields
// shouldn't drop the whole record — it just falls back to undefined,
// same as an old record that never had the field at all.
function readOptionalTrimmedString(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : undefined;
}

function readOptionalBoolean(
  value: unknown,
): boolean | undefined {
  return typeof value === "boolean"
    ? value
    : undefined;
}

function withSanitizedSignatureLifecycleFields(
  record: GeneratedDocumentRecord,
): GeneratedDocumentRecord {
  return {
    ...record,
    signatureRequestId:
      readOptionalTrimmedString(
        record.signatureRequestId,
      ),
    signatureRequestUrl:
      readOptionalTrimmedString(
        record.signatureRequestUrl,
      ),
    signatureSentAt:
      readOptionalTrimmedString(
        record.signatureSentAt,
      ),
    signatureCompletedAt:
      readOptionalTrimmedString(
        record.signatureCompletedAt,
      ),
    signatureTestMode:
      readOptionalBoolean(
        record.signatureTestMode,
      ),
  };
}

function readOptionalPositiveFiniteNumber(
  value: unknown,
): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : undefined;
}

// Same "malformed value falls back to undefined, never drops the whole
// record" rule as the signature-lifecycle fields above.
function withSanitizedStorageFields(
  record: GeneratedDocumentRecord,
): GeneratedDocumentRecord {
  return {
    ...record,
    storageBucket:
      record.storageBucket ===
      "contract-documents"
        ? "contract-documents"
        : undefined,
    storagePath:
      readOptionalTrimmedString(
        record.storagePath,
      ),
    storageUploadedAt:
      readOptionalTrimmedString(
        record.storageUploadedAt,
      ),
    storageSize:
      readOptionalPositiveFiniteNumber(
        record.storageSize,
      ),
    storageMimeType:
      record.storageMimeType ===
      "application/pdf"
        ? "application/pdf"
        : undefined,
    pdfDataUrl: readOptionalTrimmedString(
      record.pdfDataUrl,
    ),
  };
}

// Same "malformed value falls back to undefined, never drops the whole
// record" rule as the signature-lifecycle/storage fields above.
function withSanitizedArchiveFields(
  record: GeneratedDocumentRecord,
): GeneratedDocumentRecord {
  return {
    ...record,
    archivedToCompanyArchiveAt:
      readOptionalTrimmedString(
        record.archivedToCompanyArchiveAt,
      ),
  };
}

/**
 * Loads every generated-document record previously confirmed for this
 * company (contract number + version history). Invalid entries are
 * dropped individually rather than discarding the whole list. Never
 * throws — any read/parse problem simply yields an empty array.
 */
export function loadGeneratedDocuments(
  companyId: string,
): GeneratedDocumentRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue =
      window.localStorage.getItem(
        storageKeyForCompany(companyId),
      );

    if (!rawValue) {
      // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.8] STORAGE LOAD",
        {
          companyId,
          key: storageKeyForCompany(
            companyId,
          ),
          rawValuePresent: false,
          resultCount: 0,
        },
      );

      return [];
    }

    const parsedValue: unknown =
      JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
      console.error(
        "[BUG-S26.2.8] STORAGE LOAD",
        {
          companyId,
          key: storageKeyForCompany(
            companyId,
          ),
          rawValuePresent: true,
          parsedIsArray: false,
          resultCount: 0,
        },
      );

      return [];
    }

    const filtered = parsedValue.filter(
      isGeneratedDocumentRecord,
    );

    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC: compares the raw parsed count
    // against the count that survived isGeneratedDocumentRecord, to
    // catch a record silently dropped by validation (investigation
    // point #3).
    console.error(
      "[BUG-S26.2.8] SANITIZED RECORDS",
      {
        companyId,
        parsedCount: parsedValue.length,
        survivedValidationCount:
          filtered.length,
        droppedCount:
          parsedValue.length -
          filtered.length,
        parsedIds: parsedValue.map(
          (entry) =>
            isPlainObject(entry)
              ? (entry.id ?? null)
              : null,
        ),
        survivedIds: filtered.map(
          (entry) => entry.id,
        ),
      },
    );

    const result = filtered
      .map(
        withSanitizedSignatureLifecycleFields,
      )
      .map(withSanitizedStorageFields)
      .map(withSanitizedArchiveFields);

    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.8] STORAGE LOAD",
      {
        companyId,
        key: storageKeyForCompany(
          companyId,
        ),
        rawValuePresent: true,
        parsedIsArray: true,
        resultCount: result.length,
        records: result.map((record) => ({
          id: record.id,
          status: record.status,
          exhibitionId: record.exhibitionId,
          opportunityId:
            record.opportunityId ?? null,
          hasStoragePath: Boolean(
            record.storagePath,
          ),
          hasPdfDataUrl: Boolean(
            record.pdfDataUrl,
          ),
        })),
      },
    );

    return result;
  } catch (error) {
    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.8] STORAGE LOAD",
      {
        companyId,
        key: storageKeyForCompany(
          companyId,
        ),
        threw: true,
        errorName:
          error instanceof Error
            ? error.name
            : typeof error,
      },
    );

    return [];
  }
}

/**
 * Persists the full current generated-document list for this company.
 * Storage failures (quota exceeded, private browsing, etc.) are
 * swallowed — records simply keep working in-memory for the rest of the
 * session, exactly like before this repository existed.
 */
export function saveGeneratedDocuments(
  companyId: string,
  records: GeneratedDocumentRecord[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
  console.error(
    "[BUG-S26.2.8] STORAGE SAVE",
    {
      companyId,
      key: storageKeyForCompany(companyId),
      recordCount: records.length,
      recordIds: records.map(
        (record) => record.id,
      ),
    },
  );

  try {
    window.localStorage.setItem(
      storageKeyForCompany(companyId),
      JSON.stringify(records),
    );
  } catch (error) {
    // BUG-S26.2.8 — TEMPORARY DIAGNOSTIC.
    console.error(
      "[BUG-S26.2.8] STORAGE SAVE",
      {
        companyId,
        key: storageKeyForCompany(
          companyId,
        ),
        threw: true,
        errorName:
          error instanceof Error
            ? error.name
            : typeof error,
      },
    );
    // Ignored on purpose — see function comment above.
  }
}
