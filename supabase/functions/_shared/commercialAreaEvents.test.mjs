import assert from "node:assert/strict";
import test from "node:test";

const ledger = await import(new URL("./commercialAreaEvents.ts", import.meta.url));

const event = (overrides = {}) => ({
  eventType: "offer_issued",
  exhibitionId: "fair-1",
  areaSqm: 20,
  occurredAt: "2026-08-10T12:00:00.000Z",
  eventOperationKey: "operation-1",
  ...overrides,
});

const opportunity = (id, company_id, stage, updated_at = "2026-08-01T00:00:00Z") => ({
  id,
  company_id,
  exhibition_id: "fair-1",
  stage,
  updated_at,
});

const snapshot = (opportunity_id, standAreaSqm, approved_at = "2026-08-01T00:00:00Z") => ({
  opportunity_id,
  approved_at,
  created_at: approved_at,
  price_input: { standAreaSqm },
});

test("accepts only the two authoritative event types", () => {
  assert.equal(ledger.isCommercialAreaEventType("offer_issued"), true);
  assert.equal(ledger.isCommercialAreaEventType("contract_completed"), true);
  assert.equal(ledger.isCommercialAreaEventType("quote_created"), false);
});

test("period totals use occurred_at with an inclusive start and exclusive end", () => {
  const events = [
    event({ occurredAt: "2026-08-01T00:00:00.000Z", eventOperationKey: "start" }),
    event({ occurredAt: "2026-09-01T00:00:00.000Z", eventOperationKey: "end" }),
    event({ exhibitionId: "fair-2", eventOperationKey: "other-fair", areaSqm: 99 }),
    event({ eventType: "contract_completed", eventOperationKey: "contract", areaSqm: 30 }),
  ];
  assert.equal(ledger.sumPeriodCommercialArea({
    events,
    exhibitionId: "fair-1",
    eventType: "offer_issued",
    periodStartInclusive: "2026-08-01T00:00:00.000Z",
    periodEndExclusive: "2026-09-01T00:00:00.000Z",
  }), 20);
});

test("period totals are idempotent by operation key", () => {
  assert.equal(ledger.sumPeriodCommercialArea({
    events: [event(), event({ areaSqm: 20 })],
    exhibitionId: "fair-1",
    eventType: "offer_issued",
    periodStartInclusive: "2026-08-01T00:00:00.000Z",
    periodEndExclusive: "2026-09-01T00:00:00.000Z",
  }), 20);
});

test("cumulative contracts include only completed events before cutoff", () => {
  assert.equal(ledger.sumTotalContractArea({
    events: [
      event({ eventType: "contract_completed", eventOperationKey: "c1", areaSqm: 12 }),
      event({ eventType: "contract_completed", eventOperationKey: "c2", areaSqm: 8, occurredAt: "2026-09-01T00:00:00.000Z" }),
      event({ eventOperationKey: "offer", areaSqm: 100 }),
    ],
    exhibitionId: "fair-1",
    dataCutoffExclusive: "2026-09-01T00:00:00.000Z",
  }), 12);
});

test("current open offers use representative opportunity state and latest approved snapshot", () => {
  const opportunities = [
    opportunity("old", "company-1", "quotation-ready", "2026-08-01T00:00:00Z"),
    opportunity("current", "company-1", "proposal-ready", "2026-08-02T00:00:00Z"),
    opportunity("contract", "company-2", "contract"),
  ];
  assert.equal(ledger.calculateCurrentOpenOfferArea({
    exhibitionId: "fair-1",
    opportunities,
    approvedSnapshots: [snapshot("old", 99), snapshot("current", 10), snapshot("current", 14, "2026-08-03T00:00:00Z"), snapshot("contract", 50)],
  }), 14);
});

test("current open offers reject a missing or invalid approved area", () => {
  for (const approvedSnapshots of [[], [snapshot("offer", 0)], [snapshot("offer", "25")]]) {
    assert.throws(() => ledger.calculateCurrentOpenOfferArea({
      exhibitionId: "fair-1",
      opportunities: [opportunity("offer", "company-1", "quotation-ready")],
      approvedSnapshots,
    }), /valid approved area/);
  }
});

test("total pipeline is current open offers plus cumulative contracts", () => {
  assert.equal(ledger.calculateTotalSalesPipeline(40, 15), 55);
  assert.throws(() => ledger.calculateTotalSalesPipeline(-1, 15), /invalid/);
});
