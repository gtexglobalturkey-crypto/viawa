import type { PriceInput } from "./PriceInput";

export type PriceResult = {
  currency: string;
  sqmAmount: number;
  locationSurcharge: number;
  participationFee: number;
  registrationFee: number;
  serviceFee: number;
  additionalServicesFee: number;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  grandTotal: number;
  appliedInput: PriceInput;

  organizerAdditionalServicesFee?: number;
  organizerDiscountAmount?: number;
  organizerVatAmount?: number;
  organizerNetTotal?: number;

  erexpoAdditionalServicesFee?: number;
  erexpoDiscountAmount?: number;
  erexpoVatAmount?: number;
  erexpoNetTotal?: number;
};