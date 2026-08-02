import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  buildLostTimelineDescription,
  buildWonTimelineDescription,
  computeLostReasonBreakdown,
  computeWonSummary,
  getLostReasonLabel,
  getLostReasonOption,
  isLostReasonId,
  LOST_REASON_OPTIONS,
} = await import(new URL("./opportunityClosure.ts", import.meta.url));

test("LOST_REASON_OPTIONS: exactly the 10 locked reasons, in the locked order", () => {
  assert.deepEqual(
    LOST_REASON_OPTIONS.map((option) => option.id),
    [
      "price-too-high",
      "chose-other-exhibition",
      "no-budget",
      "bad-timing",
      "product-not-suitable",
      "decision-postponed",
      "withdrew-participation",
      "exhibition-cancelled",
      "will-reconsider",
      "other",
    ],
  );
  assert.equal(LOST_REASON_OPTIONS.length, 10);
});

test("isLostReasonId: recognizes catalog ids, rejects anything else", () => {
  assert.equal(isLostReasonId("price-too-high"), true);
  assert.equal(isLostReasonId("other"), true);
  assert.equal(isLostReasonId("made-up-reason"), false);
});

test("getLostReasonLabel: returns the Turkish label for a known id", () => {
  assert.equal(
    getLostReasonLabel("chose-other-exhibition"),
    "Başka fuar tercih edildi",
  );
});

test("getLostReasonLabel: falls back to the raw value for an unknown id, never returns undefined for a non-empty input", () => {
  assert.equal(getLostReasonLabel("legacy-reason"), "legacy-reason");
});

test("getLostReasonLabel: undefined for no id at all", () => {
  assert.equal(getLostReasonLabel(null), undefined);
  assert.equal(getLostReasonLabel(undefined), undefined);
});

test("getLostReasonOption: 'other' is the free-text reason", () => {
  const option = getLostReasonOption("other");
  assert.equal(option.emoji, "✍️");
  assert.equal(option.label, "Diğer");
});

test("buildWonTimelineDescription: exact required wording", () => {
  assert.equal(
    buildWonTimelineDescription(),
    "Opportunity başarıyla kapatıldı.\n\nSonuç:\nKazandı.",
  );
});

test("buildLostTimelineDescription: exact required wording for a fixed reason", () => {
  const description = buildLostTimelineDescription({
    reasonId: "chose-other-exhibition",
  });

  assert.equal(
    description,
    "Opportunity kapatıldı.\n\nSonuç:\nKatılmadı.\n\nSebep:\nBaşka fuar tercih edildi",
  );
});

test("buildLostTimelineDescription: 'Diğer' with a note appends a Not: section", () => {
  const description = buildLostTimelineDescription({
    reasonId: "other",
    note: "Rakip firma ile anlaştılar.",
  });

  assert.match(description, /Sebep:\nDiğer/);
  assert.match(description, /Not:\nRakip firma ile anlaştılar\./);
});

test("buildLostTimelineDescription: a non-'other' reason never gets a Not: section even if a note is somehow passed", () => {
  const description = buildLostTimelineDescription({
    reasonId: "no-budget",
    note: "should be ignored",
  });

  assert.doesNotMatch(description, /Not:/);
});

test("buildLostTimelineDescription: 'Diğer' without a note has no Not: section", () => {
  const description = buildLostTimelineDescription({
    reasonId: "other",
    note: "   ",
  });

  assert.doesNotMatch(description, /Not:/);
});

function opportunity(overrides = {}) {
  return {
    company_id: "company-1",
    stage: "won",
    closure_reason: null,
    price_stand_area_sqm: null,
    price_currency: null,
    price_grand_total: null,
    ...overrides,
  };
}

test("computeWonSummary: counts distinct companies, sums area, groups amount by currency", () => {
  const summary = computeWonSummary([
    opportunity({
      company_id: "a",
      price_stand_area_sqm: 12,
      price_currency: "EUR",
      price_grand_total: 5000,
    }),
    opportunity({
      company_id: "a",
      price_stand_area_sqm: 8,
      price_currency: "EUR",
      price_grand_total: 3000,
    }),
    opportunity({
      company_id: "b",
      price_stand_area_sqm: 20,
      price_currency: "USD",
      price_grand_total: 9000,
    }),
    opportunity({ company_id: "c", stage: "lost" }),
    opportunity({ company_id: "d", stage: "negotiation" }),
  ]);

  assert.equal(summary.companiesWon, 2);
  assert.equal(summary.totalAreaSqm, 40);
  assert.deepEqual(summary.amountByCurrency, {
    EUR: 8000,
    USD: 9000,
  });
});

test("computeWonSummary: no won opportunities -> zeroed, empty summary", () => {
  const summary = computeWonSummary([
    opportunity({ stage: "lost" }),
    opportunity({ stage: "new" }),
  ]);

  assert.equal(summary.companiesWon, 0);
  assert.equal(summary.totalAreaSqm, 0);
  assert.deepEqual(summary.amountByCurrency, {});
});

test("computeLostReasonBreakdown: counts and sorts by frequency, most common first", () => {
  const opportunities = [
    ...Array.from({ length: 3 }, () =>
      opportunity({ stage: "lost", closure_reason: "price-too-high" }),
    ),
    ...Array.from({ length: 5 }, () =>
      opportunity({
        stage: "lost",
        closure_reason: "chose-other-exhibition",
      }),
    ),
    opportunity({ stage: "lost", closure_reason: "no-budget" }),
  ];

  const breakdown = computeLostReasonBreakdown(opportunities);

  assert.deepEqual(
    breakdown.map((entry) => entry.reasonId),
    ["chose-other-exhibition", "price-too-high", "no-budget"],
  );
  assert.deepEqual(
    breakdown.map((entry) => entry.count),
    [5, 3, 1],
  );
  assert.equal(breakdown[0].label, "Başka fuar tercih edildi");
});

test("computeLostReasonBreakdown: a lost opportunity with no recorded reason contributes nothing", () => {
  const breakdown = computeLostReasonBreakdown([
    opportunity({ stage: "lost", closure_reason: null }),
    opportunity({ stage: "won" }),
  ]);

  assert.deepEqual(breakdown, []);
});
