import assert from "node:assert/strict";
import test from "node:test";

import { createGeneratedDocumentRepository } from "./generatedDocumentRepository.ts";

const CONTRACT_ID = "11111111-1111-4111-8111-111111111111";

function fakeClient(responses) {
  const writes = [];
  return {
    writes,
    from(table) {
      let operation = "select";
      let payload;
      const builder = {
        select() { return builder; }, eq() { return builder; }, order() { return builder; }, limit() { return builder; },
        insert(value) { operation = "insert"; payload = value; writes.push({ table, operation, payload }); return builder; },
        update(value) { operation = "update"; payload = value; writes.push({ table, operation, payload }); return builder; },
        async maybeSingle() { return responses.shift(); },
        async single() { return responses.shift(); },
      };
      return builder;
    },
  };
}

test("canonical contract UUID, never visible EXP number, is persisted as contract_id", async () => {
  const client = fakeClient([
    { data: null, error: null },
    { data: { id: "doc-row", contract_id: CONTRACT_ID, version: 1 }, error: null },
  ]);
  const record = await createGeneratedDocumentRepository(client).createPending({
    contractId: CONTRACT_ID, opportunityId: "opp", companyId: "company", exhibitionId: "exhibition",
    documentType: "participation-contract", templateId: "master-id", generatedAt: "2026-08-25T10:00:00.000Z",
  });
  assert.equal(record.contractId, CONTRACT_ID);
  assert.equal(client.writes[0].payload.contract_id, CONTRACT_ID);
  assert.equal(JSON.stringify(client.writes).includes("EXP-"), false);
  assert.equal(client.writes[0].payload.generation_status, "PENDING");
  assert.equal("signing_status" in client.writes[0].payload, false);
  assert.equal(client.writes[0].payload.template_id, "master-id");
});

test("visible contract number is rejected as a foreign key", async () => {
  await assert.rejects(() => createGeneratedDocumentRepository(fakeClient([])).createPending({
    contractId: "EXP-2027-000001", opportunityId: "opp", companyId: "company", exhibitionId: "exhibition",
    documentType: "participation-contract", templateId: "master-id", generatedAt: "2026-08-25T10:00:00.000Z",
  }), /Canonical contract UUID is required/);
});

test("version conflict retries with the next observed version", async () => {
  const client = fakeClient([
    { data: { version: 1 }, error: null },
    { data: null, error: { code: "23505" } },
    { data: { version: 2 }, error: null },
    { data: { id: "doc-row-3", contract_id: CONTRACT_ID, version: 3 }, error: null },
  ]);
  const record = await createGeneratedDocumentRepository(client).createPending({
    contractId: CONTRACT_ID, opportunityId: "opp", companyId: "company", exhibitionId: "exhibition",
    documentType: "participation-contract", templateId: "master-id", generatedAt: "2026-08-25T10:00:00.000Z",
  });
  assert.equal(record.version, 3);
  assert.deepEqual(client.writes.filter((write) => write.operation === "insert").map((write) => write.payload.version), [2, 3]);
});
