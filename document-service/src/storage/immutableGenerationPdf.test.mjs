import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { archiveGenerationPdf } from "./immutableGenerationPdf.ts";
import { createStoredPdfEndpointDependencies, handleContractPdfHttpRequest } from "../pdf/contractPdfEndpoint.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const first = "33333333-3333-4333-8333-333333333333";
const second = "44444444-4444-4444-8444-444444444444";
const oldPdf = Buffer.from("%PDF-old generation");
const currentPdf = Buffer.concat([Buffer.from("%PDF-current generation"), Buffer.from([0, 128, 255])]);

test("identical logical filenames use distinct generated-document storage identities", async () => {
  const objects = new Map();
  const upload = async (path, bytes) => {
    if (objects.has(path)) return { error: new Error("duplicate") };
    objects.set(path, bytes); return { error: null };
  };
  const a = await archiveGenerationPdf({ userId, companyId, generatedDocumentId: first, fileName: "same.pdf", pdf: oldPdf, upload });
  const b = await archiveGenerationPdf({ userId, companyId, generatedDocumentId: second, fileName: "same.pdf", pdf: currentPdf, upload });
  assert.notEqual(a.storagePath, b.storagePath);
  assert.deepEqual(objects.get(a.storagePath), oldPdf);
  assert.deepEqual(objects.get(b.storagePath), currentPdf);
  assert.equal(b.sha256, createHash("sha256").update(currentPdf).digest("hex"));
  await assert.rejects(() => archiveGenerationPdf({ userId, companyId, generatedDocumentId: first, fileName: "same.pdf", pdf: currentPdf, upload }), /could not be archived/);
  assert.deepEqual(objects.get(a.storagePath), oldPdf);
});

test("Google HTTP response never substitutes legacy cached PDF bytes", async () => {
  const archive = await archiveGenerationPdf({ userId, companyId, generatedDocumentId: second, fileName: "same.pdf", pdf: currentPdf, upload: async () => ({ error: null }) });
  const dependencies = createStoredPdfEndpointDependencies({
    base: { authenticate: async () => ({ id: userId }), authorize: async () => ({ allowed: true }) },
    reuseExisting: false,
    storage: { find: async () => { throw new Error("legacy lookup forbidden"); }, store: async () => ({ fileName: "old.pdf", pdfBuffer: oldPdf }) },
    generatePdf: async () => ({ result: { success: true, outputFileName: "same.pdf", warnings: [], validationErrors: [] }, docxBuffer: currentPdf,
      artifacts: { masterTemplateId: "master", googleDocFileId: "copy", googleDocUrl: "https://docs.google.com/document/d/copy/edit", googlePdfFileId: "pdf", googlePdfUrl: "https://drive.google.com/file/d/pdf/view", generatedDocumentId: second, pdfStoragePath: archive.storagePath } }),
  });
  const response = await handleContractPdfHttpRequest({ method: "POST", headers: { authorization: "Bearer token" }, body: (async function* () { yield Buffer.from(JSON.stringify({ companyId, opportunityId: first })); })() }, dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, currentPdf);
  assert.equal(response.headers["X-VIAWA-Generated-Document-Id"], second);
  assert.equal(createHash("sha256").update(response.body).digest("hex"), archive.sha256);
});
