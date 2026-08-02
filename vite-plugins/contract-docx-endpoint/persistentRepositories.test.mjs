import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const repositories = await import(
  new URL("../../src/modules/document-engine/repositories/persistentDocumentRepositories.ts", import.meta.url)
);

function readClient(row) {
  const filters = [];
  const builder = {
    select() { return this; },
    eq(field, value) { filters.push([field, value]); return this; },
    order() { return this; },
    limit() { return this; },
    async maybeSingle() { return { data: row, error: null }; },
  };
  return {
    filters,
    client: { from() { return builder; } },
  };
}

test("loads the latest approved snapshot by opportunity and exhibition", async () => {
  const setup = readClient({
    opportunity_id: "opp-1",
    exhibition_id: "ex-1",
    approved_at: "2026-07-31T12:00:00.000Z",
    pricing_source: "exhibition-config",
    pricing_source_version: "2",
    pricing_config_updated_at: null,
    matched_repository_folder: "wampex",
    price_input: { exhibitionId: "ex-1", standType: "custom-stand" },
    price_result: { currency: "USD", grandTotal: 9810 },
    exhibitions: { name: "WAMPEX 2027" },
  });
  const snapshot = await repositories.loadPersistentApprovedPriceSnapshot(
    setup.client,
    { opportunityId: "opp-1", exhibitionId: "ex-1" },
  );
  assert.equal(snapshot.exhibitionName, "WAMPEX 2027");
  assert.equal(snapshot.priceResult.grandTotal, 9810);
  assert.deepEqual(setup.filters, [
    ["opportunity_id", "opp-1"],
    ["exhibition_id", "ex-1"],
  ]);
});

test("returns null when approved snapshot or settings do not exist", async () => {
  const setup = readClient(null);
  assert.equal(
    await repositories.loadPersistentApprovedPriceSnapshot(setup.client, {
      opportunityId: "opp-1",
      exhibitionId: "ex-1",
    }),
    null,
  );
  assert.equal(
    await repositories.loadPersistentDocumentSettings(setup.client),
    null,
  );
});

test("loads participation-contract settings from the canonical row", async () => {
  const setup = readClient({
    issuer: { taxNumber: "123" },
    bank: { ibanUsd: "TR00" },
  });
  const settings = await repositories.loadPersistentDocumentSettings(
    setup.client,
  );
  assert.equal(settings.issuer.taxNumber, "123");
  assert.equal(settings.bank.ibanUsd, "TR00");
  assert.deepEqual(setup.filters, [["id", "participation-contract"]]);
});

test("persists the complete approved input and result as a new immutable row", async () => {
  let inserted;
  const client = {
    from(table) {
      assert.equal(table, "approved_price_snapshots");
      return {
        async insert(value) {
          inserted = value;
          return { error: null };
        },
      };
    },
  };
  await repositories.createPersistentApprovedPriceSnapshot(client, {
    companyId: "company-1",
    snapshot: {
      opportunityId: "opp-1",
      exhibitionId: "ex-1",
      exhibitionName: "WAMPEX",
      pricingSource: "exhibition-config",
      approvedAt: "2026-07-31T12:00:00.000Z",
      priceInput: { exhibitionId: "ex-1", standType: "custom-stand", standLocationType: "corner", standAreaSqm: 12, basePricePerSqm: 600 },
      priceResult: { currency: "USD", grandTotal: 9810, additionalServicesFee: 50 },
    },
  });
  assert.equal(inserted.company_id, "company-1");
  assert.equal(inserted.price_input.standAreaSqm, 12);
  assert.equal(inserted.price_result.additionalServicesFee, 50);
  assert.equal(inserted.price_result.grandTotal, 9810);
});

test("migration enforces immutable snapshots at the database boundary", async () => {
  const migration = await readFile(
    new URL("../../supabase/migrations/20260731050000_add_persistent_document_providers.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /before update or delete on public\.approved_price_snapshots/i);
  assert.match(migration, /raise exception 'Approved price snapshots are immutable'/i);
  assert.doesNotMatch(migration, /create policy approved_price_snapshots.*for update/is);
});
