import type { OrganizerReportSnapshot } from "../../../../supabase/functions/_shared/organizerReport";

export type OrganizerReportRecord = {
  id: string;
  report_id: string;
  exhibition_id: string;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  data_cutoff: string;
  generated_at: string;
  schema_version: number;
  snapshot: OrganizerReportSnapshot;
  created_at: string;
};
export type OrganizerReportPeriodInput = {
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
};
