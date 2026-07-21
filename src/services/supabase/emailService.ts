import { supabase } from "./client";
import type { EmailRecord } from "../../types/database";

export type { EmailRecord } from "../../types/database";

export async function getEmails(): Promise<EmailRecord[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getEmailsByCompany(
  companyId: string,
): Promise<EmailRecord[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getEmail(
  id: string,
): Promise<EmailRecord | null> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createEmail(
  email: Omit<
    EmailRecord,
    "id" | "created_at" | "updated_at"
  >,
): Promise<EmailRecord> {
  const { data, error } = await supabase
    .from("emails")
    .insert(email)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateEmail(
  id: string,
  updates: Partial<
    Omit<EmailRecord, "id" | "created_at" | "updated_at">
  >,
): Promise<EmailRecord> {
  const { data, error } = await supabase
    .from("emails")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteEmail(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("emails")
    .delete()
    .eq("id", id);

  if (error) throw error;
}