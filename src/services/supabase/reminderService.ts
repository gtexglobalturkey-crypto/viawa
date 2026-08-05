import { supabase } from "./client";
import type { Reminder } from "../../types/database";
import { selectOpenRemindersForOpportunity } from "./reminderClosureRule";

export type { Reminder } from "../../types/database";
export { selectOpenRemindersForOpportunity } from "./reminderClosureRule";

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

// Kritik Akış Düzeltmesi 5 — the one shared close-out for any opportunity
// that just became terminal (lost, won, or signed), regardless of which
// screen triggered it (Firma Sayfası "İptal", Workspace "Kaybedildi" /
// "Kazanıldı" / İmzalar Tamamlandı). Takes the caller's own already-
// loaded `reminders` (every caller already has this from its own
// data-fetch — see useWorkspaceData/useCompanyWorkspace) instead of
// fetching again, so this stays a small, reusable, storage-agnostic
// helper rather than a second parallel data source. Only ever touches
// reminders already linked to this exact opportunityId — a company's
// manual, opportunity-less reminders are never in this set to begin
// with. Naturally idempotent: reminders already completed are filtered
// out before the write, so re-running this for the same terminal
// opportunity is always a safe no-op.
export async function completeOpenRemindersForOpportunity(
  reminders: readonly Reminder[],
  opportunityId: string,
): Promise<void> {
  const openReminders =
    selectOpenRemindersForOpportunity(
      reminders,
      opportunityId,
    );

  for (const reminder of openReminders) {
    await updateReminder(reminder.id, {
      completed: true,
    });
  }
}
