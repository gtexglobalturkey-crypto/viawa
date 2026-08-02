import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const enabled = process.env.RUN_LIBREOFFICE_INTEGRATION === "1";

test("converts the real master DOCX with LibreOffice", {
  skip: enabled ? false : "Set RUN_LIBREOFFICE_INTEGRATION=1 to run.",
}, async () => {
  const { createLibreOfficeDocxToPdfConverter } = await import(
    new URL("./libreOfficeDocxToPdfConverter.ts", import.meta.url)
  );
  const { convertDocxToPdf } = await import(
    new URL("../../../vite-plugins/document-pdf/docxToPdfConverterPort.ts", import.meta.url)
  );
  const tempRoot = await mkdtemp(path.join(tmpdir(), "viawa-lo-integration-"));
  try {
    const master = await readFile(path.resolve(
      "resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx",
    ));
    const converter = createLibreOfficeDocxToPdfConverter({
      binaryPath: process.env.LIBREOFFICE_BINARY_PATH,
      tempRoot,
      defaultTimeoutMs: Number(process.env.PDF_CONVERSION_TIMEOUT_MS) || 30_000,
    });
    const pdf = await convertDocxToPdf(converter, master);
    assert.ok(pdf.length > 5);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
