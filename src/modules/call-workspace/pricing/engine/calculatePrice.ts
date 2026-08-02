import type {
  DiscountType,
  PriceInput,
} from "../models/PriceInput";
import type { PriceResult } from "../models/PriceResult";

function ensureNonNegative(
  value: number | undefined,
  fieldName: string,
): number {
  const resolvedValue = value ?? 0;

  if (
    !Number.isFinite(resolvedValue) ||
    resolvedValue < 0
  ) {
    throw new Error(
      `${fieldName} must be a non-negative number.`,
    );
  }

  return resolvedValue;
}

function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountType === "fixed") {
    return Math.min(discountValue, subtotal);
  }

  return subtotal * (discountValue / 100);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePrice(
  input: PriceInput,
): PriceResult {
  const standAreaSqm = ensureNonNegative(
    input.standAreaSqm,
    "standAreaSqm",
  );

  const basePricePerSqm = ensureNonNegative(
    input.basePricePerSqm,
    "basePricePerSqm",
  );

  const locationSurchargeRate = ensureNonNegative(
    input.locationSurchargeRate,
    "locationSurchargeRate",
  );

  const organizerRegistrationFee = ensureNonNegative(
    input.organizerRegistrationFee,
    "organizerRegistrationFee",
  );

  const representativeServiceFee = ensureNonNegative(
    input.representativeServiceFee,
    "representativeServiceFee",
  );

  const additionalServicesFee = ensureNonNegative(
    input.additionalServicesFee,
    "additionalServicesFee",
  );

  const discountValue = ensureNonNegative(
    input.discountValue,
    "discountValue",
  );

  const vatRate = ensureNonNegative(
    input.vatRate,
    "vatRate",
  );

  const discountType =
    input.discountType ?? "percentage";

  const sqmAmount =
    standAreaSqm * basePricePerSqm;

  const locationSurcharge =
    sqmAmount * (locationSurchargeRate / 100);

  const participationFee =
    sqmAmount + locationSurcharge;

  const subtotal =
    participationFee +
    organizerRegistrationFee +
    representativeServiceFee +
    additionalServicesFee;

  const discountAmount = calculateDiscount(
    subtotal,
    discountType,
    discountValue,
  );

  const taxableAmount =
    subtotal - discountAmount;

  const vatAmount =
    taxableAmount * (vatRate / 100);

  const grandTotal =
    taxableAmount + vatAmount;

  // Temporary compatibility mapping: PriceInput does not yet carry
  // separate organizer/EREXPO inputs for additional services, discount
  // or VAT, so the single existing discountAmount/vatAmount are
  // attributed entirely to the organizer side and additionalServicesFee
  // is treated as an organizer cost. This keeps
  // organizerNetTotal + erexpoNetTotal === grandTotal without changing
  // the pre-existing subtotal/discountAmount/vatAmount/grandTotal
  // formulas above. Replace once PriceInput exposes real organizer vs
  // EREXPO additional services, discount and VAT fields.
  const organizerBase =
    participationFee +
    organizerRegistrationFee +
    additionalServicesFee;

  const erexpoBase = representativeServiceFee;

  const organizerDiscountAmount = discountAmount;
  const erexpoDiscountAmount = 0;

  const organizerVatAmount = vatAmount;
  const erexpoVatAmount = 0;

  const organizerNetTotal =
    organizerBase -
    organizerDiscountAmount +
    organizerVatAmount;

  const erexpoNetTotal =
    erexpoBase -
    erexpoDiscountAmount +
    erexpoVatAmount;

  return {
    currency: input.currency ?? "EUR",
    sqmAmount: roundCurrency(sqmAmount),
    locationSurcharge:
      roundCurrency(locationSurcharge),
    participationFee:
      roundCurrency(participationFee),
    registrationFee:
      roundCurrency(organizerRegistrationFee),
    serviceFee:
      roundCurrency(representativeServiceFee),
    additionalServicesFee:
      roundCurrency(additionalServicesFee),
    subtotal: roundCurrency(subtotal),
    discountAmount:
      roundCurrency(discountAmount),
    vatAmount: roundCurrency(vatAmount),
    grandTotal: roundCurrency(grandTotal),
    appliedInput: input,

    organizerAdditionalServicesFee:
      roundCurrency(additionalServicesFee),
    organizerDiscountAmount:
      roundCurrency(organizerDiscountAmount),
    organizerVatAmount:
      roundCurrency(organizerVatAmount),
    organizerNetTotal:
      roundCurrency(organizerNetTotal),

    erexpoAdditionalServicesFee:
      roundCurrency(0),
    erexpoDiscountAmount:
      roundCurrency(erexpoDiscountAmount),
    erexpoVatAmount:
      roundCurrency(erexpoVatAmount),
    erexpoNetTotal:
      roundCurrency(erexpoNetTotal),
  };
}