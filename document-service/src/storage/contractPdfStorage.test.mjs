import assert from "node:assert/strict";
import test from "node:test";

const { safeFileName } = await import(
  new URL("./contractPdfStorage.ts", import.meta.url)
);

const ASCII_ONLY = /^[\x00-\x7F]*$/;

test("Turkish characters in the company name produce an ASCII-only storage key", () => {
  const result = safeFileName(
    "Contract_Expovıa_Uluslararası_Fuarcılık_Teknoloji_İç_ve_Dış_Tic._Ltd._Şti._west_african_fair_20260801_085933.pdf",
  );

  assert.match(result, ASCII_ONLY);
  assert.match(result, /\.pdf$/i);
  assert.ok(result.length > 0);
});

test("path separators and newlines are removed", () => {
  const result = safeFileName("..\\..\\evil/name\r\n.pdf");

  assert.ok(!result.includes("/"));
  assert.ok(!result.includes("\\"));
  assert.ok(!result.includes("\r"));
  assert.ok(!result.includes("\n"));
});

test(".pdf extension is retained for a valid ASCII name", () => {
  assert.match(safeFileName("Contract_Acme_2026.pdf"), /\.pdf$/);
});

test("filename length limit remains enforced", () => {
  const tooLong = `${"a".repeat(150)}.pdf`;
  assert.equal(safeFileName(tooLong), "contract.pdf");

  const atLimit = `${"a".repeat(116)}.pdf`;
  assert.equal(atLimit.length, 120);
  assert.equal(safeFileName(atLimit), atLimit);
});

test("a fully non-ASCII name falls back to the deterministic safe filename", () => {
  assert.equal(safeFileName("合同名称.pdf"), "contract.pdf");
  assert.equal(safeFileName("مستند.pdf"), "contract.pdf");
});

test("an empty or whitespace-only name falls back to the deterministic safe filename", () => {
  assert.equal(safeFileName(""), "contract.pdf");
  assert.equal(safeFileName("   "), "contract.pdf");
  assert.equal(safeFileName(".pdf"), "contract.pdf");
});

test("ASCII-only existing filenames remain stable (no unnecessary mutation)", () => {
  const stable = "Contract_Acme_Corp_2026-08-01.pdf";
  assert.equal(safeFileName(stable), stable);
});

test("a name that is not a .pdf falls back to the deterministic safe filename", () => {
  assert.equal(safeFileName("Contract_Acme.docx"), "contract.pdf");
});
