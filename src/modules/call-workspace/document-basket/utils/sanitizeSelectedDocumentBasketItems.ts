import type {
  DocumentBasketRole,
  SelectedDocumentBasketItem,
} from "../models/DocumentBasketItem";

export const DOCUMENT_BASKET_ROLES: readonly DocumentBasketRole[] =
  [
    "flyer",
    "brosur",
    "fiyat_listesi",
    "fuar_takvimi",
    "kroki",
  ];

function isDocumentBasketRole(
  value: unknown,
): value is DocumentBasketRole {
  return (
    typeof value === "string" &&
    (
      DOCUMENT_BASKET_ROLES as readonly string[]
    ).includes(value)
  );
}

// React Router `state` is untyped (`unknown` at runtime): it can come from
// a stale history entry, a manually-typed URL, or a future caller — never
// trust its shape. Only role/exists/label/fileName pass through, and only
// documents already confirmed present on disk (exists === true) survive.
export function sanitizeSelectedDocumentBasketItems(
  value: unknown,
): SelectedDocumentBasketItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sanitizedItems: SelectedDocumentBasketItem[] =
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
      !isDocumentBasketRole(
        candidate.id,
      ) ||
      typeof candidate.label !==
        "string" ||
      candidate.exists !== true
    ) {
      continue;
    }

    const fileName =
      typeof candidate.fileName ===
      "string"
        ? candidate.fileName
        : null;

    sanitizedItems.push({
      id: candidate.id,
      label: candidate.label,
      exists: true,
      fileName,
    });
  }

  return sanitizedItems;
}
