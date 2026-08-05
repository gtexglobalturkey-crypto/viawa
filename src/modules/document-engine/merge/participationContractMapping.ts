import type { Contact } from "../../../types/database";
import {
  PARTICIPATION_CONTRACT_DOCUMENT_TYPE,
  PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME,
} from "../templates/participation-contract/templateMetadata";
import type {
  DocumentMergeContext,
  TemplateFieldMapping,
  TemplateMappingDefinition,
} from "./models";

const STAND_TYPE_LABELS: Readonly<
  Record<string, string>
> = {
  "space-only": "Boş Alan",
  "shell-scheme": "Standart Stand",
  "premium-shell": "Premium Stand",
  custom: "Özel Stand",
  "custom-stand": "Özel Stand",
  outdoor: "Dış Alan",
};

export const MATERIAL_KEYS = [
  "HeaderText",
  "DigitalPrints",
  "Table",
  "Shelf",
  "HangingRail",
  "Spotlight",
  "PowerSocket",
  "Refrigerator",
  "InfoDesk",
  "Chair",
  "WasteBin",
  "Other",
] as const;

export type MaterialKey = (typeof MATERIAL_KEYS)[number];

export const QUANTITY_MATERIAL_KEYS = [
  "Table",
  "Shelf",
  "HangingRail",
  "Spotlight",
  "PowerSocket",
  "Refrigerator",
  "InfoDesk",
  "Chair",
  "WasteBin",
] as const;

// Sprint 25.8 — the master DOCX template's Stand Malzemeleri row labels
// are static text next to each StandMaterials.{key} checkbox/quantity
// Content Control (verified directly against
// resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx),
// not a Content Control themselves. Kept here, alongside MATERIAL_KEYS,
// as the single place a data-entry UI reads real key/label pairs from —
// never a UI-side guess or a second hardcoded copy.
export const MATERIAL_LABELS: Readonly<Record<MaterialKey, string>> = {
  HeaderText: "Alınlık Yazısı",
  DigitalPrints: "Dijital Baskılar",
  Table: "Masa",
  Shelf: "Raf",
  HangingRail: "Askılık Boru",
  Spotlight: "Spot",
  PowerSocket: "Priz",
  Refrigerator: "Buzdolabı",
  InfoDesk: "Info Desk",
  Chair: "Sandalye",
  WasteBin: "Çöp Kovası",
  Other: "Diğer",
};

// Sprint 25.3 — document_settings' issuer/bank rows use the literal
// string "TO_BE_DEFINED" as their own deliberate not-yet-configured
// sentinel (see the row's own `status: "DEMO_CONFIGURATION"` marker,
// already surfaced today by document-service's /ready endpoint as
// `businessConfiguration: "demo"`). The merge/mapping layer never saw
// that sentinel before and passed it straight through into the PDF as
// literal visible text. Treated exactly like an empty value (never
// invents a real address/bank name) — the Content Control simply
// renders blank, same as any other genuinely-empty optional field.
const UNCONFIGURED_SENTINEL = "TO_BE_DEFINED";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== UNCONFIGURED_SENTINEL
    ? trimmed
    : undefined;
}

function fullName(contact: Contact | undefined) {
  if (!contact) {
    return undefined;
  }

  return clean(
    [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" "),
  );
}

function contactNameAndTitle(
  contact: Contact | undefined,
) {
  const name = fullName(contact);
  const title = clean(contact?.title);

  return clean([name, title].filter(Boolean).join(" — "));
}

function primaryContact(context: DocumentMergeContext) {
  return context.contacts.find(
    (contact) => contact.is_primary,
  );
}

function signatoryContact(
  context: DocumentMergeContext,
) {
  return context.contacts.find(
    (contact) => contact.is_signatory,
  );
}

function exhibitionDate(context: DocumentMergeContext) {
  const start = clean(context.exhibition?.start_date);
  const end = clean(context.exhibition?.end_date);
  return clean([start, end].filter(Boolean).join(" – "));
}

function currency(context: DocumentMergeContext) {
  return clean(
    context.priceSnapshot?.priceResult.currency ??
      context.opportunity.price_currency,
  );
}

function price(
  resolver: (
    context: DocumentMergeContext,
  ) => number | null | undefined,
) {
  return (context: DocumentMergeContext) =>
    resolver(context);
}

