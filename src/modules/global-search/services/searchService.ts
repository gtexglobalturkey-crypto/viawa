import type { SearchResult } from "../models/searchResult";

import { getCompanies } from "../../../services/supabase/companyService";
import { getContacts } from "../../../services/supabase/contactService";
import { getExhibitions } from "../../../services/supabase/exhibitionService";
import { matchesSearchText } from "./searchMatchers";

export async function searchViawa(
  query: string,
): Promise<SearchResult[]> {
  const text = query.trim().toLocaleLowerCase("tr");

  if (!text) {
    return [];
  }

  const [companies, contacts, exhibitions] =
    await Promise.all([
      getCompanies(),
      getContacts(),
      getExhibitions(),
    ]);

  const results: SearchResult[] = [];

  companies
    .filter(
      (company) =>
        [
          company.company_name,
          company.contact_person,
          company.email,
          company.phone,
          company.country,
          company.industry,
        ].some((value) => matchesSearchText(value, text)),
    )
    .forEach((company) => {
      results.push({
        id: company.id,
        type: "company",
        title: company.company_name,
        subtitle:
          company.contact_person ?? "",
        path: `/companies/${company.id}`,
      });
    });

  const companiesById = new Map(
    companies.map((company) => [company.id, company]),
  );

  contacts
    .filter((contact) =>
      [
        contact.first_name,
        contact.last_name,
        [contact.first_name, contact.last_name].filter(Boolean).join(" "),
        contact.email,
        contact.phone,
      ].some((value) => matchesSearchText(value, text)),
    )
    .forEach((contact) => {
      const company = companiesById.get(contact.company_id);
      const name = [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(" ") || "İsimsiz kişi";

      results.push({
        id: contact.id,
        type: "contact",
        title: name,
        subtitle: company?.company_name ?? contact.email ?? "Kişi",
        path: `/companies/${contact.company_id}`,
      });
    });

  exhibitions
    .filter((exhibition) =>
      matchesSearchText(exhibition.name, text),
    )
    .forEach((exhibition) => {
      results.push({
        id: exhibition.id,
        type: "exhibition",
        title: exhibition.name,
        subtitle:
          exhibition.country ?? "",
        path: "/reference-data",
      });
    });

  return results.slice(0, 10);
}
