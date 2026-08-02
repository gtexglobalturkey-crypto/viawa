import assert from "node:assert/strict";
import test from "node:test";

const { createReadinessChecker } = await import("../src/readiness/readinessChecks.ts");
import { environment } from "./testHttp.mjs";

const populated = { issuer: { taxNumber: "hidden" }, bank: { ibanUsd: "hidden" } };
const demo = {
  issuer: { companyName: "EXPOVIA (Demo)", status: "DEMO_CONFIGURATION", address: "TO_BE_DEFINED" },
  bank: { accountHolder: "EXPOVIA (Demo)", status: "DEMO_CONFIGURATION", bankName: "TO_BE_DEFINED" },
};

test("readiness succeeds when all DOCX checks pass", async () => {
  const result = await createReadinessChecker(environment, { checkTemplate: async () => {}, loadSettings: async () => populated })();
  assert.equal(result.status, "ready");
  assert.equal(result.businessConfiguration, "configured");
});

test("readiness accepts canonical demo issuer and bank without leaking their contents", async () => {
  const result = await createReadinessChecker(environment, { checkTemplate: async () => {}, loadSettings: async () => demo })();
  assert.equal(result.status, "ready");
  assert.equal(result.businessConfiguration, "demo");
  assert.equal(JSON.stringify(result).includes("TO_BE_DEFINED"), false);
  assert.equal(JSON.stringify(result).includes("EXPOVIA"), false);
});

for (const [name, dependencies, expected] of [
  ["template missing", { checkTemplate: async () => { throw new Error("missing"); }, loadSettings: async () => populated }, "unavailable"],
  ["database unavailable", { checkTemplate: async () => {}, loadSettings: async () => { throw new Error("db secret"); } }, "unavailable"],
  ["settings missing", { checkTemplate: async () => {}, loadSettings: async () => null }, "missing"],
  ["issuer invalid", { checkTemplate: async () => {}, loadSettings: async () => ({ ...populated, issuer: null }) }, "incomplete"],
  ["bank invalid", { checkTemplate: async () => {}, loadSettings: async () => ({ ...populated, bank: [] }) }, "incomplete"],
]) {
  test(`readiness reports ${name} without exposing contents`, async () => {
    const result = await createReadinessChecker(environment, dependencies)();
    assert.equal(result.status, "not_ready");
    assert.equal(JSON.stringify(result).includes("hidden"), false);
    assert.ok(Object.values(result.checks).includes(expected));
  });
}
