import { supabase } from "./client";
import type { Reminder } from "../../types/database";

export type { Reminder } from "../../types/database";

export async function getReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) throw error;

  return data ?? [];
}

export async function getRemindersByCompany(
  companyId: string,
): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("company_id", companyId)
    .order("due_date", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) throw error;

  return data ?? [];
}

export async function createReminder(
  reminder: Omit<
    Reminder,
    "id" | "created_at" | "updated_at"
  >,
): Promise<Reminder> {
  const { data, error } = await supabase
    .from("reminders")
    .insert(reminder)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateReminder(
  id: string,
  updates: Partial<
    Omit<Reminder, "id" | "created_at" | "updated_at">
  >,
): Promise<Reminder> {
  const { data, error } = await supabase
    .from("reminders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteReminder(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", id);

  if (error) throw error;
}