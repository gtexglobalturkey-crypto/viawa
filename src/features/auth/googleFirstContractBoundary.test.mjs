import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("active application and server code contain no Dropbox signing runtime", async () => {
  for (const path of [
    "src/modules/call-workspace/CustomerWorkspace.tsx",
    "src/modules/call-workspace/hooks/useWorkspaceEmailDraft.ts",
    "document-service/src/config/environment.ts",
    "document-service/src/server.ts",
  ]) {
    assert.doesNotMatch(await source(path), /dropbox|DROPBOX_SIGN|sendForSignature/i);
  }
  await assert.rejects(access(new URL("supabase/functions/dropbox-sign-send/index.ts", root)));
  await assert.rejects(access(new URL("src/modules/document-engine/services/dropboxSignService.ts", root)));
});

test("Google-first generation finishes COMPLETED and blanks the customer signature token", async () => {
  const repository = await source("src/modules/document-engine/repositories/generatedDocumentRepository.ts");
  const placeholders = await source("src/modules/document-engine/google/googleContractPlaceholders.ts");
  assert.match(repository, /generation_status:\s*"COMPLETED"/);
  assert.doesNotMatch(repository, /READY_FOR_SIGNATURE|signing_status/);
  assert.match(placeholders, /CSG:\s*""/);
  assert.match(placeholders, /ALLOWED_UNRESOLVED_GOOGLE_CONTRACT_TOKENS = new Set<string>\(\)/);
});
