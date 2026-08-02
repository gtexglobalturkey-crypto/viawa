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

export async function createEmailForSendOperation(
  email: Omit<EmailRecord, "id" | "created_at" | "updated_at"> & {
    send_operation_key: string;
  },
): Promise<{ email: EmailRecord; created: boolean }> {
  const { data, error } = await supabase
    .from("emails")
    .insert(email)
    .select()
    .single();

  if (!error) {
    return { email: data, created: true };
  }

  if (error.code !== "23505") {
    throw error;
  }

  const { data: existingEmail, error: lookupError } = await supabase
    .from("emails")
    .select("*")
    .eq("send_operation_key", email.send_operation_key)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (!existingEmail) throw error;

  return { email: existingEmail, created: false };
}
