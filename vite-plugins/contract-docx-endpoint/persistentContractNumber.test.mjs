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

const { createPersistentContractNumberProvider } = await import(
  new URL("../../src/modules/document-engine/repositories/persistentContractNumberRepository.ts", import.meta.url)
);

const request = {
  companyId: "company-1",
  opportunityId: "opportunity-1",
  exhibition: { id: "exhibition-1" },
  generatedAt: new Date("2026-07-31T12:00:00Z"),
};

test("requests the server-generated number without accepting a client number or year", async () => {
  let call;
  const provider = createPersistentContractNumberProvider({
    async rpc(name, parameters) {
      call = { name, parameters };
      return { data: "EXP-2027-000001", error: null };
    },
  });
  assert.equal(await provider(request), "EXP-2027-000001");
  assert.deepEqual(call, {
    name: "get_or_create_contract_number",
    parameters: {
      p_company_id: "company-1",
      p_opportunity_id: "opportunity-1",
      p_exhibition_id: "exhibition-1",
    },
  });
});

test("returns the same persisted number on retry", async () => {
  let calls = 0;
  const provider = createPersistentContractNumberProvider({
    async rpc() {
      calls += 1;
      return { data: "EXP-2027-000042", error: null };
    },
  });
  assert.equal(await provider(request), "EXP-2027-000042");
  assert.equal(await provider(request), "EXP-2027-000042");
  assert.equal(calls, 2);
});

test("rejects malformed or failed database responses without leaking details", async () => {
  for (const response of [
    { data: "CLIENT-SUPPLIED", error: null },
    { data: null, error: { message: "database-secret-path" } },
  ]) {
    const provider = createPersistentContractNumberProvider({
      async rpc() { return response; },
    });
    await assert.rejects(
      () => provider(request),
      (error) =>
        error.message === "Contract number could not be resolved." &&
        !error.message.includes("secret"),
    );
  }
});

test("migration defines atomic yearly allocation and idempotent business key", async () => {
  const sql = await readFile(
    new URL("../../supabase/migrations/20260731060000_add_persistent_contract_numbers.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /unique \(opportunity_id, exhibition_id\)/i);
  assert.match(sql, /unique \(contract_year, sequence_number\)/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /EXP-%s-%s/i);
  assert.match(sql, /lpad\(v_sequence_number::text, 6, '0'\)/i);
  assert.doesNotMatch(sql, /p_contract_number|p_contract_year/i);
});
