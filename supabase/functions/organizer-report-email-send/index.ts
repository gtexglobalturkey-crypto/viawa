import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGmailMime, isValidEmailAddress, normalizeRecipient, providerFailureStatus, sendOperationKey } from "../_shared/organizerReportEmail.ts";
import { generateOrganizerReportPdf } from "../_shared/organizerReportPdf.ts";
import { refreshGmailAccessToken } from "../_shared/gmailRefresh.ts";
import { verifyGmailIdentityAlias } from "../_shared/gmailIdentity.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("PROVIDER_NOT_CONFIGURED");
  return value;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let admin: ReturnType<typeof createClient> | null = null;
  let evidenceId: string | null = null;
  const finalize = async (status: "failed" | "unknown", errorCode: string) => {
    if (admin && evidenceId) {
      await admin.from("organizer_report_email_sends").update({ status, last_error_code: errorCode }).eq("id", evidenceId).eq("status", "pending");
    }
  };

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized request." }, 401);
    admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !authData.user) return json({ error: "The session could not be verified." }, 401);
    const { data: member } = await admin.from("application_users").select("id,is_active").eq("id", authData.user.id).maybeSingle();
    if (!member?.is_active) return json({ error: "Active VIAWA access is required." }, 403);

    const body = await request.json() as Record<string, unknown>;
    const allowedKeys = new Set(["reportId", "recipient", "subject", "messageBody"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) return json({ error: "The email request contains unsupported fields." }, 400);
    const reportId = typeof body.reportId === "string" ? body.reportId.trim() : "";
    const recipient = typeof body.recipient === "string" ? normalizeRecipient(body.recipient) : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const messageBody = typeof body.messageBody === "string" ? body.messageBody : "";
    if (!reportId || reportId.length > 160 || !isValidEmailAddress(recipient) || !subject || subject.length > 300 || !messageBody.trim() || messageBody.length > 20_000) {
      return json({ error: "Recipient, subject, or message is invalid." }, 400);
    }

    const { data: report, error: reportError } = await admin
      .from("organizer_report_snapshots")
      .select("id,report_id,exhibition_id,period_start,period_end,period_label,data_cutoff,generated_at,schema_version,snapshot,created_at")
      .eq("report_id", reportId)
      .maybeSingle();
    if (reportError) throw new Error("REPORT_LOAD_FAILED");
    if (!report) return json({ error: "The selected immutable report was not found." }, 404);

    const senderAlias = required("GMAIL_SENDER_ALIAS");
    const operationKey = await sendOperationKey({ reportId, recipient, subject, messageBody });
    const { data: created, error: createError } = await admin.from("organizer_report_email_sends").insert({
      organizer_report_snapshot_id: report.id,
      organizer_report_id: report.report_id,
      recipient,
      sender_alias: senderAlias,
      status: "pending",
      send_operation_key: operationKey,
      created_by: authData.user.id,
    }).select("id,status,provider_message_id,provider_accepted_at,attempt_count").single();

    let evidence = created;
    if (createError?.code === "23505") {
      const { data: existing } = await admin.from("organizer_report_email_sends")
        .select("id,status,provider_message_id,provider_accepted_at,attempt_count")
        .eq("send_operation_key", operationKey).maybeSingle();
      if (!existing) throw new Error("EVIDENCE_RESERVATION_FAILED");
      if (existing.status === "accepted" && existing.provider_message_id) {
        return json({ sent: true, duplicate: true, provider: "gmail", providerMessageId: existing.provider_message_id, acceptedAt: existing.provider_accepted_at });
      }
      if (existing.status === "pending" || existing.status === "unknown") {
        return json({ error: "This send is already in progress or has an unknown provider result. Do not retry automatically." }, 409);
      }
      const { data: retried } = await admin.from("organizer_report_email_sends")
        .update({ status: "pending", attempt_count: existing.attempt_count + 1, last_error_code: null })
        .eq("id", existing.id).eq("status", "failed")
        .select("id,status,provider_message_id,provider_accepted_at,attempt_count").maybeSingle();
      if (!retried) return json({ error: "This send is already being retried." }, 409);
      evidence = retried;
    } else if (createError || !created) {
      throw new Error("EVIDENCE_RESERVATION_FAILED");
    }
    evidenceId = evidence.id;

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateOrganizerReportPdf(report);
      if (pdfBytes.length < 5 || new TextDecoder().decode(pdfBytes.subarray(0, 5)) !== "%PDF-") throw new Error("invalid PDF");
    } catch {
      await finalize("failed", "PDF_GENERATION_FAILED");
      return json({ error: "The immutable report PDF could not be generated." }, 422);
    }

    const clientId = required("GMAIL_OAUTH_CLIENT_ID");
    const clientSecret = required("GMAIL_OAUTH_CLIENT_SECRET");
    const refreshToken = required("GMAIL_OAUTH_REFRESH_TOKEN");
    const owningMailbox = required("GMAIL_OWNING_MAILBOX");
    const tokenResult = await refreshGmailAccessToken({ clientId, clientSecret, refreshToken });
    if (!tokenResult.ok) {
      await finalize("failed", tokenResult.code);
      return json({ error: "Gmail authorization is unavailable or revoked." }, 503);
    }
    const identityResult = await verifyGmailIdentityAlias({ accessToken: tokenResult.accessToken, owningMailbox, senderAlias });
    if (identityResult !== "GMAIL_IDENTITY_ALIAS_OK") {
      await finalize("failed", identityResult);
      return json({ error: "The configured Gmail mailbox or VIAFA sender alias is unavailable." }, 409);
    }

    const gmailHeaders = { Authorization: `Bearer ${tokenResult.accessToken}` };
    const raw = buildGmailMime({ recipient, subject, messageBody, senderAlias, reportId: report.report_id, pdfBytes });
    let gmailResponse: Response;
    try {
      gmailResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { ...gmailHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });
    } catch {
      await finalize("unknown", "GMAIL_TRANSPORT_UNKNOWN");
      return json({ error: "Gmail delivery result is unknown. Do not retry automatically." }, 503);
    }
    const gmailResult = await gmailResponse.json() as Record<string, unknown>;
    if (!gmailResponse.ok || typeof gmailResult.id !== "string" || !gmailResult.id) {
      const finalStatus = providerFailureStatus(gmailResponse.status);
      await finalize(finalStatus, finalStatus === "unknown" ? "GMAIL_PROVIDER_UNKNOWN" : "GMAIL_PROVIDER_REJECTED");
      return json({ error: finalStatus === "unknown" ? "Gmail delivery result is unknown. Do not retry automatically." : "Gmail rejected the message." }, gmailResponse.status >= 500 ? 503 : 422);
    }

    const acceptedAt = new Date().toISOString();
    const { data: finalized, error: finalizeError } = await admin.from("organizer_report_email_sends").update({
      status: "accepted",
      provider_message_id: gmailResult.id,
      provider_accepted_at: acceptedAt,
      last_error_code: null,
    }).eq("id", evidenceId).eq("status", "pending").select("provider_message_id,provider_accepted_at").maybeSingle();
    if (finalizeError || !finalized) {
      await finalize("unknown", "EVIDENCE_FINALIZATION_FAILED");
      return json({ error: "Gmail accepted the message, but evidence finalization failed. Do not retry." }, 503);
    }
    return json({ sent: true, duplicate: false, provider: "gmail", providerMessageId: finalized.provider_message_id, acceptedAt: finalized.provider_accepted_at });
  } catch (error) {
    await finalize(evidenceId ? "unknown" : "failed", "SEND_FAILED");
    return json({ error: error instanceof Error && error.message === "PROVIDER_NOT_CONFIGURED" ? "Gmail delivery is not configured." : "The report email could not be sent safely." }, 503);
  }
});
