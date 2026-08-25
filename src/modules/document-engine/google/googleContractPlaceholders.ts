import type { TemplateMergeResult } from "../merge/models";

export const GOOGLE_CONTRACT_PLACEHOLDERS = [
  "CNO", "CDT", "FNM", "FDT", "FCI", "FCO", "FVE", "FHL", "SNO", "SAR", "STY",
  "EXTRA_MATERIAL_INFORMATION", "COMPANY_LEGAL_NAME", "COMPANY_PHONE", "COMPANY_EMAIL",
  "COMPANY_ADDRESS", "COMPANY_TAX_OFFICE", "COMPANY_TAX_NUMBER", "COMPANY_WEBSITE", "PRODUCT_GROUP",
  "EXHIBITION_CONTACT", "EXHIBITION_CONTACT_MOBILE", "EXHIBITION_CONTACT_EMAIL", "SGN",
  "F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08",
  "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08",
  "D1", "D2", "D3", "D4", "D5", "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5", "R1", "R2", "R3", "R4", "R5",
  "CSN", "CST", "CSG",
] as const;

export const ALLOWED_UNRESOLVED_GOOGLE_CONTRACT_TOKENS = new Set<string>();
const FALLBACK = "-";

function text(value: unknown, fallback = FALLBACK): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

export function formatGoogleContractStandArea(value: unknown): string {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(numeric) ? `${numeric} m²` : FALLBACK;
}

export type GoogleContractPlaceholderMap = Readonly<Record<string, string>>;

export function buildGoogleContractPlaceholderMap(merge: TemplateMergeResult): GoogleContractPlaceholderMap {
  const value = (tag: string, fallback = FALLBACK) => text(merge.values[tag], fallback);
  const currency = value("Pricing.GrandTotal.Currency");
  const result: Record<string, string> = {
    CNO: value("Template.sozlesme_no", ""), CDT: value("Template.sozlesme_tarihi", ""),
    FNM: value("Template.fuar_adi", ""), FDT: value("Template.fuar_tarih"), FCI: value("Template.sehir"),
    FCO: value("Template.ulke"), FVE: value("Template.fuar_alani"), FHL: value("Template.hol"),
    SNO: value("Template.stand_no"), SAR: formatGoogleContractStandArea(merge.values["Template.stand_alani"]), STY: value("Template.stand_turu"),
    EXTRA_MATERIAL_INFORMATION: [1, 2, 3].map((i) => value(`ExtraInformation.Line${i}`, "")).filter(Boolean).join("; ") || FALLBACK,
    COMPANY_LEGAL_NAME: value("Company.LegalName", ""), COMPANY_PHONE: value("Company.Phone"),
    COMPANY_EMAIL: value("Company.Email"), COMPANY_ADDRESS: value("Company.Address"),
    COMPANY_TAX_OFFICE: value("Company.TaxOffice"), COMPANY_TAX_NUMBER: value("Company.TaxNumber"),
    COMPANY_WEBSITE: value("Company.Website"), PRODUCT_GROUP: value("Company.ProductGroup"),
    EXHIBITION_CONTACT: value("Contact.ExhibitionContact"), EXHIBITION_CONTACT_MOBILE: value("Contact.Phone"),
    EXHIBITION_CONTACT_EMAIL: value("Contact.Email"), SGN: value("Contact.Signatory"),
    CSN: value("Contact.SignatoryName", ""), CST: value("Contact.SignatoryTitle", ""), CSG: "",
  };
  const pricingTags = ["StandFee", "RegistrationFee", "AdditionalServices", "Discount", "Tax", "OrganizerTotal", "ServiceFee", "GrandTotal"];
  pricingTags.forEach((tag, index) => {
    const number = String(index + 1).padStart(2, "0");
    result[`F${number}`] = value(`Pricing.${tag}.Amount`);
    result[`C${number}`] = value(`Pricing.${tag}.Currency`, currency);
  });
  for (let i = 1; i <= 5; i += 1) {
    result[`D${i}`] = value(`PaymentPlan.Payment${i}.DueDate`);
    result[`A${i}`] = value(`PaymentPlan.Payment${i}.Amount`);
    result[`P${i}`] = result[`A${i}`] === FALLBACK ? FALLBACK : currency;
    result[`R${i}`] = value(`PaymentPlan.Payment${i}.Payee`);
  }
  return result;
}

export function validateGoogleContractPlaceholderMap(values: GoogleContractPlaceholderMap): string[] {
  const required = ["CNO", "CDT", "FNM", "COMPANY_LEGAL_NAME", "CSN", "CST"];
  return required.filter((key) => !values[key]?.trim() || values[key] === FALLBACK);
}

export function findDisallowedUnresolvedPlaceholders(textValue: string): string[] {
  return [...new Set(textValue.match(/\{\{[^{}]+\}\}/g) ?? [])]
    .filter((token) => !ALLOWED_UNRESOLVED_GOOGLE_CONTRACT_TOKENS.has(token));
}
