import {
  canonicalReportStage,
  selectLatestSnapshot,
  selectRepresentativeOpportunities,
} from "./organizerReport.ts";
import type {
  ApprovedPriceSnapshotRow,
  ReportOpportunity,
} from "./organizerReport.ts";

export const COMMERCIAL_AREA_EVENT_TYPES = [
  "offer_issued",
  "contract_completed",
] as const;

export type CommercialAreaEventType =
  (typeof COMMERCIAL_AREA_EVENT_TYPES)[number];

export type CommercialAreaEvent = {
  eventType: CommercialAreaEventType;
  exhibitionId: string;
  areaSqm: number;
  occurredAt: string;
  eventOperationKey: string;
};

export function isCommercialAreaEventType(
  value: string,
): value is CommercialAreaEventType {
  return (COMMERCIAL_AREA_EVENT_TYPES as readonly string[]).includes(value);
}

function validArea(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function sumPeriodCommercialArea(input: {
  events: readonly CommercialAreaEvent[];
  exhibitionId: string;
  eventType: CommercialAreaEventType;
  periodStartInclusive: string;
  periodEndExclusive: string;
}): number {
  const start = Date.parse(input.periodStartInclusive);
  const end = Date.parse(input.periodEndExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Commercial report period is invalid.");
  }

  const seen = new Set<string>();
  let total = 0;
  for (const event of input.events) {
    if (seen.has(event.eventOperationKey)) continue;
    seen.add(event.eventOperationKey);
    const occurredAt = Date.parse(event.occurredAt);
    if (
      event.exhibitionId === input.exhibitionId &&
      event.eventType === input.eventType &&
      occurredAt >= start &&
      occurredAt < end
    ) {
      if (!validArea(event.areaSqm)) throw new Error("Commercial event area is invalid.");
      total += event.areaSqm;
    }
  }
  return total;
}

export function sumTotalContractArea(input: {
  events: readonly CommercialAreaEvent[];
  exhibitionId: string;
  dataCutoffExclusive: string;
}): number {
  return sumPeriodCommercialArea({
    events: input.events,
    exhibitionId: input.exhibitionId,
    eventType: "contract_completed",
    periodStartInclusive: "1970-01-01T00:00:00.000Z",
    periodEndExclusive: input.dataCutoffExclusive,
  });
}

export function calculateCurrentOpenOfferArea(input: {
  exhibitionId: string;
  opportunities: readonly ReportOpportunity[];
  approvedSnapshots: readonly ApprovedPriceSnapshotRow[];
}): number {
  const representatives = selectRepresentativeOpportunities(
    input.opportunities,
    input.exhibitionId,
  );
  let total = 0;

  for (const opportunity of representatives) {
    if (canonicalReportStage(opportunity.stage) !== "Teklif") continue;
    const latest = selectLatestSnapshot(
      input.approvedSnapshots.filter(
        (snapshot) => snapshot.opportunity_id === opportunity.id,
      ),
    );
    const area = latest && latest.price_input && typeof latest.price_input === "object"
      ? (latest.price_input as Record<string, unknown>).standAreaSqm
      : null;
    if (!validArea(area)) throw new Error("Open offer has no valid approved area.");
    total += area;
  }
  return total;
}

export function calculateTotalSalesPipeline(
  currentOpenOffersSqm: number,
  totalContractsSqm: number,
): number {
  if (!validArea(currentOpenOffersSqm) && currentOpenOffersSqm !== 0) {
    throw new Error("Current open offer area is invalid.");
  }
  if (!validArea(totalContractsSqm) && totalContractsSqm !== 0) {
    throw new Error("Total contract area is invalid.");
  }
  return currentOpenOffersSqm + totalContractsSqm;
}
