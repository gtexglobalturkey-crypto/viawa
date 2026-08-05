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

const { distinctExhibitionIds } = await import(
  new URL("./distinctExhibitionIds.ts", import.meta.url)
);

// Kritik Akış Düzeltmesi 10 — the exact rule behind "Fuar Dosyaları":
// one card per real repository (exhibition), never one per opportunity.

test("5 opportunities for the same exhibition: exactly one distinct id", () => {
  const items = [
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-1" },
  ];

  assert.deepEqual(
    distinctExhibitionIds(items),
    ["ex-1"],
  );
});

test("two different exhibitions: two distinct ids, in first-seen order", () => {
  const items = [
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-2" },
    { exhibition_id: "ex-1" },
    { exhibition_id: "ex-2" },
    { exhibition_id: "ex-1" },
  ];

  assert.deepEqual(
    distinctExhibitionIds(items),
    ["ex-1", "ex-2"],
  );
});

test("opportunities with no exhibition_id are skipped entirely", () => {
  const items = [
    { exhibition_id: null },
    { exhibition_id: undefined },
    { exhibition_id: "ex-1" },
  ];

  assert.deepEqual(
    distinctExhibitionIds(items),
    ["ex-1"],
  );
});

test("empty input: empty output", () => {
  assert.deepEqual(
    distinctExhibitionIds([]),
    [],
  );
});
