import type { ProposalInput } from "../models/ProposalInput";
import type { ProposalItem } from "../models/ProposalItem";
import type {
  ProposalPaymentInstallment,
  ProposalResult,
} from "../models/ProposalResult";

type BuildProposalInput = ProposalInput & {
  organizerName?: string;
  organizerParticipationFee?: number;
  serviceFee?: number;
  serviceFeeApplied?: boolean;
  serviceFeeWaiverReason?: string;
  paymentSchedule?: ProposalPaymentInstallment[];
};

function isFiniteNumber(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function safeNumber(
  value: number | undefined,
): number {
  return isFiniteNumber(value)
    ? value
    : 0;
}

function deriveOrganizerParticipationFee(
  input: BuildProposalInput,
): number {
  if (
    isFiniteNumber(
      input.organizerParticipationFee,
    )
  ) {
    return input.organizerParticipationFee;
  }

  if (!input.priceResult) {
    return 0;
  }

  if (
    isFiniteNumber(
      input.priceResult.organizerNetTotal,
    )
  ) {
    return input.priceResult
      .organizerNetTotal;
  }

  return (
    safeNumber(
      input.priceResult.participationFee,
    ) +
    safeNumber(
      input.priceResult.registrationFee,
    ) +
    safeNumber(
      input.priceResult
        .additionalServicesFee,
    ) -
    safeNumber(
      input.priceResult.discountAmount,
    ) +
    safeNumber(
      input.priceResult.vatAmount,
    )
  );
}

function deriveServiceFee(
  input: BuildProposalInput,
): number {
  if (isFiniteNumber(input.serviceFee)) {
    return input.serviceFee;
  }

  if (!input.priceResult) {
    return 0;
  }

  if (
    isFiniteNumber(
      input.priceResult.erexpoNetTotal,
    )
  ) {
    return input.priceResult
      .erexpoNetTotal;
  }

  return safeNumber(
    input.priceResult.serviceFee,
  );
}

function createProposalNumber(
  createdAt: Date,
): string {
  const year = createdAt
    .getFullYear()
    .toString();

  const month = String(
    createdAt.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    createdAt.getDate(),
  ).padStart(2, "0");

  const timeCode = String(
    createdAt.getTime(),
  ).slice(-6);

  return `ATL-${year}${month}${day}-${timeCode}`;
}

function createParticipationItem(
  input: ProposalInput,
): ProposalItem {
  const area =
    input.standAreaSqm > 0
      ? input.standAreaSqm
      : 1;

  return {
    id: "participation-fee",
    title: "Participation Fee",
    quantity: input.standAreaSqm,
    unit: "m²",
    unitPrice:
      input.priceResult
        .participationFee / area,
    totalPrice:
      input.priceResult
        .participationFee,
    description:
      input.priceResult
        .locationSurcharge > 0
        ? "Stand participation fee including location surcharge."
        : "Stand participation fee.",
  };
}

function createProposalItems(
  input: ProposalInput,
): ProposalItem[] {
  const items: ProposalItem[] = [
    createParticipationItem(input),
  ];

  if (
    input.priceResult
      .registrationFee > 0
  ) {
    items.push({
      id: "registration-fee",
      title: "Registration Fee",
      quantity: 1,
      unit: "service",
      unitPrice:
        input.priceResult
          .registrationFee,
      totalPrice:
        input.priceResult
          .registrationFee,
      description:
        "Organizer registration fee.",
    });
  }

  if (
    input.priceResult.serviceFee > 0
  ) {
    items.push({
      id: "representative-service-fee",
      title:
        "Representative Service Fee",
      quantity: 1,
      unit: "service",
      unitPrice:
        input.priceResult.serviceFee,
      totalPrice:
        input.priceResult.serviceFee,
      description:
        "Exhibition representation and participation support services.",
    });
  }

  if (
    input.priceResult
      .additionalServicesFee > 0
  ) {
    items.push({
      id: "additional-services-fee",
      title:
        "Additional Services Fee",
      quantity: 1,
      unit: "service",
      unitPrice:
        input.priceResult
          .additionalServicesFee,
      totalPrice:
        input.priceResult
          .additionalServicesFee,
      description:
        "Additional services included in the proposal.",
    });
  }

  return items;
}

export function buildProposal(
  input: BuildProposalInput,
): ProposalResult {
  const createdAt = new Date();

  const organizerParticipationFee =
    safeNumber(
      deriveOrganizerParticipationFee(
        input,
      ),
    );

  const serviceFee = safeNumber(
    deriveServiceFee(input),
  );

  const serviceFeeApplied =
    input.serviceFeeApplied !==
    undefined
      ? input.serviceFeeApplied
      : serviceFee > 0;

  const paymentSchedule =
    input.paymentSchedule
      ? input.paymentSchedule.map(
          (installment) => ({
            ...installment,
          }),
        )
      : undefined;

  return {
    proposalNumber:
      createProposalNumber(createdAt),

    createdAt:
      createdAt.toISOString(),

    validUntil:
      input.validityDate,

    companyId:
      input.companyId,

    companyName:
      input.companyName,

    exhibitionId:
      input.exhibitionId,

    exhibitionName:
      input.exhibitionName,

    representativeName:
      input.representativeName,

    items:
      createProposalItems(input),

    subtotal:
      input.priceResult.subtotal,

    discount:
      input.priceResult
        .discountAmount,

    vat:
      input.priceResult.vatAmount,

    grandTotal:
      organizerParticipationFee +
      serviceFee,

    currency:
      input.priceResult.currency,

    paymentTerms:
      input.paymentTerms,

    notes:
      input.notes?.trim() ||
      undefined,

    organizerName:
      input.organizerName,

    organizerParticipationFee,

    serviceFee,

    serviceFeeApplied,

    serviceFeeWaiverReason:
      input.serviceFeeWaiverReason,

    paymentSchedule,
  };
}