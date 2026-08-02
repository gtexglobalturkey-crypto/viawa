import assert from "node:assert/strict";
import test from "node:test";

const {
  convertDocxToPdf,
} = await import(
  new URL("./docxToPdfConverterPort.ts", import.meta.url)
);
const {
  DocxToPdfConversionError,
} = await import(
  new URL("./models.ts", import.meta.url)
);

const docx = () => Buffer.from("PK-mock-docx");

async function expectCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof DocxToPdfConversionError);
    assert.equal(error.code, code);
    return true;
  });
}

test("rejects an empty DOCX before calling the converter", async () => {
  let calls = 0;
  await assert.rejects(
    () => convertDocxToPdf({
      async convert() {
        calls += 1;
        return Buffer.from("%PDF-mock");
      },
    }, Buffer.alloc(0)),
    "EMPTY_DOCX_INPUT",
  );
  assert.equal(calls, 0);
});

test("rejects empty and invalid PDF output", async () => {
  await assert.rejects(
    () => convertDocxToPdf({ async convert() { return Buffer.alloc(0); } }, docx()),
    "EMPTY_PDF_OUTPUT",
  );
  await expectCode(
    () => convertDocxToPdf({ async convert() { return Buffer.from("not-pdf"); } }, docx()),
    "INVALID_PDF_OUTPUT",
  );
});

test("accepts and returns a valid PDF buffer unchanged", async () => {
  const expected = Buffer.from("%PDF-1.7 mock");
  const result = await convertDocxToPdf(
    { async convert() { return expected; } },
    docx(),
  );
  assert.strictEqual(result, expected);
});

test("keeps caller input unchanged and detects converter mutation", async () => {
  const input = docx();
  const before = Buffer.from(input);
  await expectCode(
    () => convertDocxToPdf({
      async convert(received) {
        received[0] = 0;
        return Buffer.from("%PDF-mock");
      },
    }, input),
    "INPUT_MUTATED",
  );
  assert.deepEqual(input, before);
});

test("preserves a distinguishable timeout error and forwards options", async () => {
  let receivedOptions;
  const secret = "CONFIDENTIAL-TIMEOUT-CONTENT";
  await assert.rejects(
    () => convertDocxToPdf({
      async convert(_input, options) {
        receivedOptions = options;
        throw new DocxToPdfConversionError(
          "TIMEOUT",
          `PDF conversion timed out for ${secret}.`,
        );
      },
    }, docx(), { timeoutMs: 5_000 }),
    (error) => {
      assert.ok(error instanceof DocxToPdfConversionError);
      assert.equal(error.code, "TIMEOUT");
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    },
  );
  assert.deepEqual(receivedOptions, { timeoutMs: 5_000 });
});

test("wraps runtime failures without leaking document content", async () => {
  const secret = "CONFIDENTIAL-DOCUMENT-CONTENT";
  await assert.rejects(
    () => convertDocxToPdf({
      async convert() {
        throw new Error(`Runtime failed for ${secret}`);
      },
    }, Buffer.from(secret)),
    (error) => {
      assert.ok(error instanceof DocxToPdfConversionError);
      assert.equal(error.code, "CONVERSION_FAILED");
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    },
  );
});
