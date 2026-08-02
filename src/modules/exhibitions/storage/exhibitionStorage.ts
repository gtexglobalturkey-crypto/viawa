import type { Exhibition } from "../models/Exhibition";

const STORAGE_KEY = "viawa.exhibitions.v1";
const SELECTED_EXHIBITION_STORAGE_KEY =
  "viawa.selected-exhibition-id.v1";

function isOptionalString(
  value: unknown,
): value is string | undefined {
  return (
    value === undefined ||
    typeof value === "string"
  );
}

function isExhibition(
  value: unknown,
): value is Exhibition {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.shortName ===
      "string" &&
    typeof candidate.createdAt ===
      "string" &&
    isOptionalString(candidate.city) &&
    isOptionalString(candidate.country) &&
    isOptionalString(
      candidate.startDate,
    ) &&
    isOptionalString(candidate.endDate)
  );
}

// No sample exhibitions are ever seeded here — an empty/missing/corrupt
// entry simply resolves to an empty list.
export function loadExhibitions(): Exhibition[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isExhibition);
  } catch {
    return [];
  }
}

export function saveExhibitions(
  exhibitions: Exhibition[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(exhibitions),
    );
  } catch {
    // Storage full or unavailable (e.g. private browsing) — the
    // prototype keeps working in-memory for the current session.
  }
}

export function loadSelectedExhibitionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedId = window.localStorage.getItem(
      SELECTED_EXHIBITION_STORAGE_KEY,
    );

    return storedId?.trim() || null;
  } catch {
    return null;
  }
}

export function saveSelectedExhibitionId(
  exhibitionId: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (exhibitionId) {
      window.localStorage.setItem(
        SELECTED_EXHIBITION_STORAGE_KEY,
        exhibitionId,
      );
    } else {
      window.localStorage.removeItem(
        SELECTED_EXHIBITION_STORAGE_KEY,
      );
    }
  } catch {
    // Selection persistence is optional; in-memory selection still works.
  }
}
