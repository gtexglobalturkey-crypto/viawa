import assert from "node:assert/strict";
import test from "node:test";
import { loadGeneratedDocumentHistory, mapGeneratedDocumentHistory } from "./generatedDocumentHistoryRepository.ts";

const row = { id: "generation", company_id: "company", opportunity_id: "opportunity", exhibition_id: "fair", version: 4, generated_at: "2026-09-06T10:00:00Z", template_id: "master", google_doc_id: "copy", google_doc_url: "https://docs.google.com/document/d/copy/edit?usp=drivesdk", google_pdf_id: "pdf", google_pdf_url: "https://drive.google.com/file/d/pdf/view", file_name: "contract.pdf", pdf_storage_path: "user/company/generation/contract.pdf", pdf_sha256: "a".repeat(64), pdf_size_bytes: 100, contract_numbers: { contract_number: "EXP-2027-000127" } };
function client(pages) {
  const calls = [];
  const query = { select(columns) { calls.push(["select", columns]); return query; }, eq(...args) { calls.push(["eq", ...args]); return query; }, order() { return query; }, async range(...args) { calls.push(["range", ...args]); return pages.shift(); } };
  return { calls, from(table) { calls.push(["from", table]); return query; } };
}

test("history uses persisted canonical number/version/URLs and exact PDF identity", () => {
  const result = mapGeneratedDocumentHistory(row);
  assert.equal(result.id, row.id);
  assert.equal(result.contractNumber, "EXP-2027-000127");
  assert.equal(result.version, 4);
  assert.equal(result.googleDocUrl, row.google_doc_url);
  assert.equal(result.storagePath, row.pdf_storage_path);
  assert.equal(result.pdfSha256, row.pdf_sha256);
});

test("same authorized history is reconstructed on every browser/session read without inserts", async () => {
  for (let session = 0; session < 2; session++) {
    const db = client([{ data: [row, row], error: null }]);
    const records = await loadGeneratedDocumentHistory(db, "company");
    assert.equal(records.length, 1);
    assert.equal(records[0].id, row.id);
    assert.ok(db.calls.some((call) => call.join() === "eq,company_id,company"));
    assert.ok(db.calls.some((call) => call.join() === "eq,generation_status,COMPLETED"));
  }
});

test("RLS-filtered empty history stays empty; failures never fall back to browser records", async () => {
  assert.deepEqual(await loadGeneratedDocumentHistory(client([{ data: [], error: null }]), "company"), []);
  await assert.rejects(() => loadGeneratedDocumentHistory(client([{ data: null, error: { message: "denied" } }]), "company"));
  assert.throws(() => mapGeneratedDocumentHistory({ ...row, contract_numbers: null }), /Canonical/);
});

test("historical Google rows remain readable without archive metadata or migration backfill", () => {
  const result = mapGeneratedDocumentHistory({ ...row, file_name: null, pdf_storage_path: null, pdf_sha256: null, pdf_size_bytes: null });
  assert.equal(result.googlePdfUrl, row.google_pdf_url);
  assert.equal(result.storagePath, undefined);
});
