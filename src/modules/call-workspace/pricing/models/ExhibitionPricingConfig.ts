import type {
  StandLocationType,
  StandType,
} from "./PriceInput";

export type ExhibitionPricingConfigStatus =
  | "active"
  | "draft"
  | "archived";

export type PricingStandTypeConfig = {
  id: StandType;
  label: string;
  unitPricePerSqm: number;
};

export type PricingLocationSurchargeConfig = {
  id: StandLocationType;
  label: string;
  /** Fractional rate — 0.10 means 10%. */
  rate: number;
};

export type PricingFeesConfig = {
  // Optional as of the WAMPEX-onward schema: newer configs fold
  // everything into additionalServicesFee ("Additional Fees") instead of
  // these two legacy categories. Still supported and validated when a
  // config does provide them (Mining Turkey).
  registrationFee?: number;
  representativeServiceFee?: number;
  representativeServiceFeeType?:
    PricingServiceFeeType;
  additionalServicesFee?: number;
};

export type PricingServiceFeeType =
  | "per-sqm"
  | "fixed";

export type PricingTaxConfig = {
  /** Fractional rate — 0.20 means 20%. */
  vatRate: number;
};

export type PricingDiscountConfig = {
  enabled: boolean;
  /** Null/absent means no configured ceiling. */
  maxPercent?: number;
  /**
   * Modeled for a future manual-approval workflow — not wired to any
   * behavior yet, just carried through so the data is available when
   * that workflow is built.
   */
  requiresManualApproval?: boolean;
};

/**
 * Sourced from the Fuar Repository (Supabase exhibition_pricing_configs
 * — see src/modules/exhibition-repository/) as of Sprint 22.2. The
 * pre-Sprint-22.2 dev-only JSON file source
 * (resources/templates/test-data/exhibitions/*\/pricing/pricing.json,
 * served by the now-removed vite-plugins/exhibitionPricingPlugin.ts) is
 * no longer read by the app.
 */
export type ExhibitionPricingConfig = {
  schemaVersion: string;
  exhibitionId: string;
  exhibitionName: string;
  currency: string;
  updatedAt: string;
  status: ExhibitionPricingConfigStatus;
  standTypes: PricingStandTypeConfig[];
  locationSurcharges: PricingLocationSurchargeConfig[];
  fees: PricingFeesConfig;
  tax: PricingTaxConfig;
  discount: PricingDiscountConfig;
};
