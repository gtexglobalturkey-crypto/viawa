import { supabase } from "./client";
import type { Exhibition } from "../../types/database";

export type { Exhibition } from "../../types/database";

export async function getExhibitions(): Promise<
  Exhibition[]
> {
  const { data, error } = await supabase
    .from("exhibitions")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getExhibition(
  id: string,
): Promise<Exhibition | null> {
  const { data, error } = await supabase
    .from("exhibitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function createExhibition(
  exhibition: Omit<
    Exhibition,
    "id" | "created_at" | "updated_at"
  >,
): Promise<Exhibition> {
  const { data, error } = await supabase
    .from("exhibitions")
    .insert(exhibition)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateExhibition(
  id: string,
  updates: Partial<
    Omit<
      Exhibition,
      "id" | "created_at" | "updated_at"
    >
  >,
): Promise<Exhibition> {
  const { data, error } = await supabase
    .from("exhibitions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteExhibition(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("exhibitions")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}