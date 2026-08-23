export const ORGANIZER_REPORT_SCHEMA_VERSION = 2;

export const ORGANIZER_REPORT_STAGES = ["Yeni", "Bilgilendirme", "Teklif", "Sözleşme"] as const;
export type OrganizerReportStage = (typeof ORGANIZER_REPORT_STAGES)[number];

export type OrganizerReportCompanyRowV1 = { companyName: string; stage: OrganizerReportStage };
export type OrganizerReportSnapshotV1 = {
  exhibitionName: string;
  pipelineCounts: Record<OrganizerReportStage, number>;
  potentialSqm: number;
  companies: OrganizerReportCompanyRowV1[];
  periodNote: string;
};
export type OrganizerReportCompanyRow = OrganizerReportCompanyRowV1 & { offeredSqm: number | null };
export type OrganizerReportSnapshot = {
  exhibitionName: string;
  pipelineCounts: Record<OrganizerReportStage, number>;
  openOffersSqm: number;
  companies: OrganizerReportCompanyRow[];
};
export type ReportOpportunity = {
  id: string; company_id: string; exhibition_id: string | null; stage: string; updated_at: string;
};
export type ReportCompany = { id: string; company_name: string };
export type ApprovedPriceSnapshotRow = {
  opportunity_id: string; approved_at: string; created_at: string; price_input: unknown;
};

const STAGE_RANK: Record<OrganizerReportStage, number> = {
  Yeni: 0, Bilgilendirme: 1, Teklif: 2, Sözleşme: 3,
};

export function canonicalReportStage(stage: string): OrganizerReportStage | null {
  if (["new", "contacted", "interested"].includes(stage)) return "Yeni";
  if (stage === "information-sent") return "Bilgilendirme";
  if (["quotation-ready", "proposal-ready"].includes(stage)) return "Teklif";
  if (["quotation-sent", "negotiation", "contract"].includes(stage)) return "Sözleşme";
  return null;
}

export function selectRepresentativeOpportunities(
  opportunities: readonly ReportOpportunity[], exhibitionId: string,
): ReportOpportunity[] {
  const representatives = new Map<string, ReportOpportunity>();
  for (const opportunity of opportunities) {
    const stage = canonicalReportStage(opportunity.stage);
    if (opportunity.exhibition_id !== exhibitionId || !stage) continue;
    const current = representatives.get(opportunity.company_id);
    if (!current) { representatives.set(opportunity.company_id, opportunity); continue; }
    const currentStage = canonicalReportStage(current.stage)!;
    const rankDifference = STAGE_RANK[stage] - STAGE_RANK[currentStage];
    const dateDifference = Date.parse(opportunity.updated_at) - Date.parse(current.updated_at);
    if (rankDifference > 0 || (rankDifference === 0 && dateDifference > 0) ||
      (rankDifference === 0 && dateDifference === 0 && opportunity.id.localeCompare(current.id) < 0)) {
      representatives.set(opportunity.company_id, opportunity);
    }
  }
  return [...representatives.values()];
}

function snapshotArea(snapshot: ApprovedPriceSnapshotRow): number | null {
  if (!snapshot.price_input || typeof snapshot.price_input !== "object") return null;
  const value = (snapshot.price_input as Record<string, unknown>).standAreaSqm;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function selectLatestSnapshot(snapshots: readonly ApprovedPriceSnapshotRow[]): ApprovedPriceSnapshotRow | null {
  return [...snapshots].sort((a, b) =>
    Date.parse(b.approved_at) - Date.parse(a.approved_at) || Date.parse(b.created_at) - Date.parse(a.created_at),
  )[0] ?? null;
}

export function buildOrganizerReportSnapshot(input: {
  exhibitionId: string;
  exhibitionName: string;
  opportunities: readonly ReportOpportunity[];
  companies: readonly ReportCompany[];
  approvedSnapshots: readonly ApprovedPriceSnapshotRow[];
}): OrganizerReportSnapshot {
  const representatives = selectRepresentativeOpportunities(input.opportunities, input.exhibitionId);
  const companiesById = new Map(input.companies.map((company) => [company.id, company]));
  const counts: Record<OrganizerReportStage, number> = { Yeni: 0, Bilgilendirme: 0, Teklif: 0, Sözleşme: 0 };
  let openOffersSqm = 0;
  const rows = representatives.map((opportunity) => {
    const company = companiesById.get(opportunity.company_id);
    const stage = canonicalReportStage(opportunity.stage)!;
    if (!company) throw new Error("Organizer Report company data is incomplete.");
    counts[stage] += 1;
    let offeredSqm: number | null = null;
    if (stage === "Teklif") {
      const latest = selectLatestSnapshot(input.approvedSnapshots.filter((item) => item.opportunity_id === opportunity.id));
      offeredSqm = latest ? snapshotArea(latest) : null;
      if (offeredSqm === null) throw new Error("An open offer has no valid approved area.");
      openOffersSqm += offeredSqm;
    }
    return { companyName: company.company_name, stage, offeredSqm };
  }).sort((a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.companyName.localeCompare(b.companyName, "tr"));
  if (Object.values(counts).reduce((sum, count) => sum + count, 0) !== rows.length) {
    throw new Error("Organizer Report pipeline validation failed.");
  }
  if (rows.reduce((sum, row) => sum + (row.offeredSqm ?? 0), 0) !== openOffersSqm) {
    throw new Error("Organizer Report open-offer validation failed.");
  }
  return { exhibitionName: input.exhibitionName, pipelineCounts: counts, openOffersSqm, companies: rows };
}
