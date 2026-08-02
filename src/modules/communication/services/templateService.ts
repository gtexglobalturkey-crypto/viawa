export const TEMPLATE_DISPLAY_NAMES: Record<
  string,
  string
> = {
  "Information Package": "Bilgi Paketi",
  "Exhibition Presentation": "Fuar Sunumu",
  Quotation: "Teklif",
  "Revised Quotation": "Revize Teklif",
  Contract: "Sözleşme",
  "Visa Invitation": "Vize Daveti",
  "Visitor Invitation": "Ziyaretçi Daveti",
  "Thank You": "Teşekkür",
};

// SPRINT 25.1 — moved here (verbatim) from useCommunicationWorkspace.ts so
// both Communication Page and the Workspace Email Panel's send flow can
// call the same executeAction workflow chain (timeline event, opportunity
// stage, next_action/reminder, AI memory) for the same template with the
// same actionId. Mappings are unchanged from the original.
const TEMPLATE_ACTION_IDS: Record<
  string,
  string
> = {
  "Information Package":
    "information-package",
  Quotation: "quotation",
  Contract: "contract",
  "Additional Documents":
    "additional-documents",
  "Revised Quotation":
    "revised-quotation",
  "Thank You": "thank-you",
  "Exhibition Presentation":
    "information-package",
  "Visa Invitation":
    "additional-documents",
  "Visitor Invitation":
    "additional-documents",
};

export function mapTemplateToActionId(
  template: string,
): string {
  return (
    TEMPLATE_ACTION_IDS[template] ??
    "additional-documents"
  );
}

export function getTemplateSubject(template: string, exhibition: string) {
  switch (template) {
    case "Information Package":
      return `${exhibition} Bilgi Paketi`;

    case "Quotation":
      return `${exhibition} Katılım Teklifi`;

    case "Revised Quotation":
      return `${exhibition} Revize Teklif`;

    case "Contract":
      return `${exhibition} Katılım Sözleşmesi`;

    case "Visa Invitation":
      return `${exhibition} Vize Daveti`;

    case "Visitor Invitation":
      return `${exhibition} Ziyaretçi Daveti`;

    case "Thank You":
      return "Teşekkür Ederiz";

    default:
      return template;
  }
}

// Same ids/labels as document-engine/engine/buildContractDocumentData.ts's
// STAND_TYPE_LABELS (the currently-active contract-generation path) —
// duplicated locally rather than imported since that constant isn't
// exported and this is the only other place that needs it.
const STAND_TYPE_LABELS: Record<
  string,
  string
> = {
  "space-only": "Boş Alan",
  "shell-scheme": "Standart Stand",
  "premium-shell": "Premium Stand",
  custom: "Özel Stand",
  "custom-stand": "Özel Stand",
  outdoor: "Dış Alan",
};

function formatQuotationArea(
  areaSqm: number,
): string {
  return Number.isInteger(areaSqm)
    ? String(areaSqm)
    : areaSqm.toFixed(2);
}

function formatQuotationAmount(
  amount: number,
): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type QuotationEmailData = {
  contactName: string;
  exhibitionName: string;
  standAreaSqm: number;
  standType: string;
  currency: string;
  grandTotal: number;
  senderCompanyName: string;
};

/**
 * Fixed, branded body for the Communication → Teklif (Quotation)
 * template (Sprint 22.9.3) — reads the approved price already persisted
 * onto the Opportunity (see
 * supabase/migrations/20260730040000_add_opportunity_price_fields.sql),
 * never a separate/new proposal document. The composer's body field is a
 * plain <textarea> (no HTML rendering — see EmailComposer.tsx), so this
 * is a clean plain-text layout rather than an HTML table.
 */
export function getQuotationEmailBody(
  data: QuotationEmailData,
): string {
  const standTypeLabel =
    STAND_TYPE_LABELS[data.standType] ??
    data.standType;

  return `Sayın ${data.contactName},

${data.exhibitionName} fuarı için fiyat teklifimiz aşağıda bilgilerinize sunulmuştur.

Fuar: ${data.exhibitionName}
Stand Alanı: ${formatQuotationArea(
    data.standAreaSqm,
  )} m²
Stand Tipi: ${standTypeLabel}
Teklif Tutarı: ${data.currency} ${formatQuotationAmount(
    data.grandTotal,
  )}

Saygılarımızla,

${data.senderCompanyName}`;
}

export function getTemplateBody(template: string, company: string) {
  if (template === "Information Package") {
    return `Sayın ${company},

Fuar katılımınıza ilişkin seçilen bilgi ve belgeleri ekte bilgilerinize sunarız.

Saygılarımızla

EXPOVIA`;
  }

  const templateLabel =
    TEMPLATE_DISPLAY_NAMES[template] ?? template;

  return `Sayın ${company},

Bu, EXPOVIA tarafından hazırlanan ${templateLabel} belgesidir.

Saygılarımızla

EXPOVIA`;
}
