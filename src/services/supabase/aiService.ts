import { supabase } from "./client";
import type { AiMemory } from "../../types/database";

export type { AiMemory } from "../../types/database";

export async function getAiMemoryByCompany(
  companyId: string,
): Promise<AiMemory | null> {
  const { data, error } = await supabase
    .from("ai_memory")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function upsertAiMemory(
  memory: Omit<
    AiMemory,
    "id" | "created_at" | "updated_at"
  >,
): Promise<AiMemory> {
  const { data, error } = await supabase
    .from("ai_memory")
    .upsert(memory, {
      onConflict: "company_id",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteAiMemory(
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from("ai_memory")
    .delete()
    .eq("company_id", companyId);

  if (error) throw error;
}