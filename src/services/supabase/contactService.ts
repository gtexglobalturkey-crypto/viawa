import { supabase } from "./client";
import type { Contact } from "../../types/database";

export type { Contact } from "../../types/database";

export async function getContactsByCompany(
  companyId: string,
): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", {
      ascending: true,
    });

  if (error) throw error;

  return data ?? [];
}

export type ContactDuplicateCheckRow = {
  id: string;
  company_id: string;
  email: string | null;
  phone: string | null;
};

/**
 * Every contact's email/phone, system-wide (across all companies) — used
 * to check a new/edited contact's email and phone against every other
 * contact in the system, per the rule that an email/phone belongs to
 * exactly one person. Read-only; exclusion of a contact's own row when
 * editing is handled by the caller (src/core/validation/
 * contactDuplicateCheck.ts), since a single call here backs the
 * duplicate check for all 4 person slots in one form submission.
 */
export async function getContactsForDuplicateCheck(): Promise<
  ContactDuplicateCheckRow[]
> {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, company_id, email, phone",
    );

  if (error) throw error;

  return data ?? [];
}

export async function createContact(
  contact: Omit<
    Contact,
    "id" | "created_at" | "updated_at"
  >,
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .insert(contact)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateContact(
  id: string,
  updates: Partial<
    Omit<
      Contact,
      "id" | "created_at" | "updated_at"
    >
  >,
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteContact(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
