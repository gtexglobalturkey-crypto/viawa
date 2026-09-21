import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { transformWithOxc } from "vite";

const compiled = new Map();
for (const relative of ["../models/ExhibitionSalesDocument.ts", "./exhibitionSalesDocumentService.ts"]) {
  const url = new URL(relative, import.meta.url);
  compiled.set(url.href, (await transformWithOxc(readFileSync(url, "utf8"), url.pathname)).code);
}

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".")) {
        try { return next(`${specifier}.ts`, context); } catch {}
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (compiled.has(url)) return { format: "module", shortCircuit: true, source: compiled.get(url) };
    return next(url, context);
  },
});

const { getDriveFileViewUrl } = await import("../models/ExhibitionSalesDocument.ts");
const { loadExhibitionSalesDocuments } = await import("./exhibitionSalesDocumentService.ts");

const exhibitionId = "18b102f5-e606-4bf3-961b-26881a9ddca4";
const otherExhibitionId = "b416c774-5aa7-4522-97f5-ed26d14fc1d9";
const row = {
  id: "ab258f58-e337-41a1-b3c4-9d96f49d01ad",
  exhibition_id: exhibitionId,
  document_type: "floor_plan",
  title: "Exhibition floor plan",
  drive_file_id: "1Abcdefghij_klmnop-2345",
  sort_order: 10,
};

function createClient(result) {
  const calls = [];
  const query = {
    select(...args) { calls.push(["select", ...args]); return query; },
    eq(...args) { calls.push(["eq", ...args]); return query; },
    order(...args) { calls.push(["order", ...args]); return query; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  const client = { from(...args) { calls.push(["from", ...args]); return query; } };
  return { client, calls };
}

test("Drive view URLs accept bounded file IDs with only letters, digits, underscores and hyphens", () => {
  for (const fileId of ["Abcdef1234", "a_b-cD0123", "A".repeat(200)]) {
    assert.equal(getDriveFileViewUrl(fileId), `https://drive.google.com/file/d/${fileId}/view`);
  }
});

test("malformed Drive references cannot become actionable URLs", () => {
  for (const fileId of [
    "", "short", "A".repeat(9), "A".repeat(201),
    " Abcdef1234", "Abcdef1234 ", "Abcdef1234\n",
    "https://drive.google.com/file/d/Abcdef1234/view",
    "Abcdef1234/view", "Abcdef1234?download=1", "Abcdef1234#fragment",
    "javascript:alert(1)", "Abcdef1234\"onclick=", "Abcdef1234é",
  ]) {
    assert.equal(getDriveFileViewUrl(fileId), null, `reject ${JSON.stringify(fileId)}`);
  }
});

test("missing exhibition identity returns no documents without issuing an unscoped query", async () => {
  for (const missingId of ["", "   ", "\t\n"]) {
    const { client, calls } = createClient({ data: [row], error: null });
    assert.deepEqual(await loadExhibitionSalesDocuments(client, missingId), []);
    assert.deepEqual(calls, []);
  }
});

test("query is scoped to the exact exhibition and orders its records deterministically", async () => {
  const { client, calls } = createClient({ data: [row], error: null });
  assert.deepEqual(await loadExhibitionSalesDocuments(client, exhibitionId), [{
    id: row.id,
    exhibitionId,
    documentType: "floor_plan",
    title: row.title,
    driveFileId: row.drive_file_id,
    sortOrder: 10,
  }]);
  assert.deepEqual(calls[0], ["from", "exhibition_sales_documents"]);
  assert.equal(calls[1][0], "select");
  assert.deepEqual(calls.filter(([action]) => action === "eq"), [["eq", "exhibition_id", exhibitionId]]);
  assert.deepEqual(calls.filter(([action]) => action === "order"), [
    ["order", "sort_order", { ascending: true }],
    ["order", "title", { ascending: true }],
  ]);
});

test("records from another exhibition and invalid document data are omitted", async () => {
  const flyer = { ...row, id: "d11150d7-b07a-4bc4-adc5-40e67c79401e", document_type: "flyer", title: "Sales flyer", sort_order: 20 };
  const data = [
    row,
    { ...row, exhibition_id: otherExhibitionId },
    { ...row, drive_file_id: "https://example.com/file" },
    { ...row, drive_file_id: null },
    { ...row, document_type: "not a valid type" },
    { ...row, title: "" },
    { ...row, title: "   " },
    flyer,
  ];
  const { client } = createClient({ data, error: null });
  const documents = await loadExhibitionSalesDocuments(client, exhibitionId);
  assert.deepEqual(documents.map((document) => document.id), [row.id, flyer.id]);
  assert.deepEqual(documents.map((document) => document.documentType), ["floor_plan", "flyer"]);
});

test("successful empty results remain empty", async () => {
  for (const data of [[], null]) {
    const { client } = createClient({ data, error: null });
    assert.deepEqual(await loadExhibitionSalesDocuments(client, exhibitionId), []);
  }
});

test("query errors propagate instead of appearing as an empty document list", async () => {
  const { client } = createClient({ data: null, error: new Error("database unavailable") });
  await assert.rejects(loadExhibitionSalesDocuments(client, exhibitionId), /database unavailable/);
});
