import assert from "node:assert/strict";
import test from "node:test";

import { endpoint, environment, request, response } from "./testHttp.mjs";
const { createNodeRequestHandler } = await import("../src/http/routes.ts");
const { createStoredPdfEndpointDependencies } = await import("../src/pdf/contractPdfEndpoint.ts");

const validBody = JSON.stringify({ companyId: "company", opportunityId: "opportunity" });
const headers = { "content-type": "application/json", authorization: "Bearer token" };
const pdf = Buffer.from("%PDF-valid-document");
const success = { success: true, outputFileName: "Contract_Demo.pdf", outputPath: "private", generatedAt: "2026-08-01T00:00:00Z", companyId: "company", opportunityId: "opportunity", exhibitionId: "exhibition", warnings: [], validationErrors: [] };

function dependencies({ existing = null, storageError = false, generationError = null } = {}) {
  let generated = 0, stored = 0, cleaned = 0;
  const base = endpoint();
  const value = createStoredPdfEndpointDependencies({
    base,
    generatePdf: async () => {
      generated++;
      if (generationError) throw generationError;
      return { result: success, docxBuffer: pdf, cleanup: async () => { cleaned++; } };
    },
    storage: {
      find: async () => existing,
      store: async (input) => {
        stored++;
        if (storageError) throw new Error("private storage detail");
        return { fileName: input.fileName, pdfBuffer: input.pdfBuffer, path: "private/path" };
      },
    },
  });
  return { value, calls: () => ({ generated, stored, cleaned }) };
}

async function run(pdfDependencies, options = {}) {
  const handler = createNodeRequestHandler({ environment, endpointDependencies: endpoint(), pdfEndpointDependencies: pdfDependencies, checkReadiness: async () => ({ status: "ready", businessConfiguration: "demo", checks: { template: "ok", database: "ok", documentSettings: "ok" } }) });
  const res = response();
  await handler(request({ method: "POST", url: "/api/contracts/generate-pdf", headers, body: validBody, ...options }), res);
  await res.done;
  return res;
}

test("PDF endpoint stores and downloads the same valid PDF", async () => {
  const setup = dependencies();
  const res = await run(setup.value);
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("content-type"), "application/pdf");
  assert.match(res.getHeader("content-disposition"), /Contract_Demo\.pdf/);
  assert.deepEqual(res.body, pdf);
  assert.deepEqual(setup.calls(), { generated: 1, stored: 1, cleaned: 1 });
});

test("PDF endpoint reuses an existing version without generation or duplicate upload", async () => {
  const setup = dependencies({ existing: { fileName: "Existing.pdf", pdfBuffer: pdf, path: "private/existing" } });
  const res = await run(setup.value);
  assert.equal(res.statusCode, 200);
  assert.match(res.getHeader("content-disposition"), /Existing\.pdf/);
  assert.deepEqual(setup.calls(), { generated: 0, stored: 0, cleaned: 0 });
});

test("PDF endpoint fails safely on storage, converter and timeout errors", async () => {
  const storage = dependencies({ storageError: true });
  const storageResult = await run(storage.value);
  assert.equal(storageResult.statusCode, 500);
  assert.equal(storageResult.body.includes(Buffer.from("private storage detail")), false);
  assert.equal(storage.calls().cleaned, 1);
  for (const error of [new Error("converter path"), Object.assign(new Error("timeout"), { code: "TIMEOUT" })]) {
    const res = await run(dependencies({ generationError: error }).value);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.includes(Buffer.from(error.message)), false);
  }
});

test("PDF endpoint rejects empty and invalid PDF before storage", async () => {
  for (const invalid of [Buffer.alloc(0), Buffer.from("not-pdf")]) {
    let stored = 0;
    const base = endpoint();
    const deps = createStoredPdfEndpointDependencies({
      base,
      generatePdf: async () => ({ result: success, docxBuffer: invalid, cleanup: async () => {} }),
      storage: { find: async () => null, store: async () => { stored++; throw new Error("must not store"); } },
    });
    assert.equal((await run(deps)).statusCode, 500);
    assert.equal(stored, 0);
  }
});

test("PDF route preserves authentication and authorization", async () => {
  const missing = await run(dependencies().value, { headers: { "content-type": "application/json" } });
  assert.equal(missing.statusCode, 401);
  const deniedBase = endpoint({ authorize: async () => ({ allowed: false, status: 403, code: "OPPORTUNITY_ACCESS_DENIED", message: "denied" }) });
  const denied = createStoredPdfEndpointDependencies({ base: deniedBase, generatePdf: async () => { throw new Error("must not run"); }, storage: { find: async () => null, store: async () => { throw new Error("must not run"); } } });
  assert.equal((await run(denied)).statusCode, 403);
});
