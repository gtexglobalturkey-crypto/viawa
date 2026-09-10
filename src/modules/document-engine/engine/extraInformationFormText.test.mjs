import test from "node:test";
import assert from "node:assert/strict";
import { extraInformationFormText } from "./extraInformationFormText.ts";

test("staging fixture metadata and non-array JSON do not crash form initialization", () => {
  for (const value of [{ fixture: "synthetic-staging-only" }, null, undefined, 42, "note"]) {
    assert.equal(extraInformationFormText(value), "");
  }
});

test("valid notes retain their text and order while malformed JSON elements are ignored", () => {
  assert.equal(extraInformationFormText(["First", null, 42, {}, " ", " Second "]), "First\n Second ");
  assert.equal(extraInformationFormText([]), "");
});
