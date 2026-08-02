import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { FunctionsHttpError } = await import("@supabase/supabase-js");

const {
  getSendForSignatureErrorMessage,
  parseSendForSignatureResponse,
} = await import(
  new URL("./dropboxSignResponseParsing.ts", import.meta.url)
);

function successBody(overrides = {}) {
  return {
    ok: true,
    provider: "dropbox-sign",
    signatureRequestId: "req-1",
    signatureRequestUrl: null,
    testMode: true,
    ...overrides,
  };
}

test("parseSendForSignatureResponse: valid test-mode response is parsed", () => {
  const result = parseSendForSignatureResponse(
    successBody({ testMode: true }),
  );

  assert.equal(result.signatureRequestId, "req-1");
  assert.equal(result.testMode, true);
});

test("parseSendForSignatureResponse: valid production response is parsed", () => {
  const result = parseSendForSignatureResponse(
    successBody({ testMode: false }),
  );

  assert.equal(result.testMode, false);
});

test("parseSendForSignatureResponse: missing testMode field fails safe to true", () => {
  const body = successBody();
  delete body.testMode;

  const result = parseSendForSignatureResponse(body);

  assert.equal(result.testMode, true);
});

test("parseSendForSignatureResponse: malformed response -> null", () => {
  assert.equal(parseSendForSignatureResponse(null), null);
  assert.equal(parseSendForSignatureResponse({}), null);
  assert.equal(
    parseSendForSignatureResponse({ ok: false }),
    null,
  );
});

test("parseSendForSignatureResponse: never invents a signatureRequestId", () => {
  const body = successBody();
  delete body.signatureRequestId;

  assert.equal(parseSendForSignatureResponse(body), null);
});

// SPRINT 26.2.2 — Test: eksik API key -> sahte başarı yok (501 maps to
// the specific "not configured" message, never a fabricated success).
// BUG-S26.2.7 — 400 (genuinely malformed storage download response)
// maps to its own, distinct, non-technical message.
test("getSendForSignatureErrorMessage: 400 (storage download malformed) maps to a clean, distinct message", () => {
  const message = getSendForSignatureErrorMessage(
    new FunctionsHttpError({
      status: 400,
      error: "Contract document request was invalid.",
    }),
  );

  assert.equal(
    message,
    "Sözleşme dosyasına erişilemedi. Belge kaydını yeniden oluşturup tekrar deneyin.",
  );
});

test("getSendForSignatureErrorMessage: 404 uses the exact required wording", () => {
  const message = getSendForSignatureErrorMessage(
    new FunctionsHttpError({ status: 404 }),
  );

  assert.equal(
    message,
    "Sözleşme PDF'i depolamada bulunamadı.",
  );
});

// BUG-S26.2.4 — Test 8: 422 kullanıcı mesajı doğru ve ham teknik detay
// içermiyor.
test("getSendForSignatureErrorMessage: 422 (storage path ownership mismatch) maps to a clean, non-technical message", () => {
  const message = getSendForSignatureErrorMessage(
    new FunctionsHttpError({
      status: 422,
      error: "Contract document path is invalid.",
    }),
  );

  assert.equal(
    message,
    "Sözleşme dosyası doğrulanamadı. Lütfen belgeyi yeniden oluşturup tekrar deneyin.",
  );
  assert.doesNotMatch(
    message,
    /path|hash|storage|Contract document/i,
  );
});

test("getSendForSignatureErrorMessage: 501 (not configured) maps to the specific message", () => {
  const error = new FunctionsHttpError({ status: 501 });

  assert.equal(
    getSendForSignatureErrorMessage(error),
    "E-imza hizmeti henüz yapılandırılmamıştır.",
  );
});

test("getSendForSignatureErrorMessage: 401/403/404/429/503/504 map to their existing specific messages", () => {
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 401 }),
    ),
    /Oturum doğrulanamadı/,
  );
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 403 }),
    ),
    /erişim izniniz yok/,
  );
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 404 }),
    ),
    /bulunamadı/,
  );
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 429 }),
    ),
    /yoğun/,
  );
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 503 }),
    ),
    /yoğun/,
  );
  assert.match(
    getSendForSignatureErrorMessage(
      new FunctionsHttpError({ status: 504 }),
    ),
    /zaman aşımına/,
  );
});

test("getSendForSignatureErrorMessage: an unknown/non-HTTP error falls back to the generic message, never a raw error", () => {
  const message = getSendForSignatureErrorMessage(
    new Error("ECONNRESET at 10.0.0.4:443 stack trace ..."),
  );

  assert.equal(message, "İmza isteği gönderilemedi.");
  assert.doesNotMatch(message, /ECONNRESET|10\.0\.0\.4/);
});
