import assert from "node:assert/strict";
import test from "node:test";

const { loadDocumentServiceEnvironment } = await import("../src/config/environment.ts");

const valid = {
  NODE_ENV: "production", HOST: "127.0.0.1", PORT: "8080",
  SUPABASE_URL: "https://project.example", SUPABASE_ANON_KEY: "anon-secret-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret-value", DOCUMENT_TEMPLATE_PATH: "/template.docx",
  DOCUMENT_TEMP_ROOT: "/tmp/documents", LOG_LEVEL: "info",
  CORS_ALLOWED_ORIGINS: "https://app.example", HTTP_REQUEST_BODY_LIMIT_BYTES: "16384",
};

test("environment fails fast for missing required values", () => {
  assert.throws(() => loadDocumentServiceEnvironment({ ...valid, PORT: undefined }), /PORT/);
});

test("environment rejects invalid ports, URLs and body limits", () => {
  assert.throws(() => loadDocumentServiceEnvironment({ ...valid, PORT: "70000" }), /PORT/);
  assert.throws(() => loadDocumentServiceEnvironment({ ...valid, SUPABASE_URL: "secret-value" }), /SUPABASE_URL/);
  assert.throws(() => loadDocumentServiceEnvironment({ ...valid, HTTP_REQUEST_BODY_LIMIT_BYTES: "0" }), /HTTP_REQUEST/);
});

test("environment errors never contain secret values", () => {
  let message = "";
  try { loadDocumentServiceEnvironment({ ...valid, SUPABASE_URL: valid.SUPABASE_SERVICE_ROLE_KEY }); }
  catch (error) { message = String(error); }
  assert.equal(message.includes(valid.SUPABASE_SERVICE_ROLE_KEY), false);
  assert.equal(message.includes(valid.SUPABASE_ANON_KEY), false);
});
