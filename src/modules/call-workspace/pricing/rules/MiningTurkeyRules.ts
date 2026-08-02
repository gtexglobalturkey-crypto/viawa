import type { PricingRule } from "../models/PricingRule";

export const miningTurkeyPricingRules: PricingRule = {
  exhibitionId: "mining-turkey-2027",
  currency: "EUR",

  standTypePrices: [
    {
      standType: "space-only",
      pricePerSqm: 250,
    },
    {
      standType: "shell-scheme",
      pricePerSqm: 320,
    },
    {
      standType: "custom",
      pricePerSqm: 390,
    },
    {
      standType: "outdoor",
      pricePerSqm: 180,
    },
  ],

  locationSurcharges: [
    {
      standLocationType: "standard",
      surchargeRate: 0,
    },
    {
      standLocationType: "corner",
      surchargeRate: 10,
    },
    {
      standLocationType: "island",
      surchargeRate: 20,
    },
  ],

  organizerRegistrationFee: 500,
  representativeServiceFee: 750,
  additionalServicesFee: 0,
  vatRate: 20,
};