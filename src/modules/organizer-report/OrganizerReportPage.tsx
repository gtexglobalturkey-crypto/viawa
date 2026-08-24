import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { useAuth } from "../../features/auth/AuthContext";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { ORGANIZER_REPORT_STAGES } from "../../../supabase/functions/_shared/organizerReport";
import {
  organizerReportEmailDraft,
  organizerReportView,
  REPORT_STAGE_LABELS,
  type OrganizerReportRecord,
} from "./models/OrganizerReport";
import { checkGmailConnection, checkGmailIdentity, checkGmailUserInfo, generateOrganizerReport, listOrganizerReports, sendOrganizerReportEmail, type GmailIdentityDiagnosticCode, type GmailRefreshDiagnosticCode, type GmailUserInfoDiagnostic } from "./services/organizerReportService";

const GMAIL_DIAGNOSTIC_MESSAGES: Record<GmailRefreshDiagnosticCode, string> = {
  OAUTH_REFRESH_OK: "Gmail connection OK",
  OAUTH_INVALID_GRANT: "Refresh authorization expired",
  OAUTH_INVALID_CLIENT: "OAuth client credentials invalid",
  OAUTH_REFRESH_OTHER: "Gmail authorization error",
};
const GMAIL_IDENTITY_MESSAGES: Record<GmailIdentityDiagnosticCode, string> = {
  GMAIL_MAILBOX_LOOKUP_FAILED: "Gmail mailbox lookup failed",
  GMAIL_MAILBOX_MISMATCH: "Gmail mailbox mismatch",
  GMAIL_ALIAS_LOOKUP_FAILED: "Gmail alias lookup failed",
  GMAIL_ALIAS_NOT_FOUND: "Gmail alias not found",
  GMAIL_ALIAS_NOT_ACCEPTED: "Gmail alias not accepted",
  GMAIL_IDENTITY_ALIAS_OK: "Gmail mailbox and alias OK",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}
function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatArea(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}
function periodText(report: OrganizerReportRecord): string {
  if (report.period_label) return report.period_label;
  if (report.period_start && report.period_end) return `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`;
  if (report.period_start) return `From ${formatDate(report.period_start)}`;
  if (report.period_end) return `Through ${formatDate(report.period_end)}`;
  return "Current Status";
}

