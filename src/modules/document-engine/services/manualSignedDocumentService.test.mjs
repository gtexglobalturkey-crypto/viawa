import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) { if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return next(`${specifier}.ts`, context); throw error; } } });
const { saveManualSignedDocument } = await import("./manualSignedDocumentService.ts");

test("manual signed evidence persists separately and never overwrites the generated PDF", async () => {
  const calls = [];
  const query = { eq(...args) { calls.push(["eq", ...args]); return query; }, is(...args) { calls.push(["is", ...args]); return query; }, select() { return query; }, single: async () => ({ data: { id: "generation" }, error: null }) };
  const client = {
    storage: { from: () => ({ upload: async (path, _file, options) => { calls.push(["upload", path, options]); return { error: null }; } }) },
    from: () => ({ update: (fields) => { calls.push(["update", fields]); return query; } }),
  };
  const result = await saveManualSignedDocument(client, "owner", { id: "generation", companyId: "company" }, new File(["%PDF-user-signed"], "signed.pdf", { type: "application/pdf" }));
  assert.match(result.path, /^owner\/company\/generation\/signed-[0-9a-f-]+\.pdf$/);
  assert.equal(calls[0][2].upsert, false);
  assert.deepEqual(calls[1][1], { signed_pdf_storage_path: result.path, signed_pdf_file_name: "signed.pdf", signature_completed_at: result.completedAt });
  assert.ok(calls.some((call) => call[0] === "is" && call[1] === "signed_pdf_storage_path" && call[2] === null));
  assert.equal(calls.some((call) => JSON.stringify(call).includes('"pdf_storage_path"')), false);
});

test("invalid manual upload stops before any storage or database write", async () => {
  await assert.rejects(() => saveManualSignedDocument({}, "owner", {}, new File(["not a PDF"], "fake.pdf")));
});
