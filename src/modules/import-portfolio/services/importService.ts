import { splitPersonName } from "../../../core/formatters/textFormatter";
import { getCompanyConstraintErrorMessage } from "../../../core/validation/companyDuplicateCheck";
import { getContactConstraintErrorMessage } from "../../../core/validation/contactDuplicateCheck";
import { createCompany } from "../../../services/supabase/companyService";
import { createContact } from "../../../services/supabase/contactService";
import {
  findOrCreateProductGroup,
  replaceCompanyProductGroups,
  type ProductGroup,
} from "../../../services/supabase/productGroupService";
import {
  findOrCreateSector,
  replaceCompanySectors,
  type Sector,
} from "../../../services/supabase/sectorService";

import type { ImportedCompany } from "./excelMapper";

export type ImportRowStatus =
  | "created"
  | "skipped_duplicate"
  | "failed"
  | "partial";

export type ImportRowResult = {
  rowNumber: number;
  companyName: string;
  companyCode: string | null;
  status: ImportRowStatus;
  message: string;
  contactsCreated: number;
  contactsFailed: number;
};

export type ImportSummary = {
  results: ImportRowResult[];
  createdCompanies: number;
  createdContacts: number;
  skippedDuplicates: number;
  partial: number;
  failed: number;
};

/**
 * Mirrors the company row's own "contact_person" convention (see
 * NewCompanyPage.tsx's saveContacts/PersonInput flow): the person the
 * company record denormalizes as its headline contact is whichever
 * imported person is marked primary, falling back to the first person
 * listed (Kişi 1) when no one is marked primary.
 */
function pickContactPerson(
  company: ImportedCompany,
): string | null {
  const primary = company.contacts.find(
    (contact) => contact.isPrimary,
  );

  return (
    primary?.name ??
    company.contacts[0]?.name ??
    null
  );
}

/**
 * Resolves each raw text value to a master-list record (creating it if
 * no match exists), skipping — not aborting the row for — any single
 * value that fails to resolve. Resolved records are de-duplicated by
 * id (two differently-cased raw strings, e.g. "Gıda"/"GIDA", can both
 * resolve to the same sector) and capped at 4, preserving the order
 * they first appeared in the row.
 */
async function resolveMasterListValues<
  T extends { id: string; name: string },
>(
  rawValues: string[],
  findOrCreate: (
    name: string,
  ) => Promise<T>,
  label: string,
): Promise<{
  resolved: T[];
  failureMessages: string[];
}> {
  const resolved: T[] = [];
  const seenIds = new Set<string>();
  const failureMessages: string[] = [];

  for (const rawValue of rawValues) {
    if (resolved.length >= 4) {
      break;
    }

    try {
      const record = await findOrCreate(
        rawValue,
      );

      if (!seenIds.has(record.id)) {
        seenIds.add(record.id);
        resolved.push(record);
      }
    } catch (error) {
      console.error(
        `Import ${label} resolution error:`,
        error,
      );

      failureMessages.push(
        `${label} "${rawValue}" oluşturulamadı/eşleştirilemedi`,
      );
    }
  }

  return { resolved, failureMessages };
}

