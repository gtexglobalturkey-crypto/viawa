import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const source = await import(new URL("./searchMatchers.ts", import.meta.url));

test("global search matcher supports Turkish case-insensitive company/contact/email/phone values", () => {
  assert.equal(source.matchesSearchText("ABC Madencilik", "madencilik"), true);
  assert.equal(source.matchesSearchText("İpek Yılmaz", "ipek"), true);
  assert.equal(source.matchesSearchText("sales@example.com", "example"), true);
  assert.equal(source.matchesSearchText("+90 555 123", "555"), true);
});

test("global search service includes company, real-contact, email, phone, country, industry, and fair sources", async () => {
  const service = await readFile(new URL("./searchService.ts", import.meta.url), "utf8");
  for (const token of [
    "company.company_name", "getContacts()", "contact.first_name",
    "company.email", "contact.email", "company.phone", "contact.phone",
    "company.country", "company.industry", "exhibition.name",
  ]) assert.ok(service.includes(token), token);
});
