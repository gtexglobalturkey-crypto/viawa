import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

// Strips only genuinely filesystem-unsafe characters (Windows is the
// strictest of the three real targets: \/:*?"<>|) and collapses
// whitespace to a single dash. Turkish characters are intentionally kept
// — modern Windows/macOS/Linux filesystems are all UTF-8 safe, and the
// spec explicitly expects Turkish characters to survive in the file
// name (see spec/test section 13: "PDF dosya adında Türkçe karakterler").
function sanitizeFileNameSegment(
  value: string,
): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * {contractNumber}_{exhibitionShortName}_{companyName}_v{version}.pdf
 * e.g. EXP-2027-000124_WAMPEX_ABC-Mining_v1.pdf
 */
export function generateDocumentFileName(
  contractNumber: string,
  exhibitionShortName: string,
  companyName: string,
  version: number,
): string {
  const segments = [
    sanitizeFileNameSegment(contractNumber),
    sanitizeFileNameSegment(
      exhibitionShortName,
    ),
    sanitizeFileNameSegment(companyName),
  ].filter((segment) => segment.length > 0);

  return `${segments.join("_")}_v${version}.pdf`;
}

/**
 * v1, v2, v3, ... — always the next integer after the highest existing
 * version for this exact contract number. Never overwrites: each call
 * with a genuinely new generation returns a version one higher than
 * anything already recorded.
 */
export function getNextDocumentVersion(
  existingRecords: GeneratedDocumentRecord[],
  contractNumber: string,
): number {
  const versionsForThisContract =
    existingRecords
      .filter(
        (record) =>
          record.contractNumber ===
          contractNumber,
      )
      .map((record) => record.version);

  if (versionsForThisContract.length === 0) {
    return 1;
  }

  return Math.max(...versionsForThisContract) + 1;
}
