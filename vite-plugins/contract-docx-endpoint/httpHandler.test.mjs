import assert from "node:assert/strict";
import test from "node:test";

const { handleContractDocxHttpRequest } = await import(
  new URL("./httpHandler.ts", import.meta.url)
);

const user = { id: "user-1", email: "owner@example.com" };

function request(body = { companyId: "company-1", opportunityId: "opp-1" }, options = {}) {
  const bytes = Buffer.from(
    typeof body === "string" ? body : JSON.stringify(body),
    "utf8",
  );
  return {
    method: options.method ?? "POST",
    headers: options.headers ?? { authorization: "Bearer valid-token" },
    body: (async function* () { yield bytes; })(),
  };
}

function successResult(fileName = "Sözleşme_Çorlu.docx") {
  return {
    success: true,
    outputFileName: fileName,
    outputPath: "C:\\private\\must-not-leak.docx",
    generatedAt: "2026-07-31T12:00:00.000Z",
    companyId: "company-1",
    opportunityId: "opp-1",
    exhibitionId: "exhibition-1",
    warnings: [],
    validationErrors: [],
  };
}

function dependencies(overrides = {}) {
  return {
    authenticate: async () => user,
    authorize: async () => ({ allowed: true }),
    generate: async () => ({
      result: successResult(),
      docxBuffer: Buffer.from("docx"),
    }),
    ...overrides,
  };
}

test("rejects unsupported HTTP methods", async () => {
  const response = await handleContractDocxHttpRequest(
    request({}, { method: "GET" }), dependencies(),
  );
  assert.equal(response.status, 405);
});

test("rejects missing and invalid authentication", async () => {
  const missing = await handleContractDocxHttpRequest(
    request({}, { headers: {} }), dependencies(),
  );
  const invalid = await handleContractDocxHttpRequest(
    request(), dependencies({ authenticate: async () => null }),
  );
  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
});

test("rejects malformed, client-user-controlled, and oversized bodies", async () => {
  const malformed = await handleContractDocxHttpRequest(
    request("{"), dependencies(),
  );
  const userId = await handleContractDocxHttpRequest(
    request({ companyId: "company-1", opportunityId: "opp-1", userId: "other" }),
    dependencies(),
  );
  const oversized = await handleContractDocxHttpRequest(
    request("x".repeat(16 * 1024 + 1)), dependencies(),
  );
  assert.equal(malformed.status, 400);
  assert.equal(userId.status, 400);
  assert.equal(oversized.status, 400);
});

for (const [name, status, code] of [
  ["unauthorized company", 403, "COMPANY_ACCESS_DENIED"],
  ["unauthorized opportunity", 403, "OPPORTUNITY_ACCESS_DENIED"],
  ["company/opportunity mismatch", 403, "COMPANY_OPPORTUNITY_MISMATCH"],
  ["accessible record not found", 404, "OPPORTUNITY_NOT_FOUND"],
]) {
  test(`returns structured error for ${name}`, async () => {
    const response = await handleContractDocxHttpRequest(
      request(),
      dependencies({
        authorize: async () => ({ allowed: false, status, code, message: name }),
      }),
    );
    assert.equal(response.status, status);
    assert.equal(JSON.parse(response.body).code, code);
  });
}

test("preserves orchestrator business validation and cleanup", async () => {
  let cleaned = 0;
  const response = await handleContractDocxHttpRequest(
    request(),
    dependencies({
      generate: async () => ({
        result: {
          success: false,
          outputFileName: null,
          outputPath: null,
          generatedAt: "2026-07-31T12:00:00.000Z",
          companyId: "company-1",
          opportunityId: "opp-1",
          exhibitionId: "exhibition-1",
          warnings: ["warning"],
          validationErrors: [{ code: "SETTINGS_NOT_FOUND", message: "missing" }],
        },
        cleanup: async () => { cleaned += 1; },
      }),
    }),
  );
  assert.equal(response.status, 422);
  assert.equal(JSON.parse(response.body).validationErrors[0].code, "SETTINGS_NOT_FOUND");
  assert.equal(cleaned, 1);
});

test("returns private DOCX bytes with safe international filename", async () => {
  let cleaned = 0;
  const response = await handleContractDocxHttpRequest(
    request(),
    dependencies({
      generate: async () => ({
        result: successResult("Sözleşme_Çorlu.docx"),
        docxBuffer: Buffer.from("PK-docx"),
        cleanup: async () => { cleaned += 1; },
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers["Content-Type"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.match(response.headers["Content-Disposition"], /filename="Sozlesme_Corlu\.docx"/);
  assert.match(response.headers["Content-Disposition"], /filename\*=UTF-8''S%C3%B6zle%C5%9Fme_%C3%87orlu\.docx/);
  assert.match(response.headers["Cache-Control"], /no-store/);
  assert.equal(response.body.toString(), "PK-docx");
  assert.equal(cleaned, 1);
});

test("calls generator once with verified user context", async () => {
  let calls = 0;
  let received;
  const response = await handleContractDocxHttpRequest(
    request(),
    dependencies({
      generate: async (input) => {
        calls += 1;
        received = input;
        return { result: successResult(), docxBuffer: Buffer.from("docx") };
      },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.deepEqual(received.user, user);
  assert.equal(received.accessToken, "valid-token");
});

test("unexpected failures do not leak local paths", async () => {
  const response = await handleContractDocxHttpRequest(
    request(),
    dependencies({
      generate: async () => { throw new Error("C:\\secret\\template.docx service-role-key"); },
    }),
  );
  assert.equal(response.status, 500);
  assert.doesNotMatch(response.body.toString(), /secret|template\.docx|service-role/i);
});
