import { supabase } from "./client";
import type { Company } from "../../types/database";

export type { Company } from "../../types/database";

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