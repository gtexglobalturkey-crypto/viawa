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

export async function createCompany(
  company: Omit<
    Company,
    "id" | "created_at" | "updated_at"
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
    Omit<Company, "id" | "created_at" | "updated_at">
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