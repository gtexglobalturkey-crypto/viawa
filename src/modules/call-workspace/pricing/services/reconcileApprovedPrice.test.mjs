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

const { reconcileApprovedPrice } = await import(
  new URL("./reconcileApprovedPrice.ts", import.meta.url)
);

test("stale local approved state with no persistent row: reported as not approved", async () => {
  const result = await reconcileApprovedPrice(
    { loadPersistentSnapshot: async () => null },
    { opportunityId: "opp-1", exhibitionId: "ex-1" },
  );

  assert.deepEqual(result, { approved: false });
});

test("existing persistent snapshot: UI restores the approved state from the persistent row", async () => {
  const snapshot = {
    opportunityId: "opp-1",
    exhibitionId: "ex-1",
    exhibitionName: "WAMPEX",
    pricingSource: "exhibition-config",
    approvedAt: "2026-08-01T10:00:00.000Z",
    priceInput: { exhibitionId: "ex-1" },
    priceResult: { currency: "USD", grandTotal: 1000 },
  };

  let receivedInput;
  const result = await reconcileApprovedPrice(
    {
      loadPersistentSnapshot: async (input) => {
        receivedInput = input;
        return snapshot;
      },
    },
    { opportunityId: "opp-1", exhibitionId: "ex-1" },
  );

  assert.deepEqual(receivedInput, {
    opportunityId: "opp-1",
    exhibitionId: "ex-1",
  });
  assert.equal(result.approved, true);
  assert.equal(result.snapshot, snapshot);
});
