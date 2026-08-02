import type { GeneratedDocumentRecord } from "../models/GeneratedDocumentRecord";

const CONTRACT_NUMBER_PREFIX = "EXP";

function resolveContractYear(
  exhibitionStartDate: string | undefined,
  now: Date,
): number {
  if (exhibitionStartDate) {
    const parsedDate = new Date(
      exhibitionStartDate,
    );

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getFullYear();
    }
  }

  return now.getFullYear();
}

/**
 * A contract number is stable for the life of a contract — the same
 * opportunity+exhibition pair always reuses its first-issued number
 * across every later version (v2, v3, ...); only a genuinely new
 * contract (new opportunity+exhibition pair) gets a new one. The
 * sequence portion is derived from how many contract numbers already
 * exist for that year in this session — there is no persisted, shared
 * counter (see report: component-state only, no migration this sprint).
 */
export function getOrCreateContractNumber(
  existingRecords: GeneratedDocumentRecord[],
  opportunityId: string,
  exhibitionId: string,
  exhibitionStartDate: string | undefined,
  now: Date = new Date(),
): string {
  const existingForThisContract =
    existingRecords.find(
      (record) =>
        record.opportunityId ===
          opportunityId &&
        record.exhibitionId === exhibitionId,
    );

  if (existingForThisContract) {
    return existingForThisContract.contractNumber;
  }

  const year = resolveContractYear(
    exhibitionStartDate,
    now,
  );

  const yearPrefix = `${CONTRACT_NUMBER_PREFIX}-${year}-`;

  const usedSequenceNumbers = new Set(
    existingRecords
      .filter((record) =>
        record.contractNumber.startsWith(
          yearPrefix,
        ),
      )
      .map((record) =>
        Number(
          record.contractNumber.slice(
            yearPrefix.length,
          ),
        ),
      )
      .filter((value) =>
        Number.isFinite(value),
      ),
  );

  let nextSequence = 1;

  while (usedSequenceNumbers.has(nextSequence)) {
    nextSequence += 1;
  }

  const sequenceLabel = String(
    nextSequence,
  ).padStart(6, "0");

  return `${yearPrefix}${sequenceLabel}`;
}
