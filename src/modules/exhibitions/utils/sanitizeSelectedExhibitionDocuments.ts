import type { ExhibitionDocumentId } from "../models/ExhibitionDocument";
import type { SelectedExhibitionDocument } from "../models/SelectedExhibitionDocument";

const EXHIBITION_DOCUMENT_IDS: readonly ExhibitionDocumentId[] =
  [
    "fuar_takvimi",
    "flyer",
    "fiyat_listesi",
    "kroki",
    "sozlesme",
  ];

function isExhibitionDocumentId(
  value: unknown,
): value is ExhibitionDocumentId {
  return (
    typeof value === "string" &&
    (
      EXHIBITION_DOCUMENT_IDS as readonly string[]
    ).includes(value)
  );
}

// React Router `state` is untyped (`unknown` at runtime): it can come from a
// stale history entry, a manually-typed URL, or a future caller — never
// trust its shape. Only documents already confirmed present on disk
// (exists === true) with every required field intact survive.
export function sanitizeSelectedExhibitionDocuments(
  value: unknown,
): SelectedExhibitionDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitizedItems: SelectedExhibitionDocument[] =
    [];

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object"
    ) {
      continue;
    }

    const candidate =
      entry as Record<string, unknown>;

    if (
      typeof candidate.exhibitionId !==
        "string" ||
      typeof candidate.exhibitionName !==
        "string" ||
      !isExhibitionDocumentId(
        candidate.role,
      ) ||
      typeof candidate.displayName !==
        "string" ||
      typeof candidate.fileName !==
        "string" ||
      typeof candidate.resolvedUrl !==
        "string" ||
      typeof candidate.mimeType !==
        "string" ||
      candidate.exists !== true ||
      candidate.source !==
        "document-basket"
    ) {
      continue;
    }

    sanitizedItems.push({
      exhibitionId: candidate.exhibitionId,
      exhibitionName:
        candidate.exhibitionName,
      role: candidate.role,
      displayName: candidate.displayName,
      fileName: candidate.fileName,
      resolvedUrl: candidate.resolvedUrl,
      mimeType: candidate.mimeType,
      exists: true,
      source: "document-basket",
    });
  }

  return sanitizedItems;
}
