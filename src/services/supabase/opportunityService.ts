import { supabase } from "./client";
import type { Opportunity } from "../../types/database";
import {
  hasReachedActiveOpportunityLimit,
  isActiveBusinessStatus,
} from "../../types/businessStatus";

export type { Opportunity } from "../../types/database";

// Sprint 25 (BUG-S25-001). Recognizable across both enforcement layers:
// thrown directly by the pre-check below, and also raised verbatim as a
// PostgreSQL exception message by the enforce_active_opportunity_limit
// trigger (see supabase/migrations/20260801100000_enforce_active_opportunity_limit.sql)
// when a race lets two requests past the pre-check at once. Callers should
// check `error.code` rather than parse messages.
export const ACTIVE_OPPORTUNITY_LIMIT_ERROR_CODE =
  "ACTIVE_OPPORTUNITY_LIMIT_REACHED";

export class ActiveOpportunityLimitError extends Error {
  readonly code = ACTIVE_OPPORTUNITY_LIMIT_ERROR_CODE;

  constructor() {
    super(
      "This company has reached the maximum number of active opportunities.",
    );
    this.name = "ActiveOpportunityLimitError";
  }
}

function mapActiveOpportunityLimitError(
  error: { message?: string | null } | null | undefined,
): never {
  if (error?.message?.includes(ACTIVE_OPPORTUNITY_LIMIT_ERROR_CODE)) {
    throw new ActiveOpportunityLimitError();
  }

  throw error;
}

async function validateOpportunityContact(
  contactId: string,
  companyId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "Opportunity contact must belong to the same company.",
    );
  }
}

export async function getOpportunities(): Promise<
  Opportunity[]
> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getOpportunitiesByExhibition(exhibitionId: string): Promise<Opportunity[]> {
  const { data, error } = await supabase.from("opportunities").select("*").eq("exhibition_id", exhibitionId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getOpportunitiesByCompany(
  companyId: string,
): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getOpportunity(
  id: string,
): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createOpportunity(
  opportunity: Omit<
    Opportunity,
    "id" | "created_at" | "updated_at"
  >,
): Promise<Opportunity> {
  if (opportunity.contact_id) {
    await validateOpportunityContact(
      opportunity.contact_id,
      opportunity.company_id,
    );
  }

  // Fast, user-facing check only — the concurrency-safe guarantee lives in
  // the enforce_active_opportunity_limit trigger (see the migration noted
  // above). A newly created opportunity that isn't itself active (e.g.
  // imported already signed/lost) never counts against the cap.
  if (isActiveBusinessStatus(opportunity.stage)) {
    const companyOpportunities = await getOpportunitiesByCompany(
      opportunity.company_id,
    );

    if (hasReachedActiveOpportunityLimit(companyOpportunities)) {
      throw new ActiveOpportunityLimitError();
    }
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert(opportunity)
    .select()
    .single();

  if (error) mapActiveOpportunityLimitError(error);

  return data;
}

export async function updateOpportunity(
  id: string,
  updates: Partial<
    Omit<Opportunity, "id" | "created_at" | "updated_at">
  >,
): Promise<Opportunity> {
  if (updates.contact_id) {
    const currentOpportunity = await getOpportunity(id);

    if (!currentOpportunity) {
      throw new Error("Opportunity not found.");
    }

    await validateOpportunityContact(
      updates.contact_id,
      currentOpportunity.company_id,
    );
  }

  const { data, error } = await supabase
    .from("opportunities")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) mapActiveOpportunityLimitError(error);

  return data;
}

export async function deleteOpportunity(
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
