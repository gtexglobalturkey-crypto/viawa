import {
  BadgeEuro,
  FileSignature,
  FileText,
  Info,
  Mail,
  Map,
  PackageCheck,
} from "lucide-react";

export type SalesToolId =
  | "exhibition-info"
  | "floor-plan"
  | "price-calculator"
  | "quotation"
  | "contract-template"
  | "document-basket"
  | "email";

export const SALES_TOOLS = [
  {
    id: "exhibition-info",
    title: "Fuar Bilgileri",
    description:
      "Tarih, lokasyon, organizatör ve katılım bilgileri.",
    icon: Info,
  },
  {
    id: "floor-plan",
    title: "Kroki",
    description:
      "Salon planını ve uygun stand alanlarını görüntüle.",
    icon: Map,
  },
  {
    id: "price-calculator",
    title: "Fiyat Hesaplayıcı",
    description:
      "Stand alanı ve katılım tipine göre fiyat hesapla.",
    icon: BadgeEuro,
  },
  {
    id: "quotation",
    title: "Sözleşme Hazırla",
    description:
      "Aktif fuar ve müşteri bilgileriyle katılım sözleşmesi hazırla.",
    icon: FileSignature,
  },
  {
    id: "contract-template",
    title: "Sözleşme Şablonu",
    description:
      "Fuar sözleşme şablonunun mevcut olup olmadığını kontrol et ve aç.",
    icon: FileText,
  },
  {
    id: "document-basket",
    title: "Belge Sepeti",
    description:
      "Gönderilecek fuar belgelerini tek yerde hazırla.",
    icon: PackageCheck,
  },
  {
    id: "email",
    title: "E-posta",
    description:
      "Hazırlanan içerikleri çalışma alanından gönder.",
    icon: Mail,
  },
] satisfies Array<{
  id: SalesToolId;
  title: string;
  description: string;
  icon: typeof Info;
}>;
