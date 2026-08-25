import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { runPersistedGoogleGeneration } = await import("./requestScopedGoogleContractGeneration.ts");

const CONTRACT_ID = "11111111-1111-4111-8111-111111111111";
const values = { CNO: "EXP-2027-000001", COMPANY_LEGAL_NAME: "Test ÇĞİÖŞÜ çğıöşü AŞ", FNM: "Test Fair" };

function setup({ failAt } = {}) {
  const calls = [];
  const pending = { id: "generated-row", contractId: CONTRACT_ID, version: 2 };
  const persistence = {
    async createPending(input) { calls.push(["PENDING", input]); return pending; },
    async markDocCreated(_record, refs) { calls.push(["DOC_CREATED", refs]); },
    async markPdfCreated(_record, refs) { calls.push(["PDF_CREATED", refs]); },
    async markCompleted() { calls.push(["COMPLETED"]); },
    async markFailed() { calls.push(["FAILED"]); },
  };
  const google = {
    async copyMaster() { calls.push(["COPY"]); if (failAt === "copy") throw new Error("copy failed"); return { id: "doc-id", url: "https://docs.google.com/doc-id" }; },
    async replaceAll(_id, replacements) { calls.push(["REPLACE", replacements]); },
    async verifyPlaceholders() { calls.push(["VERIFY"]); },
    async exportPdf() { calls.push(["EXPORT"]); return Buffer.from("%PDF-test"); },
    async uploadPdf() { calls.push(["UPLOAD"]); if (failAt === "upload") throw new Error("upload failed"); return { id: "pdf-id", url: "https://drive.google.com/pdf-id" }; },
  };
  return { calls, persistence, google };
}

function input(setupValue) {
  return {
    values, contractIdentity: { id: CONTRACT_ID, number: "EXP-2027-000001" },
    companyId: "company", opportunityId: "opportunity", exhibitionId: "exhibition",
    generatedAt: "2026-08-25T10:00:00.000Z", masterTemplateId: "master-id",
    google: setupValue.google, persistence: setupValue.persistence,
  };
}

test("PENDING precedes remote work and refs follow their completed stages", async () => {
  const state = setup();
  const result = await runPersistedGoogleGeneration(input(state));
  assert.deepEqual(state.calls.map(([name]) => name), [
    "PENDING", "COPY", "DOC_CREATED", "REPLACE", "VERIFY", "EXPORT", "UPLOAD", "PDF_CREATED", "COMPLETED",
  ]);
  assert.equal(state.calls[0][1].contractId, CONTRACT_ID);
  assert.equal(state.calls[0][1].templateId, "master-id");
  assert.deepEqual(state.calls[2][1], { googleDocId: "doc-id", googleDocUrl: "https://docs.google.com/doc-id" });
  assert.deepEqual(state.calls[7][1], { googlePdfId: "pdf-id", googlePdfUrl: "https://drive.google.com/pdf-id" });
  assert.equal(result.artifacts.generatedDocumentVersion, 2);
});

test("remote failure marks the persistent row FAILED and never deletes it", async () => {
  const state = setup({ failAt: "upload" });
  await assert.rejects(() => runPersistedGoogleGeneration(input(state)), /upload failed/);
  assert.equal(state.calls.at(-1)[0], "FAILED");
  assert.equal(state.calls.some(([name]) => name === "DELETE"), false);
});

test("missing canonical UUID stops before PENDING or Google calls", async () => {
  const state = setup();
  await assert.rejects(() => runPersistedGoogleGeneration({ ...input(state), contractIdentity: { number: "EXP-2027-000001" } }), /CANONICAL_CONTRACT_UUID_MISSING/);
  assert.deepEqual(state.calls, []);
});

test("server persistence path does not read, write, or migrate browser localStorage", async () => {
  const generationSource = await readFile(new URL("./requestScopedGoogleContractGeneration.ts", import.meta.url), "utf8");
  const repositorySource = await readFile(new URL("../../../src/modules/document-engine/repositories/generatedDocumentRepository.ts", import.meta.url), "utf8");
  assert.doesNotMatch(generationSource, /localStorage|generatedDocumentStorage/);
  assert.doesNotMatch(repositorySource, /localStorage|generatedDocumentStorage/);
});
