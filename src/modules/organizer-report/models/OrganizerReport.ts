import type {
  OrganizerReportSnapshot,
  OrganizerReportSnapshotV1,
  OrganizerReportStage,
} from "../../../../supabase/functions/_shared/organizerReport";

export type OrganizerReportRecord = {
  id: string; report_id: string; exhibition_id: string;
  period_start: string | null; period_end: string | null; period_label: string | null;
  data_cutoff: string; generated_at: string; schema_version: number;
  snapshot: OrganizerReportSnapshot | OrganizerReportSnapshotV1;
  created_at: string;
};
export type OrganizerReportPeriodInput = {
  periodStart: string | null; periodEnd: string | null; periodLabel: string | null;
};
export type OrganizerReportView = {
  exhibitionName: string;
  pipelineCounts: Record<OrganizerReportStage, number>;
  openOffersSqm: number;
  companies: Array<{ companyName: string; stage: OrganizerReportStage; offeredSqm: number | null }>;
};

export function organizerReportView(record: OrganizerReportRecord): OrganizerReportView {
  if (record.schema_version >= 2 && "openOffersSqm" in record.snapshot) return record.snapshot;
  const legacy = record.snapshot as OrganizerReportSnapshotV1;
  return {
    exhibitionName: legacy.exhibitionName,
    pipelineCounts: legacy.pipelineCounts,
    openOffersSqm: legacy.potentialSqm,
    companies: legacy.companies.map((company) => ({ ...company, offeredSqm: null })),
  };
}

export const REPORT_STAGE_LABELS: Record<OrganizerReportStage, string> = {
  Yeni: "NEW", Bilgilendirme: "INFORMATION", Teklif: "OFFER", Sözleşme: "CONTRACT",
};

export function organizerReportEmailDraft(record: OrganizerReportRecord) {
  const view = organizerReportView(record);
  const period = record.period_label?.trim() || "Current Status";
  return {
    subject: `${view.exhibitionName} — Türkiye Market Report | ${period}`,
    body: `Dear Sir/Madam,\n\nPlease find attached the latest Türkiye Market Report for ${view.exhibitionName}.\n\nKind regards,\nVIAFA`,
    attachmentFileName: `${record.report_id}.pdf`,
    reportId: record.report_id,
  };
}
