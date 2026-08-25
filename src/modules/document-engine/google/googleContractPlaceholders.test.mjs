import assert from "node:assert/strict";
import test from "node:test";

import { buildGoogleContractPlaceholderMap, findDisallowedUnresolvedPlaceholders, formatGoogleContractStandArea, validateGoogleContractPlaceholderMap } from "./googleContractPlaceholders.ts";

function merge(values) { return { documentType: "participation-contract", templateFileName: "x", missingRequiredTags: [], values }; }

test("placeholder mapping fills optional and unused installment cells neutrally", () => {
  const result = buildGoogleContractPlaceholderMap(merge({
    "Template.sozlesme_no": "EXP-2026-000001", "Template.sozlesme_tarihi": "25.08.2026",
    "Template.fuar_adi": "Test Fuarı", "Company.LegalName": "Test AŞ",
    "Contact.SignatoryName": "Ada Test", "Contact.SignatoryTitle": "Genel Müdür",
    "Pricing.GrandTotal.Currency": "EUR", "PaymentPlan.Payment1.Amount": 100,
  }));
  assert.equal(result.COMPANY_WEBSITE, "-");
  assert.equal(result.A2, "-");
  assert.equal(result.P2, "-");
  assert.equal(result.P1, "EUR");
  assert.equal(result.CSG, "");
  assert.deepEqual(validateGoogleContractPlaceholderMap(result), []);
});

test("missing business-critical fields are identified", () => {
  const result = buildGoogleContractPlaceholderMap(merge({}));
  assert.deepEqual(validateGoogleContractPlaceholderMap(result), ["CNO", "CDT", "FNM", "COMPANY_LEGAL_NAME", "CSN", "CST"]);
});

test("no raw placeholder, including customer signature, may remain unresolved", () => {
  assert.deepEqual(findDisallowedUnresolvedPlaceholders("bad {{CSG}} {{CDT}} {{CDT}}"), ["{{CSG}}", "{{CDT}}"]);
});

test("Turkish Unicode values are preserved through the Google merge model", () => {
  const probe = "\u00c7\u011e\u0130\u00d6\u015e\u00dc \u00e7\u011f\u0131\u00f6\u015f\u00fc";
  const result = buildGoogleContractPlaceholderMap(merge({
    "Template.sozlesme_no": "EXP-2027-000001",
    "Template.sozlesme_tarihi": "25.08.2026",
    "Template.fuar_adi": probe,
    "Company.LegalName": probe,
    "Contact.SignatoryName": probe,
    "Contact.SignatoryTitle": probe,
  }));
  assert.equal(result.FNM, probe);
  assert.equal(result.COMPANY_LEGAL_NAME, probe);
  assert.equal(result.CSN, probe);
  assert.equal(result.CST, probe);
});

test("Google contract stand area uses square metres without insignificant decimals", () => {
  assert.equal(formatGoogleContractStandArea(12), "12 m²");
  assert.equal(formatGoogleContractStandArea(12.5), "12.5 m²");
  assert.equal(formatGoogleContractStandArea("12.50"), "12.5 m²");
  assert.equal(buildGoogleContractPlaceholderMap(merge({ "Template.stand_alani": 12 })).SAR, "12 m²");
});
