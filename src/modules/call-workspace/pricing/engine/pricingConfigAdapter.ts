import type { ExhibitionPricingConfig } from "../models/ExhibitionPricingConfig";
import type { PricingRule } from "../models/PricingRule";

/**
 * Adapts a repository ExhibitionPricingConfig into the PricingRule shape
 * runPricingEngine()/calculatePrice() already expect — the engine itself
 * is not touched, only fed a config-sourced rule instead of the old
 * hardcoded MiningTurkeyRules constant. The config's rate/vatRate are
 * fractional (0.20 = 20%, per pricing.json's schema); PricingRule's
 * existing fields are percentage points (calculatePrice divides by 100
 * internally) — the ×100 conversion happens here, at the boundary, so
 * calculatePrice.ts's formulas stay byte-for-byte unchanged.
 */
export function buildPricingRuleFromConfig(
  config: ExhibitionPricingConfig,
): PricingRule {
  return {
    exhibitionId: config.exhibitionId,
    currency: config.currency,

    standTypePrices:
      config.standTypes.map(
        (standType) => ({
          standType: standType.id,
          pricePerSqm:
            standType.unitPricePerSqm,
        }),
      ),

    locationSurcharges:
      config.locationSurcharges.map(
        (surcharge) => ({
          standLocationType:
            surcharge.id,
          surchargeRate:
            surcharge.rate * 100,
        }),
      ),

    // Both optional as of the WAMPEX-onward schema (newer configs fold
    // everything into additionalServicesFee instead) — default to 0 so
    // they contribute nothing to the subtotal when a config omits them,
    // without the engine itself needing to know these fee categories
    // are effectively retired for those configs.
    organizerRegistrationFee:
      config.fees.registrationFee ?? 0,
    representativeServiceFee:
      config.fees
        .representativeServiceFee ?? 0,
    representativeServiceFeeType:
      config.fees
        .representativeServiceFeeType ??
      "fixed",
    additionalServicesFee:
      config.fees
        .additionalServicesFee ?? 0,

    vatRate: config.tax.vatRate * 100,
  };
}