export function OrganizerReportPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const [reports, setReports] = useState<OrganizerReportRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [gmailChecking, setGmailChecking] = useState(false);
  const [gmailDiagnostic, setGmailDiagnostic] = useState<GmailRefreshDiagnosticCode | null>(null);
  const [gmailIdentityChecking, setGmailIdentityChecking] = useState(false);
  const [gmailIdentityDiagnostic, setGmailIdentityDiagnostic] = useState<GmailIdentityDiagnosticCode | null>(null);
  const [gmailUserInfoChecking, setGmailUserInfoChecking] = useState(false);
  const [gmailUserInfoDiagnostic, setGmailUserInfoDiagnostic] = useState<GmailUserInfoDiagnostic | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listOrganizerReports(id)
      .then((items) => { if (active) { setReports(items); setSelectedId(items[0]?.id ?? ""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Reports could not be loaded."); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const report = reports.find((item) => item.id === selectedId) ?? null;
  const view = report ? organizerReportView(report) : null;

  async function handleGenerate() {
    if (!id || generating) return;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      showToast("Start Date cannot be after End Date.", "error");
      return;
    }
    setGenerating(true);
    try {
      const created = await generateOrganizerReport(id, {
        periodStart: periodStart || null, periodEnd: periodEnd || null, periodLabel: periodLabel.trim() || null,
      });
      setReports((current) => [created, ...current]);
      setSelectedId(created.id);
      showToast("Organizer Report created.", "success");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Report could not be created.", "error");
    } finally { setGenerating(false); }
  }

  function openEmailReport() {
    if (!report) return;
    const draft = organizerReportEmailDraft(report);
    setEmailTo("");
    setEmailSubject(draft.subject);
    setEmailBody(draft.body);
    setEmailSending(false);
    setEmailStatus(null);
    setGmailChecking(false);
    setGmailDiagnostic(null);
    setGmailIdentityChecking(false);
    setGmailIdentityDiagnostic(null);
    setGmailUserInfoChecking(false);
    setGmailUserInfoDiagnostic(null);
    setEmailOpen(true);
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo.trim()) && Boolean(emailSubject.trim()) && Boolean(emailBody.trim());

  async function handleEmailSend() {
    if (!report || !emailValid || emailSending) return;
    setEmailSending(true);
    setEmailStatus(null);
    try {
      await sendOrganizerReportEmail({ reportId: report.report_id, recipient: emailTo, subject: emailSubject, messageBody: emailBody });
      setEmailStatus({ kind: "success", message: "Sent — Gmail accepted this report email." });
    } catch (reason) {
      setEmailStatus({ kind: "error", message: reason instanceof Error ? reason.message : "Report email could not be sent." });
    } finally {
      setEmailSending(false);
    }
  }

  async function handleGmailCheck() {
    if (gmailChecking) return;
    setGmailChecking(true);
    setGmailDiagnostic(null);
    try {
      setGmailDiagnostic(await checkGmailConnection());
    } catch {
      setGmailDiagnostic("OAUTH_REFRESH_OTHER");
    } finally {
      setGmailChecking(false);
    }
  }

  async function handleGmailIdentityCheck() {
    if (gmailIdentityChecking) return;
    setGmailIdentityChecking(true);
    setGmailIdentityDiagnostic(null);
    try { setGmailIdentityDiagnostic(await checkGmailIdentity()); }
    finally { setGmailIdentityChecking(false); }
  }

  async function handleGmailUserInfoCheck() {
    if (gmailUserInfoChecking) return;
    setGmailUserInfoChecking(true);
    setGmailUserInfoDiagnostic(null);
    try { setGmailUserInfoDiagnostic(await checkGmailUserInfo()); }
    finally { setGmailUserInfoChecking(false); }
  }

  return (
    <main className="page organizer-report-page">
      <div className="organizer-report-toolbar no-print">
        <div><p className="eyebrow">FAIR ORGANIZER REPORT</p><h1>Türkiye Market Report</h1></div>
        <div className="organizer-report-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/exhibitions/${id}/repository`)}>Repository</Button>
          <Button variant="secondary" disabled={!report} onClick={openEmailReport}>Email Report</Button>
          <Button variant="secondary" disabled={!report} onClick={() => window.print()}>PDF Download / Print</Button>
        </div>
      </div>

      <Panel className="organizer-report-controls no-print">
        <div className="organizer-report-period-fields">
          <label>Start Date<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>End Date<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
          <label>Period Label<input value={periodLabel} maxLength={120} placeholder="e.g. August 2026" onChange={(event) => setPeriodLabel(event.target.value)} /></label>
          <Button disabled={generating} onClick={() => void handleGenerate()}>{generating ? "Creating…" : "Create New Report"}</Button>
        </div>
        {reports.length > 0 && <label className="organizer-report-history">Saved Report<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{reports.map((item) => <option key={item.id} value={item.id}>{item.report_id} — {formatTimestamp(item.generated_at)}</option>)}</select></label>}
      </Panel>

      {loading && <Panel><p>Loading reports…</p></Panel>}
      {!loading && error && <Panel><p className="error-message">{error}</p></Panel>}
      {!loading && !error && !report && <Panel><p className="muted">No saved Organizer Report exists for this exhibition yet.</p></Panel>}

      {report && view && (
        <article className="organizer-report-sheet" data-report-id={report.report_id}>
          <header className="organizer-report-header">
            <div><p className="organizer-report-brand">VIAFA</p><h2>{view.exhibitionName} — Türkiye Market Report</h2></div>
            <p><span>REPORT PERIOD</span>{periodText(report)}</p>
          </header>
          <section><h3>CURRENT PIPELINE</h3><div className="organizer-report-pipeline">{ORGANIZER_REPORT_STAGES.map((stage) => <div key={stage}><span>{REPORT_STAGE_LABELS[stage]}</span><strong>{view.pipelineCounts[stage]}</strong></div>)}</div></section>
          <section className="organizer-report-commercial"><h3>COMMERCIAL STATUS</h3><p>OPEN OFFERS <strong>{formatArea(view.openOffersSqm)} m²</strong></p></section>
          <section className="organizer-report-companies">
            <h3>COMPANIES</h3>
            <table>
              <thead><tr><th>COMPANY</th><th>STAGE</th><th>OFFERED (m²)</th></tr></thead>
              <tbody>{view.companies.map((company, index) => <tr key={`${company.companyName}-${index}`}><td>{company.companyName}</td><td className={company.stage === "Teklif" ? "organizer-report-offer-stage" : ""}>{REPORT_STAGE_LABELS[company.stage]}</td><td>{company.offeredSqm === null ? "—" : formatArea(company.offeredSqm)}</td></tr>)}</tbody>
              <tfoot><tr><th colSpan={2}>TOTAL</th><td>{formatArea(view.openOffersSqm)} m²</td></tr></tfoot>
            </table>
          </section>
          <footer><strong>This report is automatically generated by VIAWA.</strong><span>Data cutoff: {formatTimestamp(report.data_cutoff)}</span><span>Generated at: {formatTimestamp(report.generated_at)}</span><span>Report ID: {report.report_id}</span></footer>
        </article>
      )}

      {emailOpen && report && (
        <div className="organizer-report-email-backdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEmailOpen(false); }}>
          <section className="organizer-report-email-dialog" role="dialog" aria-modal="true" aria-labelledby="email-report-title">
            <div className="organizer-report-email-heading"><div><p className="eyebrow">EMAIL REPORT</p><h2 id="email-report-title">Selected Saved Report</h2></div><button type="button" aria-label="Close" onClick={() => setEmailOpen(false)}>×</button></div>
            <label>To<input type="email" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} placeholder="recipient@example.com" /></label>
            <label>Subject<input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} /></label>
            <label>Message<textarea rows={7} value={emailBody} onChange={(event) => setEmailBody(event.target.value)} /></label>
            <div className="organizer-report-email-identity"><span>Report ID</span><strong>{report.report_id}</strong><span>PDF attachment</span><strong>{organizerReportEmailDraft(report).attachmentFileName}</strong></div>
            {profile?.is_active && profile.role === "admin" && <div><Button variant="secondary" disabled={gmailChecking} onClick={() => void handleGmailCheck()}>{gmailChecking ? "Checking…" : "Check Gmail Connection"}</Button>{gmailDiagnostic && <p className="organizer-report-email-pending" role="status">{GMAIL_DIAGNOSTIC_MESSAGES[gmailDiagnostic]} <small>{gmailDiagnostic}</small></p>}<Button variant="secondary" disabled={gmailIdentityChecking} onClick={() => void handleGmailIdentityCheck()}>{gmailIdentityChecking ? "Checking…" : "Check Gmail Identity"}</Button>{gmailIdentityDiagnostic && <p className="organizer-report-email-pending" role="status">{GMAIL_IDENTITY_MESSAGES[gmailIdentityDiagnostic]} <small>{gmailIdentityDiagnostic}</small></p>}<Button variant="secondary" disabled={gmailUserInfoChecking} onClick={() => void handleGmailUserInfoCheck()}>{gmailUserInfoChecking ? "Checking…" : "Check Gmail UserInfo"}</Button>{gmailUserInfoDiagnostic && <p className="organizer-report-email-pending" role="status"><small>{gmailUserInfoDiagnostic.userinfoResult} · openid: {String(gmailUserInfoDiagnostic.grantedOpenId)} · email: {String(gmailUserInfoDiagnostic.grantedEmail)}</small></p>}</div>}
            {emailStatus && <p className={`organizer-report-email-pending ${emailStatus.kind === "error" ? "error-message" : ""}`} role="status">{emailStatus.message}</p>}
            <div className="organizer-report-email-actions"><Button variant="secondary" disabled={emailSending} onClick={() => setEmailOpen(false)}>Cancel</Button><Button disabled={!emailValid || emailSending || emailStatus?.kind === "success"} onClick={() => void handleEmailSend()}>{emailSending ? "Sending…" : emailStatus?.kind === "success" ? "Sent" : "Send"}</Button></div>
          </section>
        </div>
      )}
    </main>
  );
}
