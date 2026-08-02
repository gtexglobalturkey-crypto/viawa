import type { ApprovedPriceSnapshot } from "../../modules/call-workspace/pricing/models/ApprovedPriceSnapshot";
import {
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

export function getApprovedPriceSnapshot(input: {
  opportunityId: string;
  exhibitionId: string;
}) {
  return loadPersistentApprovedPriceSnapshot(supabase, input);
}

export function getDocumentSettings() {
  return loadPersistentDocumentSettings(supabase);
}
