import type { OpportunityPaymentPlanItem } from "../../../types/database";

export const PAYMENT_PLAN_ROW_COUNT = 5;

export type PaymentPlanRowFormState = {
  dueDate: string;
  amount: string;
  payee: string;
};

export type PaymentPlanFormState = readonly PaymentPlanRowFormState[];

function emptyRow(): PaymentPlanRowFormState {
  return { dueDate: "", amount: "", payee: "" };
}

export function createEmptyPaymentPlanFormState(): PaymentPlanFormState {
  return Array.from({ length: PAYMENT_PLAN_ROW_COUNT }, emptyRow);
}

/**
 * Rebuilds the 5-row form state from a saved record. Rows are
 * positional and independent — a saved array shorter than 5 (e.g. only
 * the first row was ever filled) simply leaves the remaining rows
 * empty, never shifted or auto-filled.
 */
export function paymentPlanFormStateFromRecord(
  record:
    | readonly OpportunityPaymentPlanItem[]
    | null
    | undefined,
): PaymentPlanFormState {
  return Array.from({ length: PAYMENT_PLAN_ROW_COUNT }, (_, index) => {
    const existing = record?.[index];
    if (!existing) {
      return emptyRow();
    }
    return {
      dueDate: existing.dueDate ?? "",
      amount:
        existing.amount === null ||
        existing.amount === undefined
          ? ""
          : String(existing.amount),
      payee: existing.payee ?? "",
    };
  });
}

/**
 * Sums the rows' amounts using the exact same parsing rule
 * paymentPlanFormStateToRecord uses to persist them (blank -> 0, an
 * unparsable or negative value -> 0). Display-only — the real,
 * enforced total-equality check lives entirely server-side in
 * generateParticipationContract.ts (RC-02); this is never used to
 * block generation, only to show the running total while typing.
 */
export function sumPaymentPlanFormAmounts(
  state: PaymentPlanFormState,
): number {
  return state.reduce((total, row) => {
    const trimmed = row.amount.trim();
    if (trimmed === "") {
      return total;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0
      ? total + parsed
      : total;
  }, 0);
}

export type PaymentPlanRowField = keyof PaymentPlanRowFormState;

/**
 * Updates a single field of a single row. Rows are independent — never
 * recalculated, totalled, or auto-filled from one another.
 */
export function updatePaymentPlanRowField(
  current: PaymentPlanFormState,
  index: number,
  field: PaymentPlanRowField,
  value: string,
): PaymentPlanFormState {
  return current.map((row, rowIndex) =>
    rowIndex === index ? { ...row, [field]: value } : row,
  );
}

/**
 * Converts the form state to the persisted shape. A row where every
 * field is blank stays blank (null, not an empty string or 0) so the
 * mapping's existing clean()/blank handling renders nothing rather than
 * a stray placeholder. amount only ever commits a valid non-negative
 * number — an unparsable value is stored as null rather than NaN.
 */
export function paymentPlanFormStateToRecord(
  state: PaymentPlanFormState,
): OpportunityPaymentPlanItem[] {
  return state.map((row) => {
    const dueDate = row.dueDate.trim();
    const payee = row.payee.trim();
    const parsedAmount = row.amount.trim() === "" ? null : Number(row.amount);
    const amount =
      parsedAmount !== null &&
      Number.isFinite(parsedAmount) &&
      parsedAmount >= 0
        ? parsedAmount
        : null;

    return {
      dueDate: dueDate === "" ? null : dueDate,
      amount,
      payee: payee === "" ? null : payee,
    };
  });
}
