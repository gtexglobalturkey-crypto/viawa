// pdfmake's bundled Roboto VFS keeps Unicode exhibition/company names inside the
// generated artifact without a runtime font download.
// @ts-ignore Remote Edge dependency.
import pdfMake from "https://esm.sh/pdfmake@0.2.20/build/pdfmake.js";
// @ts-ignore Remote Edge dependency.
import pdfFonts from "https://esm.sh/pdfmake@0.2.20/build/vfs_fonts.js";

type ReportRow = {
  report_id: string;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  data_cutoff: string;
  generated_at: string;
  schema_version: number;
  snapshot: Record<string, unknown>;
};

const STAGES = ["Yeni", "Bilgilendirme", "Teklif", "Sözleşme"] as const;
const LABELS: Record<(typeof STAGES)[number], string> = {
  Yeni: "NEW",
  Bilgilendirme: "INFORMATION",
  Teklif: "OFFER",
  Sözleşme: "CONTRACT",
};

function date(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
function timestamp(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(value));
}
function area(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
}
function period(report: ReportRow): string {
  if (report.period_label) return report.period_label;
  if (report.period_start && report.period_end) return `${date(report.period_start)} – ${date(report.period_end)}`;
  if (report.period_start) return `From ${date(report.period_start)}`;
  if (report.period_end) return `Through ${date(report.period_end)}`;
  return "Current Status";
}

export function organizerReportPdfModel(report: ReportRow) {
  const snapshot = report.snapshot;
  const pipelineCounts = snapshot.pipelineCounts as Record<string, number>;
  const legacy = report.schema_version < 2 || !("openOffersSqm" in snapshot);
  const openOffersSqm = Number(legacy ? snapshot.potentialSqm : snapshot.openOffersSqm);
  const companies = (snapshot.companies as Array<Record<string, unknown>>).map((company) => ({
    companyName: String(company.companyName),
    stage: String(company.stage),
    offeredSqm: legacy || typeof company.offeredSqm !== "number" ? null : company.offeredSqm,
  }));
  if (!Number.isFinite(openOffersSqm) || openOffersSqm < 0) throw new Error("Stored report open-offer data is invalid.");
  return {
    reportId: report.report_id,
    exhibitionName: String(snapshot.exhibitionName),
    reportPeriod: period(report),
    pipelineCounts,
    openOffersSqm,
    companies,
    dataCutoff: timestamp(report.data_cutoff),
    generatedAt: timestamp(report.generated_at),
  };
}

export async function generateOrganizerReportPdf(report: ReportRow): Promise<Uint8Array> {
  const model = organizerReportPdfModel(report);
  // @ts-ignore pdfmake browser bundle VFS assignment.
  pdfMake.vfs = (pdfFonts as { pdfMake?: { vfs?: unknown } }).pdfMake?.vfs ?? pdfFonts;
  const burgundy = "#9b1c31";
  const anthracite = "#1a1b1f";
  const pipelineBody = [STAGES.map((stage) => ({ text: LABELS[stage], style: "smallHeader" })), STAGES.map((stage) => ({ text: String(model.pipelineCounts[stage] ?? 0), style: "pipelineValue" }))];
  const companyBody: unknown[][] = [
    ["COMPANY", "STAGE", "OFFERED (m²)"].map((text) => ({ text, style: "tableHeader" })),
    ...model.companies.map((company) => [
      company.companyName,
      { text: LABELS[company.stage as keyof typeof LABELS] ?? company.stage, color: company.stage === "Teklif" ? burgundy : anthracite, bold: company.stage === "Teklif" },
      { text: company.offeredSqm === null ? "—" : area(company.offeredSqm), alignment: "right" },
    ]),
    [{ text: "TOTAL", colSpan: 2, bold: true }, {}, { text: `${area(model.openOffersSqm)} m²`, alignment: "right", bold: true, color: burgundy }],
  ];
  const definition = {
    pageSize: "A4",
    pageMargins: [48, 50, 48, 46],
    defaultStyle: { font: "Roboto", fontSize: 9, color: anthracite },
    content: [
      { text: "VIAFA", color: burgundy, bold: true, characterSpacing: 2, fontSize: 11 },
      { columns: [[{ text: `${model.exhibitionName} — Türkiye Market Report`, style: "title" }], [{ text: "REPORT PERIOD", style: "metadataLabel", alignment: "right" }, { text: model.reportPeriod, alignment: "right" }]], margin: [0, 4, 0, 12] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 499, y2: 0, lineWidth: 2, lineColor: burgundy }] },
      { text: "CURRENT PIPELINE", style: "section" },
      { table: { widths: ["*", "*", "*", "*"], body: pipelineBody }, layout: "lightHorizontalLines" },
      { text: "COMMERCIAL STATUS", style: "section" },
      { columns: [{ text: "OPEN OFFERS", bold: true }, { text: `${area(model.openOffersSqm)} m²`, alignment: "right", bold: true, color: burgundy, fontSize: 14 }], fillColor: "#f6f6f5", margin: [8, 8, 8, 8] },
      { text: "COMPANIES", style: "section" },
      { table: { headerRows: 1, widths: ["*", 90, 90], body: companyBody }, layout: "lightHorizontalLines" },
    ],
    footer: () => ({
      margin: [48, 8, 48, 0],
      columns: [
        [{ text: "This report is automatically generated by VIAWA.", bold: true }, { text: `Generated at: ${model.generatedAt}` }],
        [{ text: `Data cutoff: ${model.dataCutoff}`, alignment: "right" }, { text: `Report ID: ${model.reportId}`, alignment: "right" }],
      ],
      fontSize: 7,
      color: "#6b6d74",
    }),
    styles: {
      title: { fontSize: 17, bold: true },
      section: { fontSize: 10, bold: true, margin: [0, 16, 0, 7], characterSpacing: 0.8 },
      metadataLabel: { fontSize: 7, bold: true, color: "#6b6d74" },
      smallHeader: { fontSize: 8, bold: true, color: "#6b6d74" },
      pipelineValue: { fontSize: 18, bold: true, color: burgundy, margin: [0, 4, 0, 2] },
      tableHeader: { fontSize: 7, bold: true },
    },
  };
  return await new Promise<Uint8Array>((resolve, reject) => {
    try {
      // @ts-ignore pdfmake callback API.
      pdfMake.createPdf(definition).getBuffer((buffer: Uint8Array) => resolve(new Uint8Array(buffer)));
    } catch (error) {
      reject(error);
    }
  });
}
