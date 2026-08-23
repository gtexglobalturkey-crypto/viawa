import assert from "node:assert/strict";
import test from "node:test";

const model = await import(new URL("./OrganizerReport.ts", import.meta.url));

const record = (schema_version, snapshot) => ({
  id: "row-1", report_id: "VIAWA-OR-1", exhibition_id: "fair-1",
  period_start: "2026-08-01", period_end: "2026-08-31", period_label: "August 2026",
  data_cutoff: "2026-08-31T23:59:59Z", generated_at: "2026-09-01T00:00:00Z",
  schema_version, snapshot, created_at: "2026-09-01T00:00:00Z",
});
const counts = { Yeni: 1, Bilgilendirme: 2, Teklif: 1, Sözleşme: 0 };

test("schema V2 renders only its immutable snapshot values", () => {
  const view = model.organizerReportView(record(2, {
    exhibitionName: "Fair", pipelineCounts: counts, openOffersSqm: 24,
    companies: [{ companyName: "Alpha", stage: "Teklif", offeredSqm: 24 }],
  }));
  assert.equal(view.openOffersSqm, 24);
  assert.equal(view.companies[0].offeredSqm, 24);
});

test("legacy V1 stays readable without enriching company rows from live CRM", () => {
  const view = model.organizerReportView(record(1, {
    exhibitionName: "Fair", pipelineCounts: counts, potentialSqm: 18,
    companies: [{ companyName: "Legacy", stage: "Teklif" }], periodNote: "Historical note",
  }));
  assert.equal(view.openOffersSqm, 18);
  assert.equal(view.companies[0].offeredSqm, null);
  assert.equal(JSON.stringify(view).includes("Historical note"), false);
});

test("email identity and defaults come from the selected immutable report", () => {
  const draft = model.organizerReportEmailDraft(record(2, {
    exhibitionName: "WAMPEX 2027", pipelineCounts: counts, openOffersSqm: 10, companies: [],
  }));
  assert.equal(draft.reportId, "VIAWA-OR-1");
  assert.equal(draft.attachmentFileName, "VIAWA-OR-1.pdf");
  assert.equal(draft.subject, "WAMPEX 2027 — Türkiye Market Report | August 2026");
  assert.match(draft.body, /WAMPEX 2027/);
  assert.doesNotMatch(JSON.stringify(draft), /contact|phone|emailAddress/i);
});
