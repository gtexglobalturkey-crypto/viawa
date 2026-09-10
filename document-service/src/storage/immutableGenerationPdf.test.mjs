import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { archiveGenerationPdf } from "./immutableGenerationPdf.ts";

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
