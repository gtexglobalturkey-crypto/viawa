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

export type GmailRefreshDiagnosticCode =
  | "OAUTH_REFRESH_OK"
  | "OAUTH_INVALID_GRANT"
  | "OAUTH_INVALID_CLIENT"
  | "OAUTH_REFRESH_OTHER";

function isGmailRefreshDiagnosticCode(value: unknown): value is GmailRefreshDiagnosticCode {
  return value === "OAUTH_REFRESH_OK" || value === "OAUTH_INVALID_GRANT" || value === "OAUTH_INVALID_CLIENT" || value === "OAUTH_REFRESH_OTHER";
}

export async function checkGmailConnection(): Promise<GmailRefreshDiagnosticCode> {
  const { data, error } = await supabase.functions.invoke<{ result?: unknown }>("gmail-refresh-verify", { body: {} });
  if (isGmailRefreshDiagnosticCode(data?.result)) return data.result;
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const failure = await response.json() as { result?: unknown };
      if (isGmailRefreshDiagnosticCode(failure.result)) return failure.result;
    } catch {
      // Only the allow-listed result is surfaced; malformed bodies are discarded.
    }
  }
  throw new Error("Gmail authorization error");
}

export type GmailIdentityDiagnosticCode =
  | "GMAIL_MAILBOX_LOOKUP_FAILED"
  | "GMAIL_MAILBOX_MISMATCH"
  | "GMAIL_ALIAS_LOOKUP_FAILED"
  | "GMAIL_ALIAS_NOT_FOUND"
  | "GMAIL_ALIAS_NOT_ACCEPTED"
  | "GMAIL_IDENTITY_ALIAS_OK";

const GMAIL_IDENTITY_CODES = new Set<GmailIdentityDiagnosticCode>([
  "GMAIL_MAILBOX_LOOKUP_FAILED", "GMAIL_MAILBOX_MISMATCH", "GMAIL_ALIAS_LOOKUP_FAILED",
  "GMAIL_ALIAS_NOT_FOUND", "GMAIL_ALIAS_NOT_ACCEPTED", "GMAIL_IDENTITY_ALIAS_OK",
]);

export async function checkGmailIdentity(): Promise<GmailIdentityDiagnosticCode> {
  const { data, error } = await supabase.functions.invoke<{ result?: unknown }>("gmail-identity-verify", { body: {} });
  if (typeof data?.result === "string" && GMAIL_IDENTITY_CODES.has(data.result as GmailIdentityDiagnosticCode)) return data.result as GmailIdentityDiagnosticCode;
  const response = (error as { context?: Response } | null)?.context;
  if (response) {
    try {
      const failure = await response.json() as { result?: unknown };
      if (typeof failure.result === "string" && GMAIL_IDENTITY_CODES.has(failure.result as GmailIdentityDiagnosticCode)) return failure.result as GmailIdentityDiagnosticCode;
    } catch { /* raw responses are discarded */ }
  }
  return "GMAIL_MAILBOX_LOOKUP_FAILED";
}

export type GmailUserInfoDiagnostic = {
  userinfoResult: "USERINFO_HTTP_401" | "USERINFO_HTTP_403" | "USERINFO_HTTP_OTHER" | "USERINFO_MALFORMED_RESPONSE" | "USERINFO_EMAIL_MISSING" | "USERINFO_EMAIL_OK";
  grantedOpenId: boolean;
  grantedEmail: boolean;
};

const USERINFO_CODES = new Set(["USERINFO_HTTP_401", "USERINFO_HTTP_403", "USERINFO_HTTP_OTHER", "USERINFO_MALFORMED_RESPONSE", "USERINFO_EMAIL_MISSING", "USERINFO_EMAIL_OK"]);

export async function checkGmailUserInfo(): Promise<GmailUserInfoDiagnostic> {
  const { data } = await supabase.functions.invoke<Partial<GmailUserInfoDiagnostic>>("gmail-userinfo-verify", { body: {} });
  if (!data || !USERINFO_CODES.has(data.userinfoResult ?? "") || typeof data.grantedOpenId !== "boolean" || typeof data.grantedEmail !== "boolean") {
    return { userinfoResult: "USERINFO_HTTP_OTHER", grantedOpenId: false, grantedEmail: false };
  }
  return data as GmailUserInfoDiagnostic;
}
