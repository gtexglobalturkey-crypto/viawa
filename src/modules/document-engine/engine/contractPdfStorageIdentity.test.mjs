import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const {
  buildContractPdfStoragePath,
  computeContractPdfDocumentRecordId,
  extractGeneratedDocumentStorageIdentity,
} = await import(
  new URL("./contractPdfStorageIdentity.ts", import.meta.url)
);

// Independent re-implementation of
// document-service/src/storage/contractPdfStorage.ts::documentRecordId,
// using Node's own crypto module instead of Web Crypto — this is the
// cross-check that proves the two runtimes agree byte-for-byte.
function nodeDocumentRecordId(companyId, opportunityId, snapshotId) {
  const hex = createHash("sha256")
    .update(`participation-contract:${companyId}:${opportunityId}:${snapshotId}`)
    .digest("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

test("computeContractPdfDocumentRecordId: matches the server's Node-crypto formula for the same input", async () => {
  const companyId = "company-1";
  const opportunityId = "opp-1";
  const snapshotId = "snapshot-1";

  const expected = nodeDocumentRecordId(
    companyId,
    opportunityId,
    snapshotId,
  );

  const actual = await computeContractPdfDocumentRecordId(
    companyId,
    opportunityId,
    snapshotId,
  );

  assert.equal(actual, expected);
});

test("computeContractPdfDocumentRecordId: is deterministic for the same input", async () => {
  const first = await computeContractPdfDocumentRecordId(
    "company-1",
    "opp-1",
    "snapshot-1",
  );
  const second = await computeContractPdfDocumentRecordId(
    "company-1",
    "opp-1",
    "snapshot-1",
  );

  assert.equal(first, second);
});

test("computeContractPdfDocumentRecordId: a different snapshot id produces a different result", async () => {
  const first = await computeContractPdfDocumentRecordId(
    "company-1",
    "opp-1",
    "snapshot-1",
  );
  const second = await computeContractPdfDocumentRecordId(
    "company-1",
    "opp-1",
    "snapshot-2",
  );

  assert.notEqual(first, second);
});

test("computeContractPdfDocumentRecordId: matches the fixed uuid-v4-shaped format", async () => {
  const result = await computeContractPdfDocumentRecordId(
    "company-1",
    "opp-1",
    "snapshot-1",
  );

  assert.match(
    result,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("buildContractPdfStoragePath: joins userId/companyId/documentRecordId/fileName", () => {
  const path = buildContractPdfStoragePath(
    "user-1",
    "company-1",
    "record-id",
    "contract.pdf",
  );

  assert.equal(
    path,
    "user-1/company-1/record-id/contract.pdf",
  );
});

// BUG-S26.2.4 — Test 1: geçerli path -> hash döner.
test("extractGeneratedDocumentStorageIdentity: a well-formed path returns the 3rd segment (documentRecordId)", () => {
  const result = extractGeneratedDocumentStorageIdentity(
    "user/company/hash/file.pdf",
  );

  assert.equal(result, "hash");
});

test("extractGeneratedDocumentStorageIdentity: round-trips with buildContractPdfStoragePath", () => {
  const path = buildContractPdfStoragePath(
    "user-1",
    "company-1",
    "a1b2c3d4-e5f6-4789-8abc-def012345678",
    "Sozlesme.pdf",
  );

  assert.equal(
    extractGeneratedDocumentStorageIdentity(path),
    "a1b2c3d4-e5f6-4789-8abc-def012345678",
  );
});

// BUG-S26.2.4 — Test 2: eksik üçüncü segment -> reddedilir.
test("extractGeneratedDocumentStorageIdentity: too few segments -> null", () => {
  assert.equal(
    extractGeneratedDocumentStorageIdentity("user/company"),
    null,
  );
});

test("extractGeneratedDocumentStorageIdentity: too many segments -> null", () => {
  assert.equal(
    extractGeneratedDocumentStorageIdentity(
      "user/company/hash/sub/file.pdf",
    ),
    null,
  );
});

// BUG-S26.2.4 — Test 3: boş segment -> reddedilir.
test("extractGeneratedDocumentStorageIdentity: an empty segment -> null", () => {
  assert.equal(
    extractGeneratedDocumentStorageIdentity(
      "user/company//file.pdf",
    ),
    null,
  );
});

test("extractGeneratedDocumentStorageIdentity: a whitespace-only segment -> null", () => {
  assert.equal(
    extractGeneratedDocumentStorageIdentity(
      "user/company/   /file.pdf",
    ),
    null,
  );
});

test("extractGeneratedDocumentStorageIdentity: undefined/empty input -> null", () => {
  assert.equal(
    extractGeneratedDocumentStorageIdentity(undefined),
    null,
  );
  assert.equal(
    extractGeneratedDocumentStorageIdentity(""),
    null,
  );
});

test("extractGeneratedDocumentStorageIdentity: never URL-decodes or resolves path traversal segments", () => {
  // "%2E%2E" and ".." are returned/rejected literally — never decoded or
  // normalized, since this function only parses, it never grants trust.
  const result = extractGeneratedDocumentStorageIdentity(
    "user/company/%2E%2E/file.pdf",
  );

  assert.equal(result, "%2E%2E");
});
