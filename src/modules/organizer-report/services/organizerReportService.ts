import { supabase } from "../../../services/supabase/client";

import type {
  OrganizerReportPeriodInput,
  OrganizerReportRecord,
} from "../models/OrganizerReport";

export async function listOrganizerReports(
  exhibitionId: string,
): Promise<OrganizerReportRecord[]> {
  const { data, error } = await supabase
    .from("organizer_report_snapshots")
    .select("id,report_id,exhibition_id,period_start,period_end,period_label,data_cutoff,generated_at,schema_version,snapshot,created_at")
    .eq("exhibition_id", exhibitionId)
    .order("generated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrganizerReportRecord[];
}
export async function generateOrganizerReport(
  exhibitionId: string,
  period: OrganizerReportPeriodInput,
): Promise<OrganizerReportRecord> {
  const { data, error } = await supabase.functions.invoke<{
    report?: OrganizerReportRecord;
    error?: string;
  }>("organizer-report", {
    body: { exhibitionId, ...period },
  });

  if (error) throw error;
  if (!data?.report) throw new Error(data?.error ?? "Rapor oluşturulamadı.");
  return data.report;
}

export type OrganizerReportEmailResult = {
  sent: true;
  duplicate: boolean;
  provider: "gmail";
  providerMessageId: string;
  acceptedAt: string;
};

export async function sendOrganizerReportEmail(input: {
  reportId: string;
  recipient: string;
  subject: string;
  messageBody: string;
}): Promise<OrganizerReportEmailResult> {
  const { data, error } = await supabase.functions.invoke<OrganizerReportEmailResult & { error?: string }>(
    "organizer-report-email-send",
    { body: input },
  );

  if (error) throw error;
  if (!data?.sent || !data.providerMessageId) {
    throw new Error(data?.error ?? "Report email could not be confirmed by Gmail.");
  }
  return data;
}

export async function beginNativeGmailAuthorization(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ authorizationUrl?: unknown }>("gmail-oauth-authorize", { method: "POST" });
  if (error || typeof data?.authorizationUrl !== "string" || !data.authorizationUrl.startsWith("https://accounts.google.com/")) {
    throw new Error("Gmail authorization could not be started.");
  }
  return data.authorizationUrl;
}
