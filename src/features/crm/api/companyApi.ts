import { supabase } from "./supabase";

import type { Company } from "../store/crmTypes";

const TABLE = "companies";

export async function getCompanies() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("name");

  if (error) {
    throw error;
  }

  return data as Company[];
}

export async function getCompany(
  id: string,
) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as Company;
}

export async function createCompany(
  company: Company,
) {
  const { error } = await supabase
    .from(TABLE)
    .insert(company);

  if (error) {
    throw error;
  }
}

export async function updateCompany(
  id: string,
  updates: Partial<Company>,
) {
  const { error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteCompany(
  id: string,
) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}