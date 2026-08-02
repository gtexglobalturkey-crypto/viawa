import assert from "node:assert/strict";
import test from "node:test";

const { createPdfAdapter } = await import(
  new URL("./pdfAdapter.ts", import.meta.url)
);

test("passes one resolved merge result through DOCX generation and conversion", async () => {
  const mergeResult = {
    documentType: "participation-contract",
    templateFileName: "contract.docx",
    values: {
      "Company.LegalName": "ABC Madencilik",
      "StandMaterials.Table.Selected": true,
      "Pricing.GrandTotal.Amount": 9810,
    },
    missingRequiredTags: [],
  };
  const docxBuffer = Buffer.from("mock-docx");
  const pdfBuffer = Buffer.from("%PDF-mock");
  let docxCalls = 0;
  let converterCalls = 0;
  let receivedMergeResult;
  let receivedDocxBuffer;

  const adapter = createPdfAdapter(
    {
      async generate(input) {
        docxCalls += 1;
        receivedMergeResult = input;
        return { docxBuffer };
      },
    },
    {
      async convert(input) {
        converterCalls += 1;
        receivedDocxBuffer = input;
        return pdfBuffer;
      },
    },
  );

  const result = await adapter.generate(mergeResult);

  assert.equal(docxCalls, 1);
  assert.equal(converterCalls, 1);
  assert.strictEqual(receivedMergeResult, mergeResult);
  assert.deepEqual(receivedDocxBuffer, docxBuffer);
  assert.strictEqual(result.pdfBuffer, pdfBuffer);
  assert.deepEqual(result.warnings, []);
});

test("has no business, merge-engine, endpoint, or filesystem dependency", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("./pdfAdapter.ts", import.meta.url), "utf8"),
  );

  assert.doesNotMatch(source, /resolveTemplateMerge|repository|supabase/i);
  assert.doesNotMatch(source, /node:fs|node:os|node:path|mkdtemp|writeFile/i);
  assert.doesNotMatch(source, /http|endpoint|request|response/i);
});
