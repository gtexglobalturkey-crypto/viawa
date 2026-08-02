import type { ExhibitionPricingConfig } from "../../call-workspace/pricing/models/ExhibitionPricingConfig";
import type { PricingServiceFeeType } from "../../call-workspace/pricing/models/ExhibitionPricingConfig";

/**
 * One row of supabase.exhibition_pricing_configs — the "Fiyat
 * Hesaplayıcı" tab's persisted state. Flat/fixed shape (not the dynamic
 * standTypes[]/locationSurcharges[] arrays ExhibitionPricingConfig
 * uses) because this MVP only ever edits the 4 stand prices + 4
 * location surcharges + 2 fees the sprint asked for.
 */
export type ExhibitionPricingRecord = {
  exhibitionId: string;
  currency: string;
  /** Fractional — 0.20 means 20%. */
  vatRate: number;

  spaceOnlyPrice: number;
  shellSchemePrice: number;
  premiumShellPrice: number;
  customStandPrice: number;
  outdoorPrice: number;

  /** Fractional — 0.10 means 10%. */
  locationNormalRate: number;
  locationCornerRate: number;
  locationTwoFrontsRate: number;
  locationIslandRate: number;
  locationDoubleDeckRate: number;

  registrationFee: number;
  serviceFeeType: PricingServiceFeeType;
  serviceFee: number;
  additionalServicesFee: number;

  discountEnabled: boolean;
  discountMaxPercent: number | null;

  updatedAt: string;
};

export function createDefaultPricingRecord(
  exhibitionId: string,
): ExhibitionPricingRecord {
  return {
    exhibitionId,
    currency: "EUR",
    vatRate: 0.2,
    spaceOnlyPrice: 0,
    shellSchemePrice: 0,
    premiumShellPrice: 0,
    customStandPrice: 0,
    outdoorPrice: 0,
    locationNormalRate: 0,
    locationCornerRate: 0,
    locationTwoFrontsRate: 0,
    locationIslandRate: 0,
    locationDoubleDeckRate: 0,
    registrationFee: 0,
    serviceFeeType: "fixed",
    serviceFee: 0,
    additionalServicesFee: 0,
    discountEnabled: false,
    discountMaxPercent: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Bridges a repository record into the shape
 * pricing/engine/pricingConfigAdapter.ts already knows how to turn into
 * a PricingRule for calculatePrice() — this is the "prepare the
 * existing price calculation module to use this repository data" part
 * of the sprint. Not called from PriceCalculatorModal yet (that still
 * reads the dev-only JSON-file source unchanged this sprint); this
 * mapper just proves the data is already shape-ready for that wiring.
 *
 * Location id "peninsula"/"two-fronts" note: PriceInput's
 * StandLocationType has no literal "two-fronts" value — "peninsula" is
 * the existing id for a two-open-sides stand, so it's reused here with
 * a "Two Fronts" display label rather than adding a new union member to
 * the shared pricing engine types.
 */
export function toExhibitionPricingConfig(
  record: ExhibitionPricingRecord,
  exhibitionName: string,
): ExhibitionPricingConfig {
  return {
    schemaVersion: "1.0",
    exhibitionId: record.exhibitionId,
    exhibitionName,
    currency: record.currency,
    updatedAt: record.updatedAt,
    status: "active",

    standTypes: [
      {
        id: "space-only",
        label: "Space Only",
        unitPricePerSqm:
          record.spaceOnlyPrice,
      },
      {
        id: "shell-scheme",
        label: "Shell Scheme",
        unitPricePerSqm:
          record.shellSchemePrice,
      },
      {
        id: "premium-shell",
        label: "Premium Shell",
        unitPricePerSqm:
          record.premiumShellPrice,
      },
      {
        id: "custom-stand",
        label: "Custom Stand",
        unitPricePerSqm:
          record.customStandPrice,
      },
      {
        id: "outdoor",
        label: "Outdoor",
        unitPricePerSqm:
          record.outdoorPrice,
      },
    ],

    locationSurcharges: [
      {
        id: "standard",
        label: "Normal",
        rate: record.locationNormalRate,
      },
      {
        id: "corner",
        label: "Corner",
        rate: record.locationCornerRate,
      },
      {
        id: "peninsula",
        label: "Two Fronts",
        rate: record.locationTwoFrontsRate,
      },
      {
        id: "island",
        label: "Island",
        rate: record.locationIslandRate,
      },
      {
        id: "double-deck",
        label: "Double Deck",
        rate: record.locationDoubleDeckRate,
      },
    ],

    fees: {
      registrationFee:
        record.registrationFee,
      representativeServiceFee:
        record.serviceFee,
      representativeServiceFeeType:
        record.serviceFeeType,
      additionalServicesFee:
        record.additionalServicesFee,
    },

    tax: {
      vatRate: record.vatRate,
    },

    discount: {
      enabled: record.discountEnabled,
      maxPercent:
        record.discountMaxPercent ??
        undefined,
    },
  };
}
