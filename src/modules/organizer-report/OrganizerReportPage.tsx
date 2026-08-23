import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { ORGANIZER_REPORT_STAGES } from "../../../supabase/functions/_shared/organizerReport";

import type { OrganizerReportRecord } from "./models/OrganizerReport";
import {
  generateOrganizerReport,
  listOrganizerReports,
} from "./services/organizerReportService";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function periodText(report: OrganizerReportRecord): string {
  if (report.period_label) return report.period_label;
  if (report.period_start && report.period_end) {
    return `${formatDate(report.period_start)} - ${formatDate(report.period_end)}`;
  }
  if (report.period_start) return `${formatDate(report.period_start)} itibarıyla`;
  if (report.period_end) return `${formatDate(report.period_end)} tarihine kadar`;
  return "Güncel durum";
}

export function OrganizerReportPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reports, setReports] = useState<OrganizerReportRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listOrganizerReports(id)
      .then((items) => {
        if (!active) return;
        setReports(items);
        setSelectedId(items[0]?.id ?? "");
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Raporlar yüklenemedi.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  const report = reports.find((item) => item.id === selectedId) ?? null;

  async function handleGenerate() {
    if (!id || generating) return;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      showToast("Başlangıç tarihi bitiş tarihinden sonra olamaz.", "error");
      return;
    }
    setGenerating(true);
    try {
      const created = await generateOrganizerReport(id, {
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        periodLabel: periodLabel.trim() || null,
      });
      setReports((current) => [created, ...current]);
      setSelectedId(created.id);
      showToast("Organizer Report oluşturuldu.", "success");
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : "Rapor oluşturulamadı.", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="page organizer-report-page">
      <div className="organizer-report-toolbar no-print">
        <div>
          <p className="eyebrow">Fuar Organizer Report</p>
          <h1>Türkiye Market Report</h1>
        </div>
        <div className="organizer-report-toolbar-actions">
          <Button variant="secondary" onClick={() => navigate(`/exhibitions/${id}/repository`)}>
            Repository'ye Dön
          </Button>
          <Button variant="secondary" disabled={!report} onClick={() => window.print()}>
            PDF İndir / Yazdır
          </Button>
        </div>
      </div>

      <Panel className="organizer-report-controls no-print">
        <div className="organizer-report-period-fields">
          <label>Başlangıç<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
          <label>Bitiş<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
          <label>Dönem etiketi<input value={periodLabel} maxLength={120} placeholder="Örn. Ağustos 2026" onChange={(event) => setPeriodLabel(event.target.value)} /></label>
          <Button disabled={generating} onClick={() => void handleGenerate()}>
            {generating ? "Oluşturuluyor..." : "Yeni Rapor Oluştur"}
          </Button>
        </div>
        {reports.length > 0 && (
          <label className="organizer-report-history">
            Kayıtlı rapor
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {reports.map((item) => (
                <option key={item.id} value={item.id}>{item.report_id} - {formatTimestamp(item.generated_at)}</option>
              ))}
            </select>
          </label>
        )}
      </Panel>

      {loading && <Panel><p>Raporlar yükleniyor...</p></Panel>}
      {!loading && error && <Panel><p className="error-message">{error}</p></Panel>}
      {!loading && !error && !report && (
        <Panel><p className="muted">Bu fuar için henüz kaydedilmiş bir Organizer Report bulunmuyor.</p></Panel>
      )}

      {report && (
        <article className="organizer-report-sheet" data-report-id={report.report_id}>
          <header className="organizer-report-header">
            <div>
              <p className="organizer-report-brand">VIAFA</p>
              <h2>{report.snapshot.exhibitionName} — Türkiye Market Report</h2>
            </div>
            <p><span>Rapor dönemi</span>{periodText(report)}</p>
          </header>

          <section>
            <h3>Commercial Pipeline</h3>
            <div className="organizer-report-pipeline">
              {ORGANIZER_REPORT_STAGES.map((stage) => (
                <div key={stage}><span>{stage}</span><strong>{report.snapshot.pipelineCounts[stage]}</strong></div>
              ))}
            </div>
          </section>

          <section className="organizer-report-commercial">
            <h3>Commercial Status</h3>
            <p>Potansiyel Alan: <strong>{new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(report.snapshot.potentialSqm)} m²</strong></p>
          </section>

          <section className="organizer-report-companies">
            <h3>Companies</h3>
            <table>
              <thead><tr><th>Company</th><th>Stage</th></tr></thead>
              <tbody>
                {report.snapshot.companies.map((company, index) => (
                  <tr key={`${company.companyName}-${index}`}><td>{company.companyName}</td><td>{company.stage}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="organizer-report-note">{report.snapshot.periodNote}</p>
          <footer>
            <strong>VIAWA tarafından otomatik oluşturuldu</strong>
            <span>Data cutoff: {formatTimestamp(report.data_cutoff)}</span>
            <span>Generated at: {formatTimestamp(report.generated_at)}</span>
            <span>Report ID: {report.report_id}</span>
          </footer>
        </article>
      )}
    </main>
  );
}