async function importOneCompany(
  company: ImportedCompany,
): Promise<ImportRowResult> {
  // Master-list records don't depend on the company existing yet, so
  // they're resolved up front — this also means the primary sector's
  // canonical (possibly already-existing) name is known before the
  // company row itself is written, for `industry`.
  const {
    resolved: resolvedSectors,
    failureMessages: sectorFailureMessages,
  } = await resolveMasterListValues<Sector>(
    company.sectors,
    findOrCreateSector,
    "Sektör",
  );

  const {
    resolved: resolvedProductGroups,
    failureMessages:
      productGroupFailureMessages,
  } = await resolveMasterListValues<ProductGroup>(
    company.productGroups,
    findOrCreateProductGroup,
    "Ürün grubu",
  );

  let createdCompany;

  try {
    createdCompany = await createCompany({
      company_name: company.name,
      contact_person:
        pickContactPerson(company),
      email: company.email || null,
      phone: company.phone || null,
      website: company.website || null,
      country: company.country || null,
      // Position-1 sector is the canonical primary sector — kept in
      // sync here for backward compatibility (see
      // supabase/migrations/20260728_add_sectors_and_product_groups.sql).
      // replaceCompanySectors below re-derives the same value at the
      // database level once it runs, so this is never the only place
      // industry gets set, just the earliest.
      industry:
        resolvedSectors[0]?.name ?? null,
      tax_office: company.taxOffice || null,
      tax_number: company.taxNumber || null,
      postal_code: company.postalCode || null,
      address: company.address || null,
      city: company.city || null,
      district: company.district || null,
      status: "lead",
    });
  } catch (error) {
    console.error(
      "Import company creation error:",
      error,
    );

    const duplicateMessage = getCompanyConstraintErrorMessage(error);
    return {
      rowNumber: company.rowNumber,
      companyName: company.name,
      companyCode: null,
      status: duplicateMessage ? "skipped_duplicate" : "failed",
      message: duplicateMessage ?? "Firma oluşturulamadı.",
      contactsCreated: 0,
      contactsFailed: 0,
    };
  }

  let contactsCreated = 0;
  const failureMessages: string[] = [
    ...sectorFailureMessages,
    ...productGroupFailureMessages,
  ];

  for (const contact of company.contacts) {
    const { firstName, lastName } =
      splitPersonName(contact.name);

    try {
      await createContact({
        company_id: createdCompany.id,
        first_name: firstName,
        last_name: lastName,
        title: contact.role || null,
        phone: contact.phone || null,
        email: contact.email || null,
        is_primary: contact.isPrimary,
        is_signatory: contact.isSignatory,
      });

      contactsCreated += 1;
    } catch (error) {
      console.error(
        "Import contact creation error:",
        error,
      );

      const constraintMessage =
        getContactConstraintErrorMessage(
          error,
        );

      failureMessages.push(
        `${contact.name}: ${
          constraintMessage ??
          "kişi kaydedilemedi"
        }`,
      );
    }
  }

  const contactsFailed =
    company.contacts.length -
    contactsCreated;

  // Always replace the relation set — even with an empty/partial list
  // — so the company's sectors/product groups are never left
  // half-written or stale relative to what was actually resolved
  // above (see replace_company_sectors /
  // replace_company_product_groups, the atomic RPCs backing these).
  try {
    await replaceCompanySectors(
      createdCompany.id,
      resolvedSectors.map(
        (sector) => sector.id,
      ),
    );

    await replaceCompanyProductGroups(
      createdCompany.id,
      resolvedProductGroups.map(
        (productGroup) =>
          productGroup.id,
      ),
    );
  } catch (error) {
    console.error(
      "Import sector/product group relation error:",
      error,
    );

    failureMessages.push(
      "sektör/ürün grubu ilişkileri kaydedilemedi",
    );
  }

  const companyCode =
    createdCompany.company_code ?? null;

  if (failureMessages.length > 0) {
    return {
      rowNumber: company.rowNumber,
      companyName: company.name,
      companyCode,
      status: "partial",
      message: `Firma oluşturuldu ancak bazı ilişkili kayıtlar tamamlanamadı: ${failureMessages.join(
        "; ",
      )}`,
      contactsCreated,
      contactsFailed,
    };
  }

  return {
    rowNumber: company.rowNumber,
    companyName: company.name,
    companyCode,
    status: "created",
    message:
      contactsCreated > 0
        ? `Firma ve ${contactsCreated} kişi oluşturuldu.`
        : "Firma oluşturuldu.",
    contactsCreated,
    contactsFailed: 0,
  };
}

/**
 * Commits every previewed row to Supabase, one company at a time
 * (deliberately sequential, not Promise.all). Normalized UNIQUE indexes
 * provide retry/in-file duplicate safety without an O(n²) full-company
 * scan before every insert. Never
 * throws for a single row's failure; every row gets its own result so
 * one bad row cannot abort the batch.
 */
export async function importCompanies(
  companies: ImportedCompany[],
  onProgress?: (
    done: number,
    total: number,
  ) => void,
): Promise<ImportSummary> {
  const results: ImportRowResult[] = [];
  // Keep the browser responsive and make progress/retry boundaries explicit.
  // Rows remain isolated (one failed row cannot abort the batch); no
  // opportunity API is imported or called anywhere in this service.
  const chunkSize = 250;

  for (
    let index = 0;
    index < companies.length;
    index += 1
  ) {
    const result = await importOneCompany(
      companies[index],
    );

    results.push(result);
    onProgress?.(
      index + 1,
      companies.length,
    );
    if ((index + 1) % chunkSize === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    results,
    createdCompanies: results.filter(
      (row) => row.status === "created",
    ).length,
    createdContacts: results.reduce(
      (sum, row) =>
        sum + row.contactsCreated,
      0,
    ),
    skippedDuplicates: results.filter(
      (row) =>
        row.status ===
        "skipped_duplicate",
    ).length,
    partial: results.filter(
      (row) => row.status === "partial",
    ).length,
    failed: results.filter(
      (row) => row.status === "failed",
    ).length,
  };
}
