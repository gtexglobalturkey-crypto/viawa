import { excelColumns } from "../excelMapping";

import {
  formatCity,
  formatCompanyName,
  formatCountry,
  formatEmail,
  formatPersonName,
  formatTaxOffice,
  formatWebsite,
} from "../../../core/formatters/textFormatter";

export type ImportedContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  isSignatory: boolean;
};

export type ImportedCompany = {
  /** 1-based position among the valid (named) rows in the sheet. */
  rowNumber: number;

  name: string;

  phone: string;
  email: string;
  website: string;

  country: string;
  city: string;
  district: string;
  address: string;
  postalCode: string;

  taxOffice: string;
  taxNumber: string;

  sectors: string[];
  productGroups: string[];

  contacts: ImportedContact[];
};

export type ImportMappingResult = {
  companies: ImportedCompany[];
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isYes(value: unknown): boolean {
  return text(value).toLocaleLowerCase("tr") === "evet";
}

/** Trims, drops empty values, and removes duplicates — used for the
 * sector / product-group columns, which are free text and prone to
 * accidental repeats or trailing blanks in a hand-filled template. */
function collectUniqueValues(
  row: Record<string, unknown>,
  columns: readonly string[],
) {
  const values = columns
    .map((column) => text(row[column]))
    .filter((value) => value.length > 0);

  return Array.from(new Set(values));
}

export function mapExcelRows(
  rows: Record<string, unknown>[],
): ImportMappingResult {
  const companies: ImportedCompany[] = [];

  rows.forEach((row) => {
    const companyName = formatCompanyName(
      text(row[excelColumns.companyName]),
    );

    if (!companyName) {
      return;
    }

    const sectors = collectUniqueValues(
      row,
      excelColumns.sectors,
    );

    const productGroups = collectUniqueValues(
      row,
      excelColumns.productGroups,
    );

    const contacts: ImportedContact[] = [];

    excelColumns.people.forEach((person) => {
      const name = formatPersonName(
        text(row[person.name]),
      );

      if (!name) {
        return;
      }

      contacts.push({
        name,
        role: text(row[person.role]),
        phone: text(row[person.phone]),
        email: formatEmail(
          text(row[person.email]),
        ),
        isPrimary:
          isYes(
            row[person.isExhibitionContact],
          ) ||
          isYes(
            row[person.isPrimaryContact],
          ),
        isSignatory: isYes(
          row[person.isSignatory],
        ),
      });
    });

    companies.push({
      rowNumber: companies.length + 1,

      name: companyName,

      phone: text(row[excelColumns.phone]),
      email: formatEmail(
        text(row[excelColumns.email]),
      ),
      website: formatWebsite(
        text(row[excelColumns.website]),
      ),

      country: formatCountry(
        text(row[excelColumns.country]),
      ),
      city: formatCity(
        text(row[excelColumns.city]),
      ),
      district: text(
        row[excelColumns.district],
      ),
      address: text(
        row[excelColumns.address],
      ),
      postalCode: text(
        row[excelColumns.postalCode],
      ),

      taxOffice: formatTaxOffice(
        text(row[excelColumns.taxOffice]),
      ),
      taxNumber: text(
        row[excelColumns.taxNumber],
      ),

      sectors,
      productGroups,

      contacts,
    });
  });

  return {
    companies,
  };
}
