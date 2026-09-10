import type { ApprovedPriceSnapshot } from "../../modules/call-workspace/pricing/models/ApprovedPriceSnapshot";
import {
  approvePersistentOpportunityPrice,
  createPersistentApprovedPriceSnapshot,
  loadPersistentApprovedPriceSnapshot,
  loadPersistentDocumentSettings,
} from "../../modules/document-engine/repositories/persistentDocumentRepositories";
import { supabase } from "./client";

export function saveApprovedPriceSnapshot(input: {
  companyId: string;
  snapshot: ApprovedPriceSnapshot;
}) {
  return createPersistentApprovedPriceSnapshot(supabase, input);
}

/**
 * Atomically applies an approved price to the opportunity and creates its
 * immutable snapshot in one database transaction (approve_opportunity_price
 * RPC) — see commitApprovedPrice.ts, the only caller.
 */
export function approveOpportunityPrice(input: {
  companyId: string;
  snapshot: ApprovedPriceSnapshot;
}) {
  return approvePersistentOpportunityPrice(supabase, input);
}

export function getApprovedPriceSnapshot(input: {
  opportunityId: string;
  exhibitionId: string;
}) {
  return loadPersistentApprovedPriceSnapshot(supabase, input);
}

export function getDocumentSettings() {
  return loadPersistentDocumentSettings(supabase);
}
