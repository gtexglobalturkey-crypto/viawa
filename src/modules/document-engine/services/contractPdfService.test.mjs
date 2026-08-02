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

const { describeContractPdfFailure } = await import(
  new URL("./contractPdfService.ts", import.meta.url)
);

function failure(overrides = {}) {
  return {
    ok: false,
    code: "CONTRACT_GENERATION_FAILED",
    message: "raw server message",
    validationErrors: [],
    ...overrides,
  };
}

test("describeContractPdfFailure: maps APPROVED_PRICE_NOT_FOUND to the existing client-side wording", () => {
  const message = describeContractPdfFailure(
    failure({
      code: "CONTRACT_VALIDATION_FAILED",
      validationErrors: [
        { code: "APPROVED_PRICE_NOT_FOUND", message: "raw" },
      ],
    }),
  );

  assert.equal(
    message,
    "Seçili fuar için onaylanmış fiyat bulunamadı.",
  );
});

test("describeContractPdfFailure: maps a known top-level code", () => {
  const message = describeContractPdfFailure(
    failure({ code: "OPPORTUNITY_ACCESS_DENIED" }),
  );

  assert.equal(message, "Bu fırsata erişim yetkiniz yok.");
});

test("describeContractPdfFailure: unknown code falls back to a generic, non-raw message", () => {
  const message = describeContractPdfFailure(
    failure({
      code: "SOME_UNMAPPED_CODE",
      message: "raw internal stack trace or DB error",
    }),
  );

  assert.equal(
    message,
    "Sözleşme PDF'i oluşturulamadı. Lütfen tekrar deneyin.",
  );
  assert.doesNotMatch(message, /stack trace|DB error/);
});

test("describeContractPdfFailure: never surfaces the raw failure.message", () => {
  const message = describeContractPdfFailure(
    failure({
      code: "CONTRACT_GENERATION_FAILED",
      message: "Error: ENOENT libreoffice binary not found at /usr/bin/soffice",
    }),
  );

  assert.doesNotMatch(message, /ENOENT|soffice/);
});

test("describeContractPdfFailure: first mappable validation error wins when several are present", () => {
  const message = describeContractPdfFailure(
    failure({
      code: "CONTRACT_VALIDATION_FAILED",
      validationErrors: [
        { code: "SOME_UNMAPPED_CODE", message: "raw" },
        { code: "SIGNATORY_CONTACT_NOT_FOUND", message: "raw" },
      ],
    }),
  );

  assert.equal(
    message,
    "Sözleşme için imza yetkilisi bulunamadı.",
  );
});
