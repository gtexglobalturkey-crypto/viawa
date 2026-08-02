import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApprovedPriceSnapshot } from "../../call-workspace/pricing/models/ApprovedPriceSnapshot";
import type { DocumentMergeSettings } from "../merge/models";
import { PARTICIPATION_CONTRACT_DOCUMENT_TYPE } from "../templates/participation-contract/templateMetadata";

const PARTICIPATION_CONTRACT_SETTINGS_ID =
  PARTICIPATION_CONTRACT_DOCUMENT_TYPE;

type SnapshotRow = {
  opportunity_id: string;
  exhibition_id: string;
  approved_at: string;
  pricing_source: ApprovedPriceSnapshot["pricingSource"];
  pricing_source_version: string | null;
  pricing_config_updated_at: string | null;
  matched_repository_folder: string | null;
  price_input: ApprovedPriceSnapshot["priceInput"];
  price_result: ApprovedPriceSnapshot["priceResult"];
  exhibitions: { name: string } | { name: string }[] | null;
};

function relatedExhibitionName(row: SnapshotRow) {
  const exhibition = Array.isArray(row.exhibitions)
    ? row.exhibitions[0]
    : row.exhibitions;
  return exhibition?.name ?? "";
}

export async function loadPersistentApprovedPriceSnapshot(
  client: SupabaseClient,
  input: { opportunityId: string; exhibitionId: string },
): Promise<ApprovedPriceSnapshot | null> {
  const { data, error } = await client
    .from("approved_price_snapshots")
    .select("opportunity_id,exhibition_id,approved_at,pricing_source,pricing_source_version,pricing_config_updated_at,matched_repository_folder,price_input,price_result,exhibitions(name)")
    .eq("opportunity_id", input.opportunityId)
    .eq("exhibition_id", input.exhibitionId)
    .order("approved_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as SnapshotRow;
  return {
    opportunityId: row.opportunity_id,
    exhibitionId: row.exhibition_id,
    exhibitionName: relatedExhibitionName(row),
    pricingSource: row.pricing_source,
    pricingSourceVersion: row.pricing_source_version ?? undefined,
    pricingConfigUpdatedAt: row.pricing_config_updated_at ?? undefined,
    matchedRepositoryFolder: row.matched_repository_folder ?? undefined,
    approvedAt: row.approved_at,
    priceInput: row.price_input,
    priceResult: row.price_result,
  };
}

export async function createPersistentApprovedPriceSnapshot(
  client: SupabaseClient,
  input: {
    companyId: string;
    snapshot: ApprovedPriceSnapshot;
  },
) {
  const { error } = await client.from("approved_price_snapshots").insert({
    company_id: input.companyId,
    opportunity_id: input.snapshot.opportunityId,
    exhibition_id: input.snapshot.exhibitionId,
    approved_at: input.snapshot.approvedAt,
    currency: input.snapshot.priceResult.currency,
    pricing_source: input.snapshot.pricingSource,
    pricing_source_version: input.snapshot.pricingSourceVersion ?? null,
    pricing_config_updated_at: input.snapshot.pricingConfigUpdatedAt ?? null,
    matched_repository_folder: input.snapshot.matchedRepositoryFolder ?? null,
    price_input: input.snapshot.priceInput,
    price_result: input.snapshot.priceResult,
  });
  if (error) throw error;
}

export async function loadPersistentDocumentSettings(
  client: SupabaseClient,
): Promise<DocumentMergeSettings | null> {
  const { data, error } = await client
    .from("document_settings")
    .select("issuer,bank")
    .eq("id", PARTICIPATION_CONTRACT_SETTINGS_ID)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        issuer: data.issuer as DocumentMergeSettings["issuer"],
        bank: data.bank as DocumentMergeSettings["bank"],
      }
    : null;
}
