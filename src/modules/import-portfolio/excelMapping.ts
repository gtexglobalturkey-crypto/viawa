/**
 * Column structure for the official import template
 * (resources/templates/VIAWA_Toplu_Firma_Yukleme_Sablonu.xlsx).
 *
 * These header strings are transcribed verbatim from row 4 of that file's
 * "Firma Veri Girişi" sheet (rows 1-3 are a title, an instructions line,
 * and a group-header row — see excelReader.ts). Do not invent or rename
 * columns here; if the template changes, re-read it and update this file
 * to match rather than guessing.
 */
export const EXCEL_TEMPLATE_SHEET_NAME =
  "Firma Veri Girişi";

export const excelColumns = {
  companyName: "Firma Ünvanı *",
  phone: "Telefon",
  email: "E-posta",
  taxOffice: "Vergi Dairesi",
  taxNumber: "Vergi Numarası",
  postalCode: "Posta Kodu",
  address: "Adres",
  city: "Şehir",
  district: "İlçe",
  country: "Ülke",
  website: "Web Sitesi",

  sectors: [
    "Sektör 1",
    "Sektör 2",
    "Sektör 3",
    "Sektör 4",
  ],

  productGroups: [
    "Ürün Grubu 1",
    "Ürün Grubu 2",
    "Ürün Grubu 3",
    "Ürün Grubu 4",
  ],

  /**
   * "Fuar Yetkilisi" and "Ana İletişim Kişisi" are two template columns
   * that both feed the app's single `is_primary` contact flag — the
   * company form's own checkbox is already labeled "Fuar Yetkilisi / Ana
   * İletişim Kişisi" as one combined role (see NewCompanyPage.tsx), so a
   * person marked "Evet" in either column is primary.
   */
  people: [
    {
      name: "Kişi 1 - Ad Soyad",
      role: "Kişi 1 - Ünvan",
      phone: "Kişi 1 - Telefon",
      email: "Kişi 1 - E-posta",
      isExhibitionContact:
        "Kişi 1 - Fuar Yetkilisi",
      isPrimaryContact:
        "Kişi 1 - Ana İletişim Kişisi",
      isSignatory:
        "Kişi 1 - İmza Yetkilisi",
    },
    {
      name: "Kişi 2 - Ad Soyad",
      role: "Kişi 2 - Ünvan",
      phone: "Kişi 2 - Telefon",
      email: "Kişi 2 - E-posta",
      isExhibitionContact:
        "Kişi 2 - Fuar Yetkilisi",
      isPrimaryContact:
        "Kişi 2 - Ana İletişim Kişisi",
      isSignatory:
        "Kişi 2 - İmza Yetkilisi",
    },
    {
      name: "Kişi 3 - Ad Soyad",
      role: "Kişi 3 - Ünvan",
      phone: "Kişi 3 - Telefon",
      email: "Kişi 3 - E-posta",
      isExhibitionContact:
        "Kişi 3 - Fuar Yetkilisi",
      isPrimaryContact:
        "Kişi 3 - Ana İletişim Kişisi",
      isSignatory:
        "Kişi 3 - İmza Yetkilisi",
    },
    {
      name: "Kişi 4 - Ad Soyad",
      role: "Kişi 4 - Ünvan",
      phone: "Kişi 4 - Telefon",
      email: "Kişi 4 - E-posta",
      isExhibitionContact:
        "Kişi 4 - Fuar Yetkilisi",
      isPrimaryContact:
        "Kişi 4 - Ana İletişim Kişisi",
      isSignatory:
        "Kişi 4 - İmza Yetkilisi",
    },
  ],
} as const;
