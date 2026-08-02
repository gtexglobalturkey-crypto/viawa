import { calculatePrice } from "./calculatePrice";

import type {
  DiscountType,
  StandLocationType,
  StandType,
} from "../models/PriceInput";
import type { PriceResult } from "../models/PriceResult";
import type { PricingRule } from "../models/PricingRule";

export type PricingEngineInput = {
  standType: StandType;
  standLocationType: StandLocationType;
  standAreaSqm: number;
  discountType?: DiscountType;
  discountValue?: number;
  organizerRegistrationFee?: number;
  representativeServiceFee?: number;
  additionalServicesFee?: number;
  vatRate?: number;
};

function findStandTypePrice(
  rule: PricingRule,
  standType: StandType,
): number {
  const standTypeRule =
    rule.standTypePrices.find(
      (item) => item.standType === standType,
    );

  if (!standTypeRule) {
    throw new Error(
      `No price rule found for stand type: ${standType}`,
    );
  }

  return standTypeRule.pricePerSqm;
}

function findLocationSurcharge(
  rule: PricingRule,
  standLocationType: StandLocationType,
): number {
  const locationRule =
    rule.locationSurcharges.find(
      (item) =>
        item.standLocationType ===
        standLocationType,
    );

  if (!locationRule) {
    throw new Error(
      `No surcharge rule found for stand location: ${standLocationType}`,
    );
  }

  return locationRule.surchargeRate;
}

export function runPricingEngine(
  rule: PricingRule,
  input: PricingEngineInput,
): PriceResult {
  const basePricePerSqm =
    findStandTypePrice(
      rule,
      input.standType,
    );

  const locationSurchargeRate =
    findLocationSurcharge(
      rule,
      input.standLocationType,
    );

  const configuredServiceFee =
    rule.representativeServiceFeeType ===
    "per-sqm"
      ? rule.representativeServiceFee *
        input.standAreaSqm
      : rule.representativeServiceFee;

  return calculatePrice({
    exhibitionId: rule.exhibitionId,
    standType: input.standType,
    standLocationType:
      input.standLocationType,
    standAreaSqm: input.standAreaSqm,
    basePricePerSqm,
    locationSurchargeRate,
    organizerRegistrationFee:
      input.organizerRegistrationFee ??
      rule.organizerRegistrationFee,
    representativeServiceFee:
      input.representativeServiceFee ??
      configuredServiceFee,
    additionalServicesFee:
      input.additionalServicesFee ??
      rule.additionalServicesFee ??
      0,
    discountType:
      input.discountType ?? "percentage",
    discountValue:
      input.discountValue ?? 0,
    vatRate:
      input.vatRate ?? rule.vatRate,
    currency: rule.currency,
  });
}
