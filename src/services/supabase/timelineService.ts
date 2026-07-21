import { supabase } from "./client";
import type { TimelineEvent } from "../../types/database";

export type { TimelineEvent } from "../../types/database";

export async function getTimelineEvents(): Promise<
  TimelineEvent[]
> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getTimelineEventsByCompany(
  companyId: string,
): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createTimelineEvent(
  timelineEvent: Omit<TimelineEvent, "id" | "created_at">,
): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from("timeline_events")
    .insert(timelineEvent)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteTimelineEvent(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("timeline_events")
    .delete()
    .eq("id", id);

  if (error) throw error;
}