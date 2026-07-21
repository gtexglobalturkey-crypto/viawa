import { excelColumns } from "../excelMapping";

export type ImportedCompany = {
  companyCode: string;
  companyGroup: string;

  name: string;

  phone: string;
  email: string;
  website: string;

  phones: string[];
  emails: string[];
  websites: string[];

  country: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;

  taxOffice: string;
  taxNumber: string;

  lastContact: string;
  nextAction: string;
  relationship: string;
  status: string;

  generalNotes: string;
  salesNotes: string;

  sectors: string[];
  productGroups: string[];
  targetExhibitions: string[];
};

export type ImportedContact = {
  companyName: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isDecisionMaker: boolean;
};

export type ImportMappingResult = {
  companies: ImportedCompany[];
  contacts: ImportedContact[];
  exhibitionInterests: string[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function collectValues(row: Record<string, unknown>, columns: readonly string[]) {
  return columns
    .map((column) => text(row[column]))
    .filter((value) => value.length > 0);
}

function firstValue(values: string[]): string {
  return values.find((value) => value.length > 0) ?? "";
}

export function mapExcelRows(
  rows: Record<string, unknown>[]
): ImportMappingResult {
  const companies: ImportedCompany[] = [];
  const contacts: ImportedContact[] = [];
  const exhibitionInterests = new Set<string>();

  rows.forEach((row) => {
    const companyName = text(row[excelColumns.companyName]);

    if (!companyName) {
      return;
    }

    const phones = collectValues(row, excelColumns.companyPhones);
    const emails = collectValues(row, excelColumns.companyEmails);
    const websites = collectValues(row, excelColumns.websites);

    const sectors = collectValues(row, excelColumns.sectors);
    const productGroups = collectValues(row, excelColumns.productGroups);
    const targetExhibitions = collectValues(row, excelColumns.exhibitions);

    targetExhibitions.forEach((exhibition) => {
      exhibitionInterests.add(exhibition);
    });

    companies.push({
      companyCode: text(row[excelColumns.companyCode]),
      companyGroup: text(row[excelColumns.companyGroup]),

      name: companyName,

      phone: firstValue(phones),
      email: firstValue(emails),
      website: firstValue(websites),

      phones,
      emails,
      websites,

      country: text(row[excelColumns.country]),
      city: text(row[excelColumns.city]),
      district: text(row[excelColumns.district]),
      address: text(row[excelColumns.address]),
      postalCode: text(row[excelColumns.postalCode]),

      taxOffice: text(row[excelColumns.taxOffice]),
      taxNumber: text(row[excelColumns.taxNumber]),

      lastContact: text(row[excelColumns.lastContact]),
      nextAction: text(row[excelColumns.nextAction]),
      relationship: text(row[excelColumns.relationship]),
      status: text(row[excelColumns.status]),

      generalNotes: text(row[excelColumns.generalNotes]),
      salesNotes: text(row[excelColumns.salesNotes]),

      sectors,
      productGroups,
      targetExhibitions,
    });

    excelColumns.decisionMakers.forEach((contactColumn) => {
      const name = text(row[contactColumn.name]);

      if (!name) {
        return;
      }

      contacts.push({
        companyName,
        name,
        role: text(row[contactColumn.role]),
        phone: text(row[contactColumn.phone]),
        email: text(row[contactColumn.email]),
        isDecisionMaker: true,
      });
    });

    excelColumns.contactPeople.forEach((contactColumn) => {
      const name = text(row[contactColumn.name]);

      if (!name) {
        return;
      }

      contacts.push({
        companyName,
        name,
        role: text(row[contactColumn.role]),
        phone: text(row[contactColumn.phone]),
        email: text(row[contactColumn.email]),
        isDecisionMaker: false,
      });
    });
  });

  return {
    companies,
    contacts,
    exhibitionInterests: Array.from(exhibitionInterests),
  };
}