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

const { commitApprovedPrice } = await import(
  new URL("./commitApprovedPrice.ts", import.meta.url)
);

function baseInput(overrides = {}) {
  const calls = [];
  const snapshot = {
    opportunityId: "opp-1",
    exhibitionId: "ex-1",
    exhibitionName: "WAMPEX",
    pricingSource: "exhibition-config",
    approvedAt: "2026-08-01T10:00:00.000Z",
    priceInput: { exhibitionId: "ex-1" },
    priceResult: { currency: "USD", grandTotal: 1000 },
  };

  const dependencies = {
    approveOpportunityPrice: async (...args) => {
      calls.push(["approveOpportunityPrice", ...args]);
      return "snapshot-1";
    },
    ...overrides.dependencies,
  };

  const onPersistedCalls = [];
  const input = {
    companyId: "company-1",
    snapshot,
    onPersisted: (persisted) => {
      calls.push(["onPersisted", persisted]);
      onPersistedCalls.push(persisted);
    },
    ...overrides.input,
  };

  return { calls, dependencies, input, onPersistedCalls, snapshot };
}

test("atomic persistence success: applies the price and only then commits local state", async () => {
  const { calls, dependencies, input, onPersistedCalls, snapshot } =
    baseInput();

  const result = await commitApprovedPrice(dependencies, input);

  assert.equal(result.success, true);
  assert.equal(onPersistedCalls.length, 1);
  assert.equal(onPersistedCalls[0], snapshot);

  const order = calls.map((call) => call[0]);
  assert.deepEqual(order, ["approveOpportunityPrice", "onPersisted"]);

  const [, callInput] = calls[0];
  assert.equal(callInput.companyId, "company-1");
  assert.equal(callInput.snapshot, snapshot);
});

test("atomic persistence failure: local state is never committed", async () => {
  const failure = new Error("approve_opportunity_price rejected");
  const { calls, dependencies, input } = baseInput({
    dependencies: {
      approveOpportunityPrice: async () => {
        calls.push(["approveOpportunityPrice"]);
        throw failure;
      },
    },
  });

  const result = await commitApprovedPrice(dependencies, input);

  assert.equal(result.success, false);
  assert.equal(result.error, failure);
  assert.ok(
    !calls.some((call) => call[0] === "onPersisted"),
    "onPersisted must not be called when approveOpportunityPrice fails",
  );
});

test("dependency surface exposes a single atomic call, not two independent writes", () => {
  assert.deepEqual(
    Object.keys(baseInput().dependencies).sort(),
    ["approveOpportunityPrice"],
  );
});
