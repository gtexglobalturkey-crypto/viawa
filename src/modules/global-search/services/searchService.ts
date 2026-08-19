import type { SearchResult } from "../models/searchResult";

import { getCompanies } from "../../../services/supabase/companyService";
import { getExhibitions } from "../../../services/supabase/exhibitionService";

export async function searchViawa(
  query: string,
): Promise<SearchResult[]> {
  const text = query.trim().toLowerCase();

  if (!text) {
    return [];
  }

  const [companies, exhibitions] =
    await Promise.all([
      getCompanies(),
      getExhibitions(),
    ]);

  const results: SearchResult[] = [];

  companies
    .filter(
      (company) =>
        company.company_name
          .toLowerCase()
          .includes(text) ||
        (company.contact_person ?? "")
          .toLowerCase()
          .includes(text),
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

  exhibitions
    .filter((exhibition) =>
      exhibition.name
        .toLowerCase()
        .includes(text),
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
