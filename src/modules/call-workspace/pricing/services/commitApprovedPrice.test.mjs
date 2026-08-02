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
    updateOpportunity: async (...args) => {
      calls.push(["updateOpportunity", ...args]);
      return {};
    },
    saveApprovedPriceSnapshot: async (...args) => {
      calls.push(["saveApprovedPriceSnapshot", ...args]);
    },
    ...overrides.dependencies,
  };

  const onPersistedCalls = [];
  const input = {
    companyId: "company-1",
    opportunityId: "opp-1",
    opportunityPricePatch: { price_grand_total: 1000 },
    snapshot,
    onPersisted: (persisted) => {
      calls.push(["onPersisted", persisted]);
      onPersistedCalls.push(persisted);
    },
    ...overrides.input,
  };

  return { calls, dependencies, input, onPersistedCalls, snapshot };
}

test("remote persistence success: saves the snapshot once and only then commits local state", async () => {
  const { calls, dependencies, input, onPersistedCalls, snapshot } =
    baseInput();

  const result = await commitApprovedPrice(dependencies, input);

  assert.equal(result.success, true);
  assert.equal(onPersistedCalls.length, 1);
  assert.equal(onPersistedCalls[0], snapshot);

  const order = calls.map((call) => call[0]);
  assert.deepEqual(order, [
    "updateOpportunity",
    "saveApprovedPriceSnapshot",
    "onPersisted",
  ]);
});

test("remote persistence failure (snapshot insert rejects): local state is never committed", async () => {
  const failure = new Error("insert rejected");
  const { calls, dependencies, input } = baseInput({
    dependencies: {
      saveApprovedPriceSnapshot: async () => {
        calls.push(["saveApprovedPriceSnapshot"]);
        throw failure;
      },
    },
  });

  const result = await commitApprovedPrice(dependencies, input);

  assert.equal(result.success, false);
  assert.equal(result.error, failure);
  assert.ok(
    !calls.some((call) => call[0] === "onPersisted"),
    "onPersisted must not be called when saveApprovedPriceSnapshot fails",
  );
});

test("remote persistence failure (opportunity update rejects): snapshot is never written and local state is never committed", async () => {
  const failure = new Error("update rejected");
  const { calls, dependencies, input } = baseInput({
    dependencies: {
      updateOpportunity: async () => {
        calls.push(["updateOpportunity"]);
        throw failure;
      },
    },
  });

  const result = await commitApprovedPrice(dependencies, input);

  assert.equal(result.success, false);
  assert.equal(result.error, failure);
  assert.ok(
    !calls.some((call) => call[0] === "saveApprovedPriceSnapshot"),
    "saveApprovedPriceSnapshot must not run when the opportunity update fails",
  );
  assert.ok(
    !calls.some((call) => call[0] === "onPersisted"),
    "onPersisted must not be called when the opportunity update fails",
  );
});
