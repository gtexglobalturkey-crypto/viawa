import type { Company, Contact } from "../../../../types/database";

import type { Exhibition as SidebarExhibition } from "../../../exhibitions/models/Exhibition";
import type { PriceResult } from "../../pricing/models/PriceResult";
import type {
  ContractDraftContact,
  ContractDraftData,
} from "../models/ContractDraftData";

function cleanOrNull(
  value: string | null | undefined,
): string | null {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function toContractDraftContact(
  contact: Contact | undefined,
): ContractDraftContact | null {
  if (!contact) {
    return null;
  }

  const fullName = [
    contact.first_name,
    contact.last_name,
  ]
    .filter((namePart): namePart is string =>
      Boolean(namePart?.trim()),
    )
    .join(" ")
    .trim();

  if (!fullName) {
    return null;
  }

  return {
    contactId: contact.id,
    fullName,
    title: cleanOrNull(contact.title),
    phone: cleanOrNull(contact.phone),
    email: cleanOrNull(contact.email),
  };
}

type BuildContractDraftInput = {
  company: Company;
  contacts: Contact[];
  // The sidebar-selected fuar is the single source of truth for
  // exhibition identity/context — never derived from the opportunity's
  // own (unrelated) DB exhibition link, and never from any other fuar.
  sidebarExhibition: SidebarExhibition;
  opportunityId: string;
  priceResult: PriceResult;
};

/**
 * Builds a ContractDraftData snapshot from the current company, contact
 * records, the sidebar-selected exhibition, and an already-approved
 * PriceResult. Every field not backed by a real data source (contract
 * number, hall, stand number) is left null — never guessed, never
 * pulled from a different exhibition.
 */
export function buildContractDraft({
  company,
  contacts,
  sidebarExhibition,
  opportunityId,
  priceResult,
}: BuildContractDraftInput): ContractDraftData {
  const exhibitionContact = toContractDraftContact(
    contacts.find(
      (contact) => contact.is_primary === true,
    ),
  );

  const signatoryContact = toContractDraftContact(
    contacts.find(
      (contact) => contact.is_signatory === true,
    ),
  );

  return {
    company: {
      companyId: company.id,
      companyName: company.company_name,
      address: cleanOrNull(company.address),
      taxOffice: cleanOrNull(company.tax_office),
      taxNumber: cleanOrNull(company.tax_number),
      phone: cleanOrNull(company.phone),
      email: cleanOrNull(company.email),
      website: cleanOrNull(company.website),
    },

    contacts: {
      exhibitionContact,
      signatoryContact,
    },

    exhibition: {
      exhibitionId: sidebarExhibition.id,
      exhibitionName: sidebarExhibition.name,
      exhibitionShortName:
        cleanOrNull(
          sidebarExhibition.shortName,
        ),
      startDate:
        cleanOrNull(
          sidebarExhibition.startDate,
        ),
      endDate:
        cleanOrNull(
          sidebarExhibition.endDate,
        ),
      city: cleanOrNull(sidebarExhibition.city),
      country:
        cleanOrNull(
          sidebarExhibition.country,
        ),
      // No hall/stand-number data source exists anywhere in the current
      // schema for a real opportunity's exhibition.
      hall: null,
      standNumber: null,
      standType: priceResult.appliedInput.standType,
    },

    price: {
      priceInput: priceResult.appliedInput,
      priceResult,
    },

    opportunityId,
    // No contract-numbering system exists yet.
    contractNumber: null,
    issueDate: new Date().toISOString(),
    currency: priceResult.currency,
    status: "draft",
  };
}
