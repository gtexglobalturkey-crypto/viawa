import assert from "node:assert/strict";
import test from "node:test";

import { endpoint, environment, request, response } from "./testHttp.mjs";
const { createNodeRequestHandler } = await import("../src/http/routes.ts");

async function run(options, dependencies = endpoint()) {
  const handler = createNodeRequestHandler({ environment, endpointDependencies: dependencies, pdfEndpointDependencies: endpoint(), checkReadiness: async () => ({ status: "ready", businessConfiguration: "demo", checks: { template: "ok", database: "ok", documentSettings: "ok" } }) });
  const res = response();
  await handler(request(options), res);
  await res.done;
  return res;
}

const validBody = JSON.stringify({ companyId: "company", opportunityId: "opportunity" });
const jsonHeaders = { "content-type": "application/json", authorization: "Bearer token" };

test("DOCX route preserves authentication and successful response contract", async () => {
  let generated = 0;
  const res = await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: validBody }, endpoint({ generate: async () => { generated++; return { result: { success: true, outputFileName: "Sözleşme.docx", warnings: [], validationErrors: [] }, docxBuffer: Buffer.from("docx") }; } }));
  assert.equal(res.statusCode, 200);
  assert.match(res.getHeader("content-type"), /wordprocessingml/);
  assert.match(res.getHeader("content-disposition"), /attachment/);
  assert.equal(generated, 1);
});

test("DOCX route rejects missing and invalid bearer authentication", async () => {
  const missing = await run({ method: "POST", url: "/api/contracts/generate-docx", headers: { "content-type": "application/json" }, body: validBody });
  const invalid = await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: validBody }, endpoint({ authenticate: async () => null }));
  assert.equal(missing.statusCode, 401);
  assert.equal(invalid.statusCode, 401);
});

test("DOCX route applies JSON, body, method, route and authorization safety", async () => {
  assert.equal((await run({ method: "POST", url: "/api/contracts/generate-docx", headers: { ...jsonHeaders, "content-type": "text/plain" }, body: validBody })).statusCode, 415);
  assert.equal((await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: "{" })).statusCode, 400);
  assert.equal((await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: "x".repeat(129) })).statusCode, 413);
  assert.equal((await run({ method: "GET", url: "/api/contracts/generate-docx" })).statusCode, 405);
  assert.equal((await run({ method: "GET", url: "/unknown" })).statusCode, 404);
  assert.equal((await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: validBody }, endpoint({ authorize: async () => ({ allowed: false, status: 403, code: "OPPORTUNITY_ACCESS_DENIED", message: "denied" }) }))).statusCode, 403);
});

test("DOCX route preserves request-scoped cleanup", async () => {
  let cleaned = 0;
  await run({ method: "POST", url: "/api/contracts/generate-docx", headers: jsonHeaders, body: validBody }, endpoint({ generate: async () => ({ result: { success: true, outputFileName: "Contract.docx", warnings: [], validationErrors: [] }, docxBuffer: Buffer.from("docx"), cleanup: async () => { cleaned++; } }) }));
  assert.equal(cleaned, 1);
});
