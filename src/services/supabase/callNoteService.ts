import { supabase } from "./client";

import type { CallNote } from "../../types/database";

export type { CallNote } from "../../types/database";

export async function getCallNotes(): Promise<
  CallNote[]
> {
  const { data, error } = await supabase
    .from("call_notes")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return data ?? [];
}

export async function getCallNotesByCompany(
  companyId: string,
): Promise<CallNote[]> {
  const { data, error } = await supabase
    .from("call_notes")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return data ?? [];
}

export async function getCallNotesByOpportunity(
  opportunityId: string,
): Promise<CallNote[]> {
  const { data, error } = await supabase
    .from("call_notes")
    .select("*")
    .eq(
      "opportunity_id",
      opportunityId,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return data ?? [];
}

export async function createCallNote(
  callNote: Omit<
    CallNote,
    "id" | "created_at" | "updated_at"
  >,
): Promise<CallNote> {
  const { data, error } = await supabase
    .from("call_notes")
    .insert(callNote)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateCallNote(
  id: string,
  updates: Partial<
    Omit<
      CallNote,
      "id" | "created_at" | "updated_at"
    >
  >,
): Promise<CallNote> {
  const { data, error } = await supabase
    .from("call_notes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteCallNote(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("call_notes")
    .delete()
    .eq("id", id);

  if (error) throw error;
}