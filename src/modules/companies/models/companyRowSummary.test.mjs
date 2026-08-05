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

const { resolveCompanyRowSummary } = await import(
  new URL("./companyRowSummary.ts", import.meta.url)
);

function opportunity(
  id,
  stage,
  { nextAction = null, nextActionDate = null } = {},
) {
  return {
    id,
    company_id: "company-1",
    stage,
    next_action: nextAction,
    next_action_date: nextActionDate,
  };
}

// Kritik Akış Düzeltmesi 7 — Companies list row must be fed only by
// active (non-terminal) opportunities; terminal (lost/signed) records
// must never surface their stage/next_action here.

test("no opportunities at all: Pasif Firma, 0 active, no next opportunity", () => {
  const result = resolveCompanyRowSummary([]);

  assert.equal(result.companyStatus, "Pasif Firma");
  assert.equal(result.activeOpportunities.length, 0);
  assert.equal(result.nextOpportunity, null);
});

test("only a lost opportunity: Pasif Firma, 0 active — the lost record never surfaces", () => {
  const result = resolveCompanyRowSummary([
    opportunity("lost-1", "lost", {
      nextAction: "review call outcome and complete next action",
      nextActionDate: "2026-08-01T00:00:00.000Z",
    }),
  ]);

  assert.equal(result.companyStatus, "Pasif Firma");
  assert.equal(result.activeOpportunities.length, 0);
  assert.equal(result.nextOpportunity, null);
});

test("only a signed opportunity: Pasif Firma, 0 active — signed is terminal too", () => {
  const result = resolveCompanyRowSummary([
    opportunity("signed-1", "signed"),
  ]);

  assert.equal(result.companyStatus, "Pasif Firma");
  assert.equal(result.activeOpportunities.length, 0);
  assert.equal(result.nextOpportunity, null);
});

test("one active opportunity: Potansiyel Firma, 1 active, correct stage/next action", () => {
  const active = opportunity("active-1", "contacted", {
    nextAction: "schedule follow-up call",
    nextActionDate: "2026-08-10T00:00:00.000Z",
  });

  const result = resolveCompanyRowSummary([
    active,
  ]);

  assert.equal(result.companyStatus, "Potansiyel Firma");
  assert.equal(result.activeOpportunities.length, 1);
  assert.equal(result.nextOpportunity.id, "active-1");
});

test("three active opportunities: Potansiyel Firma, 3 active, earliest next_action_date wins", () => {
  const result = resolveCompanyRowSummary([
    opportunity("later", "contacted", {
      nextActionDate: "2026-09-01T00:00:00.000Z",
    }),
    opportunity("earliest", "new", {
      nextActionDate: "2026-08-05T00:00:00.000Z",
    }),
    opportunity("middle", "interested", {
      nextActionDate: "2026-08-20T00:00:00.000Z",
    }),
  ]);

  assert.equal(result.companyStatus, "Potansiyel Firma");
  assert.equal(result.activeOpportunities.length, 3);
  assert.equal(result.nextOpportunity.id, "earliest");
});

test("an active opportunity alongside a lost one: only the active one is counted/surfaced", () => {
  const result = resolveCompanyRowSummary([
    opportunity("lost-1", "lost", {
      nextAction: "review call outcome and complete next action",
    }),
    opportunity("active-1", "contacted", {
      nextAction: "schedule follow-up call",
    }),
  ]);

  assert.equal(result.companyStatus, "Potansiyel Firma");
  assert.equal(result.activeOpportunities.length, 1);
  assert.equal(result.nextOpportunity.id, "active-1");
});

test("an active opportunity alongside a signed one: only the active one is counted/surfaced", () => {
  const result = resolveCompanyRowSummary([
    opportunity("signed-1", "signed"),
    opportunity("active-1", "new"),
  ]);

  assert.equal(result.companyStatus, "Potansiyel Firma");
  assert.equal(result.activeOpportunities.length, 1);
  assert.equal(result.nextOpportunity.id, "active-1");
});

test("an active opportunity with no next_action_date still wins over none (sorts last, but is the only one)", () => {
  const result = resolveCompanyRowSummary([
    opportunity("active-1", "new"),
  ]);

  assert.equal(result.nextOpportunity.id, "active-1");
});
