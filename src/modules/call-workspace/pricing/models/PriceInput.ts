// "custom" and "custom-stand" both mean "custom stand" — kept as two
// separate values on purpose: existing repository configs (Mining
// Turkey) already shipped with "custom", so keeping it preserves that
// config unchanged and working; "custom-stand" is what new configs
// (WAMPEX onward) use.
export type StandType =
  | "space-only"
  | "shell-scheme"
  | "premium-shell"
  | "custom"
  | "custom-stand"
  | "outdoor";

export type StandLocationType =
  | "standard"
  | "corner"
  | "peninsula"
  | "island"
  | "double-deck";

export type DiscountType =
  | "percentage"
  | "fixed";

export type PriceInput = {
  exhibitionId: string;
  standType: StandType;
  standLocationType: StandLocationType;
  standAreaSqm: number;
  basePricePerSqm: number;
  locationSurchargeRate?: number;
  organizerRegistrationFee?: number;
  representativeServiceFee?: number;
  additionalServicesFee?: number;
  discountType?: DiscountType;
  discountValue?: number;
  vatRate?: number;
  currency?: string;
};