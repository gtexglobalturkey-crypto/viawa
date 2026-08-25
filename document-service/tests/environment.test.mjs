import assert from "node:assert/strict";
import test from "node:test";

const { loadDocumentServiceEnvironment } = await import("../src/config/environment.ts");

const valid = {
  NODE_ENV: "production", HOST: "127.0.0.1", PORT: "8080",
  SUPABASE_URL: "https://project.example", SUPABASE_ANON_KEY: "anon-secret-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret-value", DOCUMENT_TEMPLATE_PATH: "/template.docx",
  DOCUMENT_TEMP_ROOT: "/tmp/documents", LOG_LEVEL: "info",
  CORS_ALLOWED_ORIGINS: "https://app.example", HTTP_REQUEST_BODY_LIMIT_BYTES: "16384",
  GOOGLE_WORKSPACE_CLIENT_ID: "client", GOOGLE_WORKSPACE_CLIENT_SECRET: "secret",
  GOOGLE_WORKSPACE_REFRESH_TOKEN: "refresh", VIAWA_MASTER_CONTRACT_TEMPLATE_ID: "master-document",
  VIAWA_GENERATED_DOCUMENTS_FOLDER_ID: "production-output-folder",
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

test("Google configuration requires explicit master and environment-specific output folder", () => {
  const google = {
    GOOGLE_WORKSPACE_CLIENT_ID: "client",
    GOOGLE_WORKSPACE_CLIENT_SECRET: "secret",
    GOOGLE_WORKSPACE_REFRESH_TOKEN: "refresh",
    VIAWA_MASTER_CONTRACT_TEMPLATE_ID: "master-document",
    VIAWA_GENERATED_DOCUMENTS_FOLDER_ID: "production-output-folder",
  };
  const environment = loadDocumentServiceEnvironment({ ...valid, ...google });
  assert.equal(environment.googleWorkspace.masterContractTemplateId, "master-document");
  assert.equal(environment.googleWorkspace.generatedDocumentsFolderId, "production-output-folder");
  assert.throws(
    () => loadDocumentServiceEnvironment({ ...valid, ...google, VIAWA_GENERATED_DOCUMENTS_FOLDER_ID: undefined }),
    /configured together/,
  );
  assert.throws(
    () => loadDocumentServiceEnvironment({ ...valid, ...google, VIAWA_GENERATED_DOCUMENTS_FOLDER_ID: "master-document" }),
    /cannot be used/,
  );
  assert.throws(
    () => loadDocumentServiceEnvironment({
      ...valid,
      GOOGLE_WORKSPACE_CLIENT_ID: undefined,
      GOOGLE_WORKSPACE_CLIENT_SECRET: undefined,
      GOOGLE_WORKSPACE_REFRESH_TOKEN: undefined,
      VIAWA_MASTER_CONTRACT_TEMPLATE_ID: undefined,
      VIAWA_GENERATED_DOCUMENTS_FOLDER_ID: undefined,
    }),
    /configured together/,
  );
});
