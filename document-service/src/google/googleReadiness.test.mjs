import { registerHooks } from "node:module";
registerHooks({resolve(s,c,next){try{return next(s,c)}catch(e){if(s.startsWith(".")&&!s.endsWith(".ts"))return next(s+".ts",c);throw e;}}});
import assert from "node:assert/strict";
import test from "node:test";
const { checkGoogleReadiness } = await import("./googleReadiness.ts");

const config = { clientId: "client", clientSecret: "secret", refreshToken: "refresh", masterContractTemplateId: "master", generatedDocumentsFolderId: "output" };
function mock({ fail, master = {}, folder = {} } = {}) {
  const calls = [];
  return { calls, request: async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET" });
    assert.ok(init.signal);
    if (url.includes(fail ?? "never-match")) return new Response("private provider detail", { status: 403 });
    if (url.includes("oauth2")) return Response.json({ access_token: "private-token" });
    if (url.includes("docs.googleapis")) return Response.json({ documentId: "master" });
    if (url.includes("/master?")) return Response.json({ id: "master", mimeType: "application/vnd.google-apps.document", capabilities: { canCopy: true, canDownload: true }, ...master });
    return Response.json({ id: "output", mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: true }, ...folder });
  } };
}

test("readiness refreshes OAuth and reads Docs/master/folder capabilities without creating documents", async () => {
  const state = mock();
  const result = await checkGoogleReadiness(config, state.request);
  assert.ok(Object.values(result).every((value) => value === "ok"));
  assert.equal(state.calls.length, 4);
  assert.ok(state.calls.every(({ url, method }) => url.includes("oauth2") ? method === "POST" : method === "GET"));
  assert.ok(state.calls.every(({ url }) => !/copy|batchUpdate|upload/.test(url)));
});

test("missing/equal-ID config fails before provider access", async () => {
  const state = mock();
  assert.equal((await checkGoogleReadiness(undefined, state.request)).configuration, "missing");
  assert.equal((await checkGoogleReadiness({ ...config, generatedDocumentsFolderId: "master" }, state.request)).configuration, "invalid");
  assert.equal(state.calls.length, 0);
});

test("the folder containing the master is not a generated-documents destination", async () => {
  const result = await checkGoogleReadiness(config, mock({ master: { parents: ["output"] } }).request);
  assert.equal(result.configuration, "invalid");
  assert.equal(result.master, "unavailable");
});

for (const [name, overrides, check] of [
  ["OAuth denial", { fail: "oauth2" }, "authentication"],
  ["Docs read denial", { fail: "docs.googleapis" }, "master"],
  ["master cannot copy", { master: { capabilities: { canCopy: false } } }, "master"],
  ["master is trashed", { master: { trashed: true } }, "master"],
  ["folder cannot accept files", { folder: { capabilities: { canAddChildren: false } } }, "folder"],
  ["folder is actually a document", { folder: { mimeType: "application/vnd.google-apps.document" } }, "folder"],
]) test(`readiness reports ${name} without exposing provider details`, async () => {
  const result = await checkGoogleReadiness(config, mock(overrides).request);
  assert.equal(result[check], "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /private|secret|refresh/);
});
