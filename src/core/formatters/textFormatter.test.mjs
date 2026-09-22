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

const { splitPersonName } = await import(
  new URL("./textFormatter.ts", import.meta.url)
);

// contacts.first_name and contacts.last_name are `not null` in the
// production database (supabase/migrations/20260723000000_create_viawa_schema_baseline.sql).
// A contact whose name is blank, or a single word with no surname, must
// never produce `null` here — that previously caused createContact/
// updateContact to fail with a raw Postgres 23502 not-null-constraint
// error instead of saving.

test("splitPersonName: two-word name splits normally", () => {
  const { firstName, lastName } = splitPersonName("Ahmet Yilmaz");
  assert.equal(firstName, "Ahmet");
  assert.equal(lastName, "Yilmaz");
});

test("splitPersonName: multi-word name keeps remainder as last name", () => {
  const { firstName, lastName } = splitPersonName("Mehmet Ali Yilmaz");
  assert.equal(firstName, "Mehmet");
  assert.equal(lastName, "Ali Yilmaz");
});

test("splitPersonName: single-word name never returns null last name", () => {
  const { firstName, lastName } = splitPersonName("Ahmet");
  assert.equal(firstName, "Ahmet");
  assert.equal(lastName, "");
  assert.notEqual(lastName, null);
});

test("splitPersonName: blank name never returns null for either field", () => {
  const { firstName, lastName } = splitPersonName("   ");
  assert.equal(firstName, "");
  assert.equal(lastName, "");
  assert.notEqual(firstName, null);
  assert.notEqual(lastName, null);
});
