export type DocumentBasketRole =
  | "flyer"
  | "brosur"
  | "fiyat_listesi"
  | "fuar_takvimi"
  | "kroki"
  | "sozlesme";

export type DocumentBasketItem = {
  id: DocumentBasketRole;
  title: string;
  exists: boolean;
  fileName: string | null;
};

// Ready-to-consume shape for other tools (e.g. the email module): only
// documents that are both selected and present on disk, normalized to a
// generic label so callers don't need to know about DocumentBasketItem.
export type SelectedDocumentBasketItem = {
  id: DocumentBasketRole;
  label: string;
  exists: true;
  fileName: string | null;
};
