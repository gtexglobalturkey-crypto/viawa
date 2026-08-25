import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./create-contract-smoke-fixtures.ps1", import.meta.url), "utf8");

test("Windows PowerShell staging fixture source is ASCII-safe and contains the Turkish probe escapes", () => {
  assert.equal(/[^\x00-\x7f]/u.test(source), false);
  for (const escape of ["\\u00c7", "\\u011e", "\\u0130", "\\u00d6", "\\u015e", "\\u00dc", "\\u00e7", "\\u011f", "\\u0131", "\\u00f6", "\\u015f", "\\u00fc"]) {
    assert.equal(source.includes(escape), true, `missing ${escape}`);
  }
});
