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

export function getTemplateBody(template: string, company: string) {
  const templateLabel =
    TEMPLATE_DISPLAY_NAMES[template] ?? template;

  return `Sayın ${company},

Bu, Atlas tarafından hazırlanan ${templateLabel} belgesidir.

Saygılarımızla

EREXPO`;
}
