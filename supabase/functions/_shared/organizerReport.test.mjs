import assert from "node:assert/strict";
import test from "node:test";

const report = await import(new URL("./organizerReport.ts", import.meta.url));

const opportunity = (id, company_id, stage, updated_at = "2026-08-01T00:00:00Z", exhibition_id = "fair-1") => ({
  id, company_id, stage, updated_at, exhibition_id,
});
const company = (id, company_name = id) => ({ id, company_name });
const price = (opportunity_id, standAreaSqm, approved_at = "2026-08-01T00:00:00Z", created_at = approved_at) => ({
  opportunity_id, approved_at, created_at, price_input: { standAreaSqm },
});
test("uses the exact locked mapping and excludes terminal or unknown stages", () => {
  const mapping = {
    new: "Yeni", contacted: "Yeni", interested: "Yeni",
    "information-sent": "Bilgilendirme",
    "quotation-ready": "Teklif", "proposal-ready": "Teklif",
    "quotation-sent": "Sözleşme", negotiation: "Sözleşme", contract: "Sözleşme",
  };
  for (const [stage, expected] of Object.entries(mapping)) {
    assert.equal(report.canonicalReportStage(stage), expected);
  }
  for (const stage of ["signed", "won", "lost", "unexpected"]) {
    assert.equal(report.canonicalReportStage(stage), null);
  }
});

test("deduplicates by company using stage, updated_at, then stable id", () => {
  const selected = report.selectRepresentativeOpportunities([
    opportunity("z", "a", "new", "2026-08-03T00:00:00Z"),
    opportunity("y", "a", "proposal-ready", "2026-08-01T00:00:00Z"),
    opportunity("z2", "b", "contacted", "2026-08-01T00:00:00Z"),
    opportunity("y2", "b", "interested", "2026-08-02T00:00:00Z"),
    opportunity("z3", "c", "new", "2026-08-01T00:00:00Z"),
    opportunity("a3", "c", "new", "2026-08-01T00:00:00Z"),
    opportunity("other", "d", "contract", "2026-08-01T00:00:00Z", "fair-2"),
    opportunity("missing", "e", "contract", "2026-08-01T00:00:00Z", null),
  ], "fair-1");
  assert.deepEqual(selected.map((item) => item.id).sort(), ["a3", "y", "y2"]);
  assert.equal(new Set(selected.map((item) => item.company_id)).size, selected.length);
});

test("uses only the latest approved snapshot revision and never cached opportunity area", () => {
  const built = report.buildOrganizerReportSnapshot({
    exhibitionId: "fair-1",
    exhibitionName: "Fair",
    opportunities: [
      { ...opportunity("offer", "a", "proposal-ready"), price_stand_area_sqm: 999 },
      opportunity("new", "b", "new"),
    ],
    companies: [company("a", "Alpha"), company("b", "Beta")],
    approvedSnapshots: [
      price("offer", 100, "2026-08-01T00:00:00Z"),
      price("offer", 36, "2026-08-02T00:00:00Z"),
    ],
  });
  assert.equal(built.openOffersSqm, 36);
  assert.equal(built.companies.find((item) => item.companyName === "Alpha").offeredSqm, 36);
  assert.equal(built.companies.find((item) => item.companyName === "Beta").offeredSqm, null);
  assert.equal(Object.values(built.pipelineCounts).reduce((a, b) => a + b, 0), built.companies.length);
  assert.deepEqual(Object.keys(built.companies[0]).sort(), ["companyName", "offeredSqm", "stage"]);
  assert.equal(JSON.stringify(built).includes("price_stand_area_sqm"), false);
});

test("latest snapshot tie breaks on created_at", () => {
  const latest = report.selectLatestSnapshot([
    price("offer", 10, "2026-08-01T00:00:00Z", "2026-08-01T01:00:00Z"),
    price("offer", 12, "2026-08-01T00:00:00Z", "2026-08-01T02:00:00Z"),
  ]);
  assert.equal(latest.price_input.standAreaSqm, 12);
});

test("open offers exclude contract and terminal stages", () => {
  const built = report.buildOrganizerReportSnapshot({
    exhibitionId: "fair-1",
    exhibitionName: "Fair",
    opportunities: [
      opportunity("offer", "a", "quotation-ready"),
      opportunity("contract", "b", "contract"),
      opportunity("signed", "c", "signed"),
      opportunity("won", "d", "won"),
      opportunity("lost", "e", "lost"),
    ],
    companies: [company("a"), company("b"), company("c"), company("d"), company("e")],
    approvedSnapshots: [price("offer", 15), price("contract", 50), price("signed", 60), price("won", 70), price("lost", 80)],
  });
  assert.equal(built.openOffersSqm, 15);
  assert.equal(built.companies.find((item) => item.companyName === "b").offeredSqm, null);
  assert.equal(built.companies.some((item) => ["c", "d", "e"].includes(item.companyName)), false);
});

test("rejects missing, zero, negative, nonnumeric, or invalid latest offer area", () => {
  for (const snapshots of [[], [price("offer", 0)], [price("offer", -2)], [price("offer", "20")], [price("offer", Number.NaN)]]) {
    assert.throws(() => report.buildOrganizerReportSnapshot({
      exhibitionId: "fair-1",
      exhibitionName: "Fair",
      opportunities: [opportunity("offer", "a", "quotation-ready")],
      companies: [company("a")],
      approvedSnapshots: snapshots,
    }), /valid approved area/);
  }
});
