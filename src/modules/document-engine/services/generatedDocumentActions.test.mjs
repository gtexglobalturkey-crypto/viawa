import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { generatedGoogleDocsUrl, verifyGeneratedPdf, loadMatchingGeneratedPdf } from "./generatedDocumentActions.ts";

const record = { masterTemplateId: "master", googleDocFileId: "copy", googleDocUrl: "https://docs.google.com/document/d/copy/edit?usp=drivesdk" };
test("Google Docs handoff preserves the actual copy URL, never reconstructs it", () => {
  assert.equal(generatedGoogleDocsUrl(record), record.googleDocUrl);
  assert.equal(generatedGoogleDocsUrl({ ...record, googleDocUrl: undefined }), null);
});
test("master, mismatched IDs and unsafe URLs are never exposed as generated Docs links", () => {
  for (const overrides of [
    { googleDocFileId: "master" }, { googleDocUrl: "https://docs.google.com/document/d/master/edit" },
    { googleDocUrl: "https://example.com/document/d/copy/edit" }, { googleDocUrl: "javascript:alert(1)" },
  ]) assert.equal(generatedGoogleDocsUrl({ ...record, ...overrides }), null);
});
test("download accepts exact current PDF and rejects stale bytes with the same filename", async () => {
  const bytes = Buffer.from("%PDF-current version");
  const digest = createHash("sha256").update(bytes).digest("hex");
  await verifyGeneratedPdf(new Blob([bytes]), digest);
  await assert.rejects(() => verifyGeneratedPdf(new Blob(["%PDF-old version"]), digest));
  await assert.rejects(() => verifyGeneratedPdf(new Blob(["<html>failure</html>"]), digest));
});

test("download loads the selected persisted version's exact path, never a latest-file search", async () => {
  const bytes = Buffer.from("%PDF-selected version");
  const expectedPath = "owner/company/selected-id/contract.pdf";
  const selected = { storageBucket: "contract-documents", storagePath: expectedPath, fileName: "same.pdf", pdfSha256: createHash("sha256").update(bytes).digest("hex") };
  const calls = [];
  const client = { storage: { from(bucket) { calls.push(bucket); return { download: async (path) => { calls.push(path); return { data: new Blob([bytes]), error: null }; } }; } } };
  assert.deepEqual(Buffer.from(await (await loadMatchingGeneratedPdf(client, selected)).arrayBuffer()), bytes);
  assert.deepEqual(calls, ["contract-documents", expectedPath]);
});
