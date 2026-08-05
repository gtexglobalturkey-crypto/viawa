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

const { formatContractDate } = await import(
  new URL("./formatContractDate.ts", import.meta.url)
);

// Sprint 25.3 — the "DÜZENLEME TARİHİ" header cell was wrapping onto a
// second line because a raw ISO datetime (with time/ms/Z) was used
// directly. A short, deterministic dd.MM.yyyy string never wraps there.
test("formatContractDate: a full ISO datetime becomes a short dd.MM.yyyy string", () => {
  assert.equal(
    formatContractDate("2026-08-02T08:37:30.203Z"),
    "02.08.2026",
  );
});

test("formatContractDate: a date-only ISO string also formats correctly", () => {
  assert.equal(
    formatContractDate("2027-05-06"),
    "06.05.2027",
  );
});

test("formatContractDate: undefined/empty falls back to an em dash, never throws", () => {
  assert.equal(formatContractDate(undefined), "—");
  assert.equal(formatContractDate(""), "—");
});

test("formatContractDate: an unparsable string is returned as-is rather than crashing", () => {
  assert.equal(
    formatContractDate("not-a-date"),
    "not-a-date",
  );
});
