import type {
  StandLocationType,
  StandType,
} from "./PriceInput";
import type { PricingServiceFeeType } from "./ExhibitionPricingConfig";

export type StandTypePriceRule = {
  standType: StandType;
  pricePerSqm: number;
};

export type LocationSurchargeRule = {
  standLocationType: StandLocationType;
  surchargeRate: number;
};

export type PricingRule = {
  exhibitionId: string;
  currency: string;
  standTypePrices: StandTypePriceRule[];
  locationSurcharges: LocationSurchargeRule[];
  organizerRegistrationFee: number;
  representativeServiceFee: number;
  representativeServiceFeeType?:
    PricingServiceFeeType;
  additionalServicesFee?: number;
  vatRate: number;
};
