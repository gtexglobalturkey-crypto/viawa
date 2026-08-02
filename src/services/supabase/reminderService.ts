import { supabase } from "./client";
import type { Reminder } from "../../types/database";

export type { Reminder } from "../../types/database";

type CreateActiveReminderInput = {
  companyId: string;
  opportunityId: string;
  taskType: string;
  title: string;
  dueDate: string | null;
};

export type CreateActiveReminderResult = {
  reminder: Reminder;
  created: boolean;
};

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

export async function createActiveReminderIfAbsent(
  input: CreateActiveReminderInput,
): Promise<CreateActiveReminderResult> {
  const reminder = {
    company_id: input.companyId,
    opportunity_id: input.opportunityId,
    task_type: input.taskType,
    title: input.title,
    due_date: input.dueDate,
    completed: false,
  };

  const { data, error } = await supabase
    .from("reminders")
    .insert(reminder)
    .select()
    .single();

  if (!error) {
    return {
      reminder: data,
      created: true,
    };
  }

  if (error.code !== "23505") {
    throw error;
  }

  const {
    data: existingReminder,
    error: existingReminderError,
  } = await supabase
    .from("reminders")
    .select("*")
    .eq("opportunity_id", input.opportunityId)
    .eq("task_type", input.taskType)
    .eq("completed", false)
    .single();

  if (existingReminderError) {
    throw existingReminderError;
  }

  return {
    reminder: existingReminder,
    created: false,
  };
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