const fields: TemplateFieldMapping<DocumentMergeContext>[] = [
  {
    tag: "Template.expovia_merkez_adresi",
    title: "EXPOVIA Address",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.address),
  },
  {
    tag: "Template.expovia_mersis_no",
    title: "EXPOVIA MERSIS Number",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.mersisNumber),
  },
  {
    tag: "Template.expovia_ticaret_sicil_no",
    title: "EXPOVIA Trade Registry Number",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.tradeRegistryNumber),
  },
  {
    tag: "Template.expovia_vergi_dairesi",
    title: "EXPOVIA Tax Office",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.taxOffice),
  },
  {
    tag: "Template.expovia_vergi_no",
    title: "EXPOVIA Tax Number",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.taxNumber),
  },
  {
    tag: "Template.expovia_web_sitesi",
    title: "EXPOVIA Website",
    source: "settings",
    resolve: ({ settings }) => clean(settings.issuer.website),
  },
  {
    tag: "Template.sozlesme_no",
    title: "Contract Number",
    source: "document",
    required: true,
    resolve: ({ document }) => clean(document.contractNumber),
  },
  {
    tag: "Template.sozlesme_tarihi",
    title: "Contract Date",
    source: "document",
    required: true,
    resolve: ({ document }) => clean(document.issueDate),
  },
  {
    tag: "Template.qr_kod",
    title: "QR Code Value",
    source: "document",
    resolve: ({ document }) => clean(document.qrCodeValue),
  },
  {
    tag: "Template.fuar_adi",
    title: "Exhibition Name",
    source: "exhibition",
    required: true,
    resolve: ({ exhibition, priceSnapshot }) =>
      clean(exhibition?.name ?? priceSnapshot?.exhibitionName),
  },
  {
    tag: "Template.fuar_tarih",
    title: "Exhibition Date",
    source: "exhibition",
    resolve: exhibitionDate,
  },
  {
    tag: "Template.ulke",
    title: "Exhibition Country",
    source: "exhibition",
    resolve: ({ exhibition }) => clean(exhibition?.country),
  },
  {
    tag: "Template.sehir",
    title: "Exhibition City",
    source: "exhibition",
    resolve: ({ exhibition }) => clean(exhibition?.city),
  },
  {
    tag: "Template.fuar_alani",
    title: "Exhibition Venue",
    source: "exhibition",
    resolve: () => undefined,
  },
  {
    tag: "Template.hol",
    title: "Hall",
    source: "opportunity",
    resolve: ({ opportunity }) => clean(opportunity.hall),
  },
  {
    tag: "Template.stand_no",
    title: "Stand Number",
    source: "opportunity",
    resolve: ({ opportunity }) => clean(opportunity.stand_number),
  },
  {
    tag: "Template.stand_alani",
    title: "Stand Area",
    source: "opportunity",
    resolve: ({ priceSnapshot, opportunity }) =>
      opportunity.price_stand_area_sqm ??
      priceSnapshot?.priceInput.standAreaSqm,
  },
  {
    tag: "Template.stand_turu",
    title: "Stand Type",
    source: "price-snapshot",
    resolve: ({ priceSnapshot, opportunity }) => {
      const value =
        priceSnapshot?.priceInput.standType ??
        opportunity.price_stand_type;
      return value ? STAND_TYPE_LABELS[value] ?? value : undefined;
    },
  },
  {
    tag: "Template.stand_sekli",
    title: "Stand Shape",
    source: "opportunity",
    resolve: ({ opportunity }) => clean(opportunity.stand_shape),
  },
  {
    tag: "Company.LegalName",
    title: "Company Legal Name",
    source: "company",
    required: true,
    resolve: ({ company }) => clean(company.company_name),
  },
  {
    tag: "Company.Address",
    title: "Company Address",
    source: "company",
    resolve: ({ company }) => clean(company.address),
  },
  {
    tag: "Company.City",
    title: "Company City",
    source: "company",
    resolve: ({ company }) => clean(company.city),
  },
  {
    tag: "Company.Country",
    title: "Company Country",
    source: "company",
    resolve: ({ company }) => clean(company.country),
  },
  {
    tag: "Company.TaxOffice",
    title: "Company Tax Office",
    source: "company",
    resolve: ({ company }) => clean(company.tax_office),
  },
  {
    tag: "Company.TaxNumber",
    title: "Company Tax Number",
    source: "company",
    resolve: ({ company }) => clean(company.tax_number),
  },
  {
    tag: "Contact.Phone",
    title: "Primary Contact Phone",
    source: "contact.primary",
    resolve: (context) => clean(primaryContact(context)?.phone),
  },
  {
    tag: "Contact.Email",
    title: "Primary Contact Email",
    source: "contact.primary",
    resolve: (context) => clean(primaryContact(context)?.email),
  },
  {
    tag: "Company.Website",
    title: "Company Website",
    source: "company",
    resolve: ({ company }) => clean(company.website),
  },
  {
    tag: "Contact.ExhibitionContact",
    title: "Primary Contact",
    source: "contact.primary",
    resolve: (context) => fullName(primaryContact(context)),
  },
  {
    tag: "Contact.Signatory",
    title: "Authorized Signatory",
    source: "contact.signatory",
    resolve: (context) =>
      contactNameAndTitle(signatoryContact(context)),
  },
];

