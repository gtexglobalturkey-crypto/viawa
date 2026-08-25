import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assertCopyTarget, createGoogleWorkspaceClient } from "./googleWorkspaceClient.ts";

test("master mutation is blocked", () => {
  assert.throws(() => assertCopyTarget("master", "master"), /MASTER_TEMPLATE_MUTATION_BLOCKED/);
});

test("copy happens before mutation and duplicate placeholders use replaceAllText", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.includes("/copy")) return Response.json({ id: "copy-1", webViewLink: "doc-url" });
    return Response.json({});
  };
  const client = createGoogleWorkspaceClient({ accessToken: "token", masterTemplateId: "master", generatedDocumentsFolderId: "output-folder", fetchImpl });
  const copied = await client.copyMaster("name");
  await client.replaceAll(copied.id, { CDT: "25.08.2026" });
  assert.match(calls[0].url, /master\/copy/);
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: "name", parents: ["output-folder"] });
  assert.match(calls[1].url, /copy-1:batchUpdate/);
  const body = JSON.parse(calls[1].init.body);
  assert.deepEqual(body.requests[0], { replaceAllText: { containsText: { text: "{{CDT}}", matchCase: true }, replaceText: "25.08.2026" } });
});

test("failed copy identity never permits a master write", async () => {
  const client = createGoogleWorkspaceClient({
    accessToken: "token", masterTemplateId: "master", generatedDocumentsFolderId: "output-folder",
    fetchImpl: async () => Response.json({ id: "master" }),
  });
  await assert.rejects(() => client.copyMaster("name"), /MASTER_TEMPLATE_MUTATION_BLOCKED/);
});

test("Drive export and upload preserve opaque PDF bytes", async () => {
  const expected = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from([0x00, 0x80, 0xff, 0xfe])]);
  let uploadedBody;
  const client = createGoogleWorkspaceClient({
    accessToken: "token", masterTemplateId: "master", generatedDocumentsFolderId: "output-folder",
    fetchImpl: async (url, init = {}) => {
      if (url.includes("/export?")) return new Response(expected, { status: 200 });
      if (url.includes("uploadType=multipart")) {
        uploadedBody = Buffer.from(init.body);
        return Response.json({ id: "pdf-1" });
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });
  const exported = await client.exportPdf("copy-1");
  assert.deepEqual(exported, expected);
  await client.uploadPdf("contract.pdf", exported);
  assert.notEqual(uploadedBody.indexOf(expected), -1);
  assert.match(uploadedBody.toString("latin1", 0, uploadedBody.indexOf(expected)), /"parents":\["output-folder"\]/);
});

test("Google output folder is required and cannot be the master document", () => {
  assert.throws(
    () => createGoogleWorkspaceClient({ accessToken: "token", masterTemplateId: "master", generatedDocumentsFolderId: "" }),
    /INVALID_GOOGLE_GENERATED_DOCUMENTS_FOLDER/,
  );
  assert.throws(
    () => createGoogleWorkspaceClient({ accessToken: "token", masterTemplateId: "master", generatedDocumentsFolderId: "master" }),
    /INVALID_GOOGLE_GENERATED_DOCUMENTS_FOLDER/,
  );
});

test("Google runtime contains no environment-specific project, folder or master IDs", async () => {
  const runtime = await Promise.all([
    readFile(new URL("./googleWorkspaceClient.ts", import.meta.url), "utf8"),
    readFile(new URL("./requestScopedGoogleContractGeneration.ts", import.meta.url), "utf8"),
    readFile(new URL("../config/environment.ts", import.meta.url), "utf8"),
  ]).then((parts) => parts.join("\n"));
  assert.doesNotMatch(runtime, /mmbmepxftibxjsyhlgtg|qpyqqkkkparobyucnqgb|1Whhw7_JHhIsI0ZR-tCjEVt_Z4cHQUmFMYOAZub0CtSI|71000000-0000-4000-8000-00000000000[1-6]/);
});
