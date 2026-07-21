import { supabase } from "./client";
import type { Opportunity } from "../../types/database";

export type { Opportunity } from "../../types/database";

export async function getOpportunities(): Promise<
  Opportunity[]
> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getOpportunitiesByCompany(
  companyId: string,
): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getOpportunity(
  id: string,
): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createOpportunity(
  opportunity: Omit<
    Opportunity,
    "id" | "created_at" | "updated_at"
  >,
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from("opportunities")
    .insert(opportunity)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateOpportunity(
  id: string,
  updates: Partial<
    Omit<Opportunity, "id" | "created_at" | "updated_at">
  >,
): Promise<Opportunity> {
  const { data, error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteOpportunity(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", id);

  if (error) throw error;
}