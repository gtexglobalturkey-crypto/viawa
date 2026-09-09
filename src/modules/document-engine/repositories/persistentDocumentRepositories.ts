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

/**
 * Atomically updates the opportunity's price_* columns and inserts the
 * immutable approved_price_snapshots row that justifies them, via the
 * approve_opportunity_price RPC (see migration
 * 20260909090000_create_approve_opportunity_price_rpc.sql). Both writes
 * happen inside one Postgres function call — an implicit transaction — so
 * a failure of either half (including the snapshot's own RLS check)
 * leaves the opportunity's price fields untouched and no snapshot row
 * behind. Every value written is derived from the snapshot itself
 * (priceInput/priceResult), so there is nothing here that could drift
 * out of sync with the snapshot it accompanies.
 */
export async function approvePersistentOpportunityPrice(
  client: SupabaseClient,
  input: {
    companyId: string;
    snapshot: ApprovedPriceSnapshot;
  },
): Promise<string> {
  const { snapshot } = input;
  const { data, error } = await client.rpc("approve_opportunity_price", {
    p_opportunity_id: snapshot.opportunityId,
    p_company_id: input.companyId,
    p_exhibition_id: snapshot.exhibitionId,
    p_currency: snapshot.priceResult.currency,
    p_price_stand_type: snapshot.priceInput.standType,
    p_price_stand_area_sqm: snapshot.priceInput.standAreaSqm,
    p_price_location_surcharge_type: snapshot.priceInput.standLocationType,
    p_price_base_amount: snapshot.priceResult.sqmAmount,
    p_price_location_surcharge_amount: snapshot.priceResult.locationSurcharge,
    p_price_registration_fee: snapshot.priceResult.registrationFee,
    p_price_service_fee: snapshot.priceResult.serviceFee,
    p_price_subtotal: snapshot.priceResult.subtotal,
    p_price_vat_rate: snapshot.priceInput.vatRate ?? null,
    p_price_vat_amount: snapshot.priceResult.vatAmount,
    p_price_grand_total: snapshot.priceResult.grandTotal,
    p_price_calculated_at: snapshot.approvedAt,
    p_snapshot_approved_at: snapshot.approvedAt,
    p_snapshot_pricing_source: snapshot.pricingSource,
    p_snapshot_pricing_source_version: snapshot.pricingSourceVersion ?? null,
    p_snapshot_pricing_config_updated_at:
      snapshot.pricingConfigUpdatedAt ?? null,
    p_snapshot_matched_repository_folder:
      snapshot.matchedRepositoryFolder ?? null,
    p_snapshot_price_input: snapshot.priceInput,
    p_snapshot_price_result: snapshot.priceResult,
  });
  if (error) throw error;
  return data as string;
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
