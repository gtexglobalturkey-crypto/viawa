import type {
  StandLocationType,
  StandType,
} from "../../pricing/models/PriceInput";
import type { PriceResult } from "../../pricing/models/PriceResult";

export type ProposalInput = {
  companyId: string;
  companyName: string;

  exhibitionId: string;
  exhibitionName: string;

  standType: StandType;
  standLocationType: StandLocationType;
  standAreaSqm: number;

  priceResult: PriceResult;

  validityDate: string;
  paymentTerms: string;
  notes?: string;

  representativeName: string;
};