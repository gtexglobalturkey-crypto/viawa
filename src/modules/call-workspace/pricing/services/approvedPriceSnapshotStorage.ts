import type { ApprovedPriceSnapshot } from "../models/ApprovedPriceSnapshot";

// TEMPORARY repository for this sprint only. ApprovedPriceSnapshot has no
// Supabase table yet (no migration was authorized) — this localStorage
// layer exists purely so an approved price survives a page reload
// instead of living only in CustomerWorkspace component state. When a
// real `approved_price_snapshots` table exists, this whole file should
// be replaced by a Supabase-backed service exposing the same
// load/save function signatures, and CustomerWorkspace shouldn't need to
// change at all.

const STORAGE_KEY_PREFIX =
  "viawa.approvedPriceSnapshots.v1.";

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

// A shallow, top-level check on purpose: this store only ever receives
// data this same app wrote (via saveApprovedPriceSnapshots), so the goal
// here is crash-safety against corrupted/hand-edited localStorage, not
// exhaustively re-validating every PriceInput/PriceResult number field.
function isApprovedPriceSnapshot(
  value: unknown,
): value is ApprovedPriceSnapshot {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.opportunityId) &&
    isNonEmptyString(value.exhibitionId) &&
    isNonEmptyString(value.exhibitionName) &&
    (value.pricingSource ===
      "exhibition-config" ||
      value.pricingSource === "manual") &&
    isNonEmptyString(value.approvedAt) &&
    isPlainObject(value.priceInput) &&
    isPlainObject(value.priceResult)
  );
}

/**
 * Loads every approved price previously saved for this company. Invalid
 * entries are dropped individually (not the whole store) so one corrupt
 * record can't take every other approved price down with it. Never
 * throws — any read/parse problem simply yields an empty map.
 */
export function loadApprovedPriceSnapshots(
  companyId: string,
): Record<string, ApprovedPriceSnapshot> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue =
      window.localStorage.getItem(
        storageKeyForCompany(companyId),
      );

    if (!rawValue) {
      return {};
    }

    const parsedValue: unknown =
      JSON.parse(rawValue);

    if (!isPlainObject(parsedValue)) {
      return {};
    }

    const validEntries: Record<
      string,
      ApprovedPriceSnapshot
    > = {};

    for (const [key, entry] of Object.entries(
      parsedValue,
    )) {
      if (isApprovedPriceSnapshot(entry)) {
        validEntries[key] = entry;
      }
    }

    return validEntries;
  } catch {
    return {};
  }
}

/**
 * Persists the full current approved-price map for this company. Storage
 * failures (quota exceeded, private browsing, etc.) are swallowed —
 * approved prices simply keep working in-memory for the rest of the
 * session, exactly like before this repository existed.
 */
export function saveApprovedPriceSnapshots(
  companyId: string,
  snapshots: Record<
    string,
    ApprovedPriceSnapshot
  >,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKeyForCompany(companyId),
      JSON.stringify(snapshots),
    );
  } catch {
    // Ignored on purpose — see function comment above.
  }
}
