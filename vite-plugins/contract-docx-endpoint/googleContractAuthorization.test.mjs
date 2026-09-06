import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseContractAuthorizer } from "./supabaseAuthorization.ts";
import { handleContractPdfHttpRequest } from "../../document-service/src/pdf/contractPdfEndpoint.ts";

for (const [name, isActive, owner, status] of [
  ["active UUID owner", true, "user-id", 200],
  ["active email owner", true, "OWNER@EXAMPLE.COM", 200],
  ["active non-owner", true, "someone-else", 403],
  ["inactive owner", false, "user-id", 403],
]) test(`Google generation authorization: ${name}`, async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const path = new URL(url).pathname;
    calls.push(path);
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer caller-token");
    if (path.endsWith("/application_users")) return Response.json([{ id: "user-id", is_active: isActive }]);
    if (path.endsWith("/companies")) return Response.json([{ id: "company" }]);
    if (path.endsWith("/opportunities")) return Response.json([{ id: "opportunity", company_id: "company", owner }]);
    throw new Error(`Unexpected outbound request: ${path}`);
  });
  let generations = 0;
  const response = await handleContractPdfHttpRequest({ method: "POST", headers: { authorization: "Bearer caller-token" }, body: (async function* () { yield Buffer.from(JSON.stringify({ companyId: "company", opportunityId: "opportunity" })); })() }, {
    authenticate: async () => ({ id: "user-id", email: "owner@example.com" }),
    authorize: createSupabaseContractAuthorizer({ supabaseUrl: "https://supabase.invalid", supabaseAnonKey: "anon" }),
    generate: async () => { generations++; return { result: { success: true, outputFileName: "contract.pdf", warnings: [], validationErrors: [] }, docxBuffer: Buffer.from("%PDF-authorized") }; },
  });
  assert.equal(response.status, status);
  assert.equal(generations, status === 200 ? 1 : 0);
  if (!isActive) assert.deepEqual(calls, ["/rest/v1/application_users"]);
});
