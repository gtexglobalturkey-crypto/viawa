import { supabase } from "./client";
import type { Company } from "../../types/database";

export type { Company } from "../../types/database";
import type { Opportunity } from "../../types/database";

export const COMPANY_PAGE_SIZE = 50;
export type CommunicationFilter = "all" | "email" | "phone" | "either" | "both" | "none";

export type CompanyDirectoryFilters = {
  page: number;
  search?: string;
  country?: string;
  city?: string;
  sectorId?: string;
  productGroupId?: string;
  communication?: CommunicationFilter;
  exhibitionId?: string;
  status?: CompanyDirectoryRow["companyStatus"];
};

export type CompanyDirectoryRow = {
  company: Company;
  activeOpportunityCount: number;
  nextOpportunity: Opportunity | null;
  companyStatus: "Yeni Firma" | "Potansiyel Firma" | "Sözleşmeli Firma" | "Pasif Firma";
};

export async function getCompanyDirectoryPage(filters: CompanyDirectoryFilters): Promise<{ rows: CompanyDirectoryRow[]; total: number }> {
  const { data, error } = await supabase.rpc("list_company_directory_page", {
    p_page: filters.page,
    p_page_size: COMPANY_PAGE_SIZE,
    p_search: filters.search?.trim() || null,
    p_country: filters.country || null,
    p_city: filters.city || null,
    p_sector_id: filters.sectorId || null,
    p_product_group_id: filters.productGroupId || null,
    p_communication: filters.communication ?? "all",
    p_exhibition_id: filters.exhibitionId || null,
    p_status: filters.status || null,
  });
  if (error) throw error;
  const records = (data ?? []) as Array<{ company: Company; active_opportunity_count: number; next_opportunity: Opportunity | null; company_status: CompanyDirectoryRow["companyStatus"]; total_count: number }>;
  return {
    rows: records.map((record) => ({ company: record.company, activeOpportunityCount: Number(record.active_opportunity_count), nextOpportunity: record.next_opportunity, companyStatus: record.company_status })),
    total: records.length ? Number(records[0].total_count) : 0,
  };
}

export async function getCompanyDirectoryOptions(country?: string): Promise<{ countries: string[]; cities: string[] }> {
  const { data, error } = await supabase.rpc("list_company_directory_options", { p_country: country || null });
  if (error) throw error;
  const value = (data ?? {}) as { countries?: string[]; cities?: string[] };
  return { countries: value.countries ?? [], cities: value.cities ?? [] };
}

export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("companies").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("company_name");

  if (error) throw error;

  return data ?? [];
}

export async function getCompany(
  id: string,
): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export type CompanyDuplicateCheckRow = {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  website: string | null;
  address: string | null;
};

/**
 * Fields needed to check a new/edited company against every other company
 * for duplicate company_name/phone/email/tax_number/website/address.
 * Excludes `excludeCompanyId` so editing a company can keep its own values.
 */
export async function getCompaniesForDuplicateCheck(
  excludeCompanyId?: string,
): Promise<CompanyDuplicateCheckRow[]> {
  let query = supabase
    .from("companies")
    .select(
      "id, company_name, phone, email, tax_number, website, address",
    );

  if (excludeCompanyId) {
    query = query.neq(
      "id",
      excludeCompanyId,
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  return data ?? [];
}

export async function createCompany(
  company: Omit<
    Company,
    | "id"
    | "company_code"
    | "created_at"
    | "updated_at"
  >,
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert(company)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateCompany(
  id: string,
  updates: Partial<
    Omit<
      Company,
      | "id"
      | "company_code"
      | "created_at"
      | "updated_at"
    >
  >,
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteCompany(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