const priceFields: Array<{
  key: string;
  title: string;
  amount: (
    context: DocumentMergeContext,
  ) => number | null | undefined;
}> = [
  {
    key: "StandFee",
    title: "Stand Fee",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.sqmAmount ??
      opportunity.price_base_amount,
  },
  {
    key: "RegistrationFee",
    title: "Registration Fee",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.registrationFee ??
      opportunity.price_registration_fee,
  },
  {
    key: "AdditionalServices",
    title: "Additional Services",
    amount: ({ priceSnapshot }) =>
      priceSnapshot?.priceResult.additionalServicesFee,
  },
  {
    key: "Discount",
    title: "Discount",
    amount: ({ priceSnapshot }) =>
      priceSnapshot?.priceResult.discountAmount,
  },
  {
    key: "Tax",
    title: "Tax",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.vatAmount ??
      opportunity.price_vat_amount,
  },
  {
    key: "OrganizerTotal",
    title: "Organizer Total",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.organizerNetTotal ??
      priceSnapshot?.priceResult.subtotal ??
      opportunity.price_subtotal,
  },
  {
    key: "ServiceFee",
    title: "Service Fee",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.serviceFee ??
      opportunity.price_service_fee,
  },
  {
    key: "GrandTotal",
    title: "Grand Total",
    amount: ({ priceSnapshot, opportunity }) =>
      priceSnapshot?.priceResult.grandTotal ??
      opportunity.price_grand_total,
  },
];

for (const field of priceFields) {
  fields.push(
    {
      tag: `Pricing.${field.key}.Amount`,
      title: `${field.title} Amount`,
      source: "price-snapshot",
      resolve: price(field.amount),
    },
    {
      tag: `Pricing.${field.key}.Currency`,
      title: `${field.title} Currency`,
      source: "price-snapshot",
      resolve: currency,
    },
  );
}

for (let index = 0; index < 5; index += 1) {
  const paymentNumber = index + 1;
  fields.push(
    {
      tag: `PaymentPlan.Payment${paymentNumber}.DueDate`,
      title: `Payment ${paymentNumber} Due Date`,
      source: "opportunity",
      resolve: ({ opportunity }) =>
        clean(opportunity.payment_plan?.[index]?.dueDate),
    },
    {
      tag: `PaymentPlan.Payment${paymentNumber}.Amount`,
      title: `Payment ${paymentNumber} Amount`,
      source: "opportunity",
      resolve: ({ opportunity }) =>
        opportunity.payment_plan?.[index]?.amount,
    },
    {
      tag: `PaymentPlan.Payment${paymentNumber}.Payee`,
      title: `Payment ${paymentNumber} Payee`,
      source: "opportunity",
      resolve: ({ opportunity }) =>
        clean(opportunity.payment_plan?.[index]?.payee),
    },
  );
}

fields.push(
  {
    tag: "Bank.BankName",
    title: "Bank Name",
    source: "settings",
    resolve: ({ settings }) => clean(settings.bank.bankName),
  },
  {
    tag: "Bank.BranchAddress",
    title: "Bank Branch and Address",
    source: "settings",
    resolve: ({ settings }) => clean(settings.bank.branchAddress),
  },
  {
    tag: "Bank.IbanEur",
    title: "EUR IBAN",
    source: "settings",
    resolve: ({ settings }) => clean(settings.bank.ibanEur),
  },
  {
    tag: "Bank.IbanUsd",
    title: "USD IBAN",
    source: "settings",
    resolve: ({ settings }) => clean(settings.bank.ibanUsd),
  },
);

for (const key of MATERIAL_KEYS) {
  fields.push({
    tag: `StandMaterials.${key}.Selected`,
    title: `${key} Selected`,
    source: "opportunity",
    resolve: ({ opportunity }) =>
      opportunity.stand_materials?.[key]?.selected ?? false,
  });
}

for (const key of QUANTITY_MATERIAL_KEYS) {
  fields.push({
    tag: `StandMaterials.${key}.Quantity`,
    title: `${key} Quantity`,
    source: "opportunity",
    resolve: ({ opportunity }) =>
      opportunity.stand_materials?.[key]?.quantity,
  });
}

for (let index = 0; index < 3; index += 1) {
  fields.push({
    tag: `ExtraInformation.Line${index + 1}`,
    title: `Extra Information Line ${index + 1}`,
    source: "opportunity",
    resolve: ({ opportunity }) =>
      clean(opportunity.extra_information?.[index]),
  });
}

fields.push(
  {
    tag: "Signature.Participant.NameTitle",
    title: "Participant Signatory Name and Title",
    source: "contact.signatory",
    resolve: (context) =>
      contactNameAndTitle(signatoryContact(context)),
  },
  {
    tag: "Signature.Participant.Date",
    title: "Participant Signature Date",
    source: "document",
    resolve: ({ document }) => clean(document.participantSignatureDate),
  },
  {
    tag: "Signature.ExpoviaRepresentative.NameTitle",
    title: "EXPOVIA Representative Name and Title",
    source: "settings",
    resolve: ({ settings }) =>
      clean(settings.issuer.representativeNameTitle),
  },
  {
    tag: "Signature.ExpoviaRepresentative.Date",
    title: "EXPOVIA Signature Date",
    source: "document",
    resolve: ({ document }) => clean(document.issuerSignatureDate),
  },
);

export const participationContractMapping: TemplateMappingDefinition<DocumentMergeContext> =
  {
    documentType: PARTICIPATION_CONTRACT_DOCUMENT_TYPE,
    templateFileName:
      PARTICIPATION_CONTRACT_TEMPLATE_FILE_NAME,
    fields,
  };
