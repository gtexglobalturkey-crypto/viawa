import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { transformWithOxc } from "vite";

const apiUrl = new URL("./exhibitionDocumentApi.ts", import.meta.url);
const compiled = (await transformWithOxc(readFileSync(apiUrl, "utf8"), apiUrl.pathname)).code;

registerHooks({
  load(url, context, next) {
    if (url === apiUrl.href) return { format: "module", shortCircuit: true, source: compiled };
    return next(url, context);
  },
});

const { DocumentServiceUnavailableError, fetchExhibitionDocumentStatus } = await import(apiUrl.href);
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

const SPA_HTML = '<!doctype html>\n<html lang="en"><head><title>VIAWA</title></head><body></body></html>';

test("the SPA fallback (200 text/html) is reported as an unavailable document service, not parsed as JSON", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(SPA_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  };

  await assert.rejects(
    fetchExhibitionDocumentStatus("WAMPEX 2027", "WAMPEX 2027"),
    (error) => {
      assert.ok(error instanceof DocumentServiceUnavailableError);
      assert.doesNotMatch(error.message, /Unexpected token|doctype|JSON/i);
      return true;
    },
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^\/api\/document-basket\/status\?/);
});

test("a JSON response from the local document service is still parsed", async () => {
  const items = [{ id: "flyer", title: "Flyer", exists: true, fileName: "flyer.pdf" }];
  globalThis.fetch = async () => new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  assert.deepEqual(await fetchExhibitionDocumentStatus("Expo"), items);
});

test("real HTTP failures are not classified as an unavailable service", async () => {
  globalThis.fetch = async () => new Response("boom", { status: 500, headers: { "Content-Type": "text/plain" } });

  await assert.rejects(
    fetchExhibitionDocumentStatus("Expo"),
    (error) => {
      assert.ok(!(error instanceof DocumentServiceUnavailableError));
      assert.equal(error.message, "Fuar belgeleri durumu alınamadı.");
      return true;
    },
  );
});

test("malformed JSON from a JSON-typed response still fails loudly", async () => {
  globalThis.fetch = async () => new Response("{not json", { status: 200, headers: { "Content-Type": "application/json" } });

  await assert.rejects(fetchExhibitionDocumentStatus("Expo"), SyntaxError);
});
