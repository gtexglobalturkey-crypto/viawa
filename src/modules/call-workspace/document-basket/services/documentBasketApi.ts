import type {
  DocumentBasketItem,
  DocumentBasketRole,
} from "../models/DocumentBasketItem";

export async function fetchDocumentBasketItems(): Promise<
  DocumentBasketItem[]
> {
  const response = await fetch(
    "/api/document-basket/status",
  );

  if (!response.ok) {
    throw new Error(
      "Belge sepeti durumu alınamadı.",
    );
  }

  const data = (await response.json()) as {
    items: DocumentBasketItem[];
  };

  return data.items;
}

export async function openDocumentBasketItem(
  role: DocumentBasketRole,
): Promise<void> {
  const response = await fetch(
    `/api/document-basket/open?role=${encodeURIComponent(
      role,
    )}`,
  );

  if (!response.ok) {
    const data = (await response
      .json()
      .catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(
      data?.error ?? "Belge açılamadı.",
    );
  }
}
