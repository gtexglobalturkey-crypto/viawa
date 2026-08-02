import type { ProposalResult } from "./ProposalResult";

export type ProposalValidationIssueSeverity = "error" | "warning";

export type ProposalValidationIssue = {
  code: string;
  message: string;
  severity: ProposalValidationIssueSeverity;
  field?: string;
  installmentId?: string;
};

export type ProposalValidationResult = {
  valid: boolean;
  issues: ProposalValidationIssue[];
  organizerScheduleTotal: number;
  serviceScheduleTotal: number;
  scheduleGrandTotal: number;
};

const AMOUNT_TOLERANCE = 0.01;

function isCloseEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCurrency(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveFeeAmount(
  value: number | undefined,
  code: string,
  field: string,
  label: string,
  issues: ProposalValidationIssue[],
): number {
  if (value === undefined) {
    return 0;
  }

  if (!isFiniteNumber(value)) {
    issues.push({
      code,
      message: `${label} must be a finite number.`,
      severity: "error",
      field,
    });
    return 0;
  }

  if (value < 0) {
    issues.push({
      code,
      message: `${label} cannot be negative.`,
      severity: "error",
      field,
    });
  }

  return value;
}

export function validateProposal(proposal: ProposalResult): ProposalValidationResult {
  const issues: ProposalValidationIssue[] = [];

  const organizerFee = resolveFeeAmount(
    proposal.organizerParticipationFee,
    "INVALID_ORGANIZER_FEE",
    "organizerParticipationFee",
    "Organizer participation fee",
    issues,
  );

  const serviceFee = resolveFeeAmount(
    proposal.serviceFee,
    "INVALID_SERVICE_FEE",
    "serviceFee",
    "Service fee",
    issues,
  );

  const grandTotal = resolveFeeAmount(
    proposal.grandTotal,
    "INVALID_GRAND_TOTAL",
    "grandTotal",
    "Grand total",
    issues,
  );

  if (proposal.serviceFeeApplied === false) {
    if (serviceFee > AMOUNT_TOLERANCE) {
      issues.push({
        code: "SERVICE_FEE_NOT_ZERO",
        message: "Service fee must be zero or undefined when serviceFeeApplied is false.",
        severity: "error",
        field: "serviceFee",
      });
    }

    if (!proposal.serviceFeeWaiverReason || proposal.serviceFeeWaiverReason.trim() === "") {
      issues.push({
        code: "SERVICE_FEE_WAIVER_REASON_MISSING",
        message: "A waiver reason is recommended when the service fee is not applied.",
        severity: "warning",
        field: "serviceFeeWaiverReason",
      });
    }
  }

  const expectedGrandTotal = organizerFee + serviceFee;
  if (!isCloseEnough(grandTotal, expectedGrandTotal)) {
    issues.push({
      code: "GRAND_TOTAL_MISMATCH",
      message: "Grand total does not equal organizer participation fee plus service fee.",
      severity: "error",
      field: "grandTotal",
    });
  }

  let organizerScheduleTotal = 0;
  let serviceScheduleTotal = 0;
  let scheduleGrandTotal = 0;

  const schedule = proposal.paymentSchedule;

  if (schedule && schedule.length > 0) {
    const proposalCurrency = normalizeCurrency(proposal.currency);

    for (const installment of schedule) {
      const amountRaw = installment.amount;
      const amountValid = isFiniteNumber(amountRaw) && amountRaw >= 0;

      if (!amountValid) {
        issues.push({
          code: "INVALID_INSTALLMENT_AMOUNT",
          message: "Installment amount must be a non-negative finite number.",
          severity: "error",
          field: "amount",
          installmentId: installment.id,
        });
      }

      if (!installment.dueDate || installment.dueDate.trim() === "") {
        issues.push({
          code: "INSTALLMENT_DUE_DATE_MISSING",
          message: "Installment due date is missing.",
          severity: "error",
          field: "dueDate",
          installmentId: installment.id,
        });
      }

      if (!installment.currency || installment.currency.trim() === "") {
        issues.push({
          code: "INSTALLMENT_CURRENCY_MISSING",
          message: "Installment currency is missing.",
          severity: "error",
          field: "currency",
          installmentId: installment.id,
        });
        continue;
      }

      if (normalizeCurrency(installment.currency) !== proposalCurrency) {
        issues.push({
          code: "INSTALLMENT_CURRENCY_MISMATCH",
          message: "Installment currency does not match the proposal's top-level currency; excluded from totals.",
          severity: "warning",
          field: "currency",
          installmentId: installment.id,
        });
        continue;
      }

      if (!amountValid) {
        continue;
      }

      const amount = amountRaw;

      scheduleGrandTotal += amount;

      if (installment.category === "organizer") {
        organizerScheduleTotal += amount;
      } else if (installment.category === "service") {
        serviceScheduleTotal += amount;
      }
    }

    if (!isCloseEnough(organizerScheduleTotal, organizerFee)) {
      issues.push({
        code: "ORGANIZER_SCHEDULE_MISMATCH",
        message: "Sum of organizer-category installments does not equal organizer participation fee.",
        severity: "error",
        field: "organizerParticipationFee",
      });
    }

    if (!isCloseEnough(serviceScheduleTotal, serviceFee)) {
      issues.push({
        code: "SERVICE_SCHEDULE_MISMATCH",
        message: "Sum of service-category installments does not equal service fee.",
        severity: "error",
        field: "serviceFee",
      });
    }

    if (!isCloseEnough(scheduleGrandTotal, grandTotal)) {
      issues.push({
        code: "PAYMENT_SCHEDULE_TOTAL_MISMATCH",
        message: "Sum of all matching-currency installments does not equal grand total.",
        severity: "error",
        field: "grandTotal",
      });
    }
  }

  const valid = !issues.some((issue) => issue.severity === "error");

  return {
    valid,
    issues,
    organizerScheduleTotal,
    serviceScheduleTotal,
    scheduleGrandTotal,
  };
}
