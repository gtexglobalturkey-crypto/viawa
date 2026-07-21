const TEMPLATE_ATTACHMENTS: Record<
  string,
  string[]
> = {
  "Information Package": [
    "Şirket Profili.pdf",
    "Fuar Broşürü.pdf",
    "Kroki.pdf",
    "Fiyat Listesi.pdf",
    "Katılım Şartları.pdf",
  ],

  "Exhibition Presentation": [
    "Fuar Sunumu.pdf",
    "Şirket Profili.pdf",
  ],

  Quotation: [
    "Resmi Teklif.pdf",
    "Fiyat Hesaplaması.pdf",
    "Kroki.pdf",
  ],

  "Revised Quotation": [
    "Revize Teklif.pdf",
    "Güncel Fiyat Listesi.pdf",
    "Güncel Kat Planı.pdf",
  ],

  Contract: [
    "Katılım Sözleşmesi.pdf",
    "Şartlar ve Koşullar.pdf",
  ],

  "Visa Invitation": [
    "Vize Davet Mektubu.pdf",
  ],

  "Visitor Invitation": [
    "Ziyaretçi Daveti.pdf",
  ],

  "Thank You": [],
};

export function getAttachments(
  template: string,
): string[] {
  return (
    TEMPLATE_ATTACHMENTS[template] ?? []
  );
}