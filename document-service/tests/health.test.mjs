import assert from "node:assert/strict";
import test from "node:test";

import { endpoint, environment, request, response } from "./testHttp.mjs";
const { createNodeRequestHandler } = await import("../src/http/routes.ts");

test("health is deterministic, no-store and does not call dependencies", async () => {
  let calls = 0;
  const handler = createNodeRequestHandler({ environment, endpointDependencies: endpoint(), pdfEndpointDependencies: endpoint(), checkReadiness: async () => { calls++; throw new Error("must not run"); } });
  const res = response();
  await handler(request({ url: "/health" }), res);
  await res.done;
  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("cache-control"), "no-store");
  assert.deepEqual(JSON.parse(res.body), { status: "ok" });
  assert.equal(calls, 0);
  assert.equal(res.body.includes(Buffer.from("service")), false);
});
