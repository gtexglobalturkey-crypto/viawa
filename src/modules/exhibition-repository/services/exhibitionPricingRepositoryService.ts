import { supabase } from "../../../services/supabase/client";
import {
  createDefaultPricingRecord,
  type ExhibitionPricingRecord,
} from "../models/ExhibitionPricingRecord";
import type { PricingServiceFeeType } from "../../call-workspace/pricing/models/ExhibitionPricingConfig";

const TABLE = "exhibition_pricing_configs";

type ExhibitionPricingConfigRow = {
  exhibition_id: string;
  currency: string;
  vat_rate: number;
  space_only_price: number;
  shell_scheme_price: number;
  premium_shell_price: number;
  custom_stand_price: number;
  outdoor_price: number;
  location_normal_rate: number;
  location_corner_rate: number;
  location_two_fronts_rate: number;
  location_island_rate: number;
  location_double_deck_rate: number;
  registration_fee: number;
  service_fee_type: PricingServiceFeeType;
  service_fee: number;
  additional_services_fee: number;
  discount_enabled: boolean;
  discount_max_percent: number | null;
  updated_at: string;
};

function fromRow(
  row: ExhibitionPricingConfigRow,
): ExhibitionPricingRecord {
  return {
    exhibitionId: row.exhibition_id,
    currency: row.currency,
    vatRate: row.vat_rate,
    spaceOnlyPrice: row.space_only_price,
    shellSchemePrice:
      row.shell_scheme_price,
    premiumShellPrice:
      row.premium_shell_price,
    customStandPrice:
      row.custom_stand_price,
    outdoorPrice: row.outdoor_price,
    locationNormalRate:
      row.location_normal_rate,
    locationCornerRate:
      row.location_corner_rate,
    locationTwoFrontsRate:
      row.location_two_fronts_rate,
    locationIslandRate:
      row.location_island_rate,
    locationDoubleDeckRate:
      row.location_double_deck_rate,
    registrationFee:
      row.registration_fee,
    serviceFeeType:
      row.service_fee_type ?? "fixed",
    serviceFee: row.service_fee,
    additionalServicesFee:
      row.additional_services_fee,
    discountEnabled:
      row.discount_enabled,
    discountMaxPercent:
      row.discount_max_percent,
    updatedAt: row.updated_at,
  };
}

/**
 * Loads this exhibition's pricing repository record. Returns an
 * in-memory default (all zeros, EUR, 20% VAT) when no row exists yet —
 * the row is only actually created on the first Save. Used by the
 * Repository management screen, which always needs *something* to
 * populate its form with.
 */
export async function getExhibitionPricingConfig(
  exhibitionId: string,
): Promise<ExhibitionPricingRecord> {
  const record =
    await findExhibitionPricingRecord(
      exhibitionId,
    );

  return (
    record ??
    createDefaultPricingRecord(
      exhibitionId,
    )
  );
}

/**
 * Same lookup as getExhibitionPricingConfig, but returns null instead
 * of a zeroed default when no row exists — used by the live Price
 * Calculator (Sprint 22.2), which must be able to tell "no repository
 * pricing configured yet" apart from "priced at zero" and show the
 * former as an explicit warning rather than silently calculating with
 * all-zero prices.
 */
export async function findExhibitionPricingRecord(
  exhibitionId: string,
): Promise<ExhibitionPricingRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("exhibition_id", exhibitionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data
    ? fromRow(
        data as ExhibitionPricingConfigRow,
      )
    : null;
}

export async function saveExhibitionPricingConfig(
  record: ExhibitionPricingRecord,
): Promise<ExhibitionPricingRecord> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        exhibition_id:
          record.exhibitionId,
        currency: record.currency,
        vat_rate: record.vatRate,
        space_only_price:
          record.spaceOnlyPrice,
        shell_scheme_price:
          record.shellSchemePrice,
        premium_shell_price:
          record.premiumShellPrice,
        custom_stand_price:
          record.customStandPrice,
        outdoor_price:
          record.outdoorPrice,
        location_normal_rate:
          record.locationNormalRate,
        location_corner_rate:
          record.locationCornerRate,
        location_two_fronts_rate:
          record.locationTwoFrontsRate,
        location_island_rate:
          record.locationIslandRate,
        location_double_deck_rate:
          record.locationDoubleDeckRate,
        registration_fee:
          record.registrationFee,
        service_fee_type:
          record.serviceFeeType,
        service_fee: record.serviceFee,
        additional_services_fee:
          record.additionalServicesFee,
        discount_enabled:
          record.discountEnabled,
        discount_max_percent:
          record.discountMaxPercent,
        updated_at:
          new Date().toISOString(),
      },
      { onConflict: "exhibition_id" },
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return fromRow(
    data as ExhibitionPricingConfigRow,
  );
}
