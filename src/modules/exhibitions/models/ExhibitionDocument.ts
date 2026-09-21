import {
  BadgeEuro,
  CalendarDays,
  FileSignature,
  ImageIcon,
  Map,
} from "lucide-react";

// Same role ids as the Document Basket / Exhibition Repository system
// (vite-plugins/documentBasketPlugin.ts) — this module consumes that
// same API and role set rather than inventing its own.
export type ExhibitionDocumentId =
  | "fuar_takvimi"
  | "flyer"
  | "fiyat_listesi"
  | "kroki"
  | "sozlesme";

export type ExhibitionDocument = {
  id: ExhibitionDocumentId;
  title: string;
  icon: typeof CalendarDays;
  // When set, the tile resolves this exhibition_sales_documents.document_type
  // (a Google Drive reference) instead of a local template file.
  salesDocumentType?: string;
};

// Fixed order, fixed set — do not add documents or reorder without an
// explicit spec change.
export const EXHIBITION_DOCUMENTS: ExhibitionDocument[] = [
  {
    id: "fuar_takvimi",
    title: "Fuar Takvimi",
    icon: CalendarDays,
  },
  {
    id: "flyer",
    title: "Flyer",
    icon: ImageIcon,
    salesDocumentType: "flyer",
  },
  {
    id: "fiyat_listesi",
    title: "Fiyat Listesi",
    icon: BadgeEuro,
  },
  {
    id: "kroki",
    title: "Kroki",
    icon: Map,
    salesDocumentType: "floor_plan",
  },
  {
    id: "sozlesme",
    title: "Sözleşme",
    icon: FileSignature,
  },
];
