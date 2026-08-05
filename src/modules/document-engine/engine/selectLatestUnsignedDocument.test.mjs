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

const { selectLatestUnsignedDocument } = await import(
  new URL("./selectLatestUnsignedDocument.ts", import.meta.url)
);

function record(id, opportunityId, version, status) {
  return {
    id,
    documentType: "participation-contract",
    contractNumber: "EXP-2027-000001",
    version,
    companyId: "company-1",
    exhibitionId: "ex-1",
    opportunityId,
    approvedSnapshotId: "snapshot-1",
    fileName: `${id}.pdf`,
    status,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

// RC-01 — the exact rule "Kazanıldı" (and "🟢 Katılım Onaylandı") use to
// find which real Katılım Belgesi to attach a signed PDF to.

test("no documents at all for this opportunity: null", () => {
  const result = selectLatestUnsignedDocument(
    [],
    "opp-1",
  );

  assert.equal(result, null);
});

test("a single unsigned document: it is selected", () => {
  const doc = record(
    "d1",
    "opp-1",
    1,
    "pdf-generated",
  );

  const result = selectLatestUnsignedDocument(
    [doc],
    "opp-1",
  );

  assert.equal(result.id, "d1");
});

test("multiple versions, none signed: the highest version wins", () => {
  const result = selectLatestUnsignedDocument(
    [
      record("v1", "opp-1", 1, "pdf-generated"),
      record("v3", "opp-1", 3, "pdf-generated"),
      record("v2", "opp-1", 2, "pdf-generated"),
    ],
    "opp-1",
  );

  assert.equal(result.id, "v3");
});

test("already-signed documents are never selected", () => {
  const result = selectLatestUnsignedDocument(
    [
      record("v1", "opp-1", 1, "pdf-generated"),
      record("v2-signed", "opp-1", 2, "signed"),
    ],
    "opp-1",
  );

  // v2 is signed and excluded, so the highest remaining unsigned is v1.
  assert.equal(result.id, "v1");
});

test("every version already signed: null (nothing left to confirm)", () => {
  const result = selectLatestUnsignedDocument(
    [record("v1-signed", "opp-1", 1, "signed")],
    "opp-1",
  );

  assert.equal(result, null);
});

test("documents belonging to a different opportunity are never selected", () => {
  const result = selectLatestUnsignedDocument(
    [
      record(
        "other-opp",
        "opp-2",
        5,
        "pdf-generated",
      ),
    ],
    "opp-1",
  );

  assert.equal(result, null);
});
