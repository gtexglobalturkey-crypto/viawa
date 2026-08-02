import type { ExhibitionDocumentId } from "./ExhibitionDocument";

// Shape carried by a checked-off document card — enough for a future
// "attach to email" step (mirrors SelectedDocumentBasketItem) without
// wiring that step in this sprint.
export type SelectedExhibitionDocument = {
  exhibitionId: string;
  exhibitionName: string;
  role: ExhibitionDocumentId;
  displayName: string;
  fileName: string;
  resolvedUrl: string;
  mimeType: string;
  exists: true;
  source: "document-basket";
};
