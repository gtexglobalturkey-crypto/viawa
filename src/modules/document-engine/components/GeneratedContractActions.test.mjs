import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { transformWithOxc } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const componentUrl = new URL("./GeneratedContractActions.tsx", import.meta.url);
const transformed = await transformWithOxc(readFileSync(componentUrl, "utf8"), "GeneratedContractActions.tsx", { jsx: { runtime: "automatic" } });
const compiled = new Map([[componentUrl.href, transformed.code]]);
for (const relative of ["./ContractPreviewModal.tsx", "../templates/participation-contract/ParticipationContractDocument.tsx"]) {
  const url = new URL(relative, import.meta.url);
  compiled.set(url.href, (await transformWithOxc(readFileSync(url, "utf8"), url.pathname, { jsx: { runtime: "automatic" } })).code);
}

registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".")) {
        for (const extension of [".ts", ".tsx"]) {
          try { return next(`${specifier}${extension}`, context); } catch {}
        }
      }
      throw error;
    }
  },
  load(url, context, next) {
    if (url.endsWith("/services/supabase/client.ts")) return { format: "module", shortCircuit: true, source: "export const supabase = {};" };
    if (compiled.has(url)) return { format: "module", shortCircuit: true, source: compiled.get(url) };
    return next(url, context);
  },
});
const { GeneratedContractActions } = await import("./GeneratedContractActions.tsx");
const record = { id: "current", fileName: "current.pdf", masterTemplateId: "master", googleDocFileId: "copy", googleDocUrl: "https://docs.google.com/document/d/copy/edit?usp=drivesdk", storagePath: "owner/company/current/contract.pdf" };

test("rendered handoff exposes real generated Docs URL as primary and matching PDF download as secondary", () => {
  const html = renderToStaticMarkup(React.createElement(GeneratedContractActions, { record }));
  assert.ok(html.includes(`href="${record.googleDocUrl}"`));
  assert.match(html, /Google Docs&#x27;ta Aç/);
  assert.ok(html.indexOf("Google Docs") < html.indexOf("PDF İndir"));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /Send for Signature|İmzaya Gönder|dropbox|adobe|\/d\/master/);
});

test("master reference cannot produce an actionable Docs link", () => {
  const html = renderToStaticMarkup(React.createElement(GeneratedContractActions, { record: { ...record, googleDocFileId: "master" } }));
  assert.doesNotMatch(html, /Google Docs|href=/);
  assert.match(html, /PDF İndir/);
});

const { ContractPreviewModal } = await import("./ContractPreviewModal.tsx");
test("reopened modal renders persisted history and Docs/PDF handoff without a browser PDF cache", () => {
  const persisted = { ...record, documentType: "participation-contract", companyId: "company", opportunityId: "opportunity", exhibitionId: "fair", contractNumber: "EXP-2027-000127", version: 7, createdAt: "2026-09-06T10:00:00Z", status: "completed", approvedSnapshotId: "opportunity:fair" };
  const priceInput = { standAreaSqm: 12, standType: "space-only", standLocationType: "standard" };
  const priceResult = { currency: "EUR", grandTotal: 120, sqmAmount: 120, locationSurcharge: 0, additionalServicesFee: 0, registrationFee: 0, serviceFee: 0, discountAmount: 0, vatAmount: 0 };
  const contractDraft = { company: { companyId: "company", companyName: "Sentetik ÇĞİÖŞÜ" }, contacts: {}, exhibition: { exhibitionId: "fair", exhibitionName: "Sentetik Fuar", startDate: "2027-01-01" }, opportunityId: "opportunity", price: { priceInput, priceResult }, currency: "EUR" };
  const html = renderToStaticMarkup(React.createElement(ContractPreviewModal, { open: true, contractDraft, approvedSnapshot: { opportunityId: "opportunity", exhibitionId: "fair", priceInput, priceResult }, existingRecords: [persisted], standMaterials: null, extraInformation: null, paymentPlan: null }));
  assert.match(html, /Sözleşme geçmişi/);
  assert.match(html, /EXP-2027-000127/);
  assert.match(html, /v7 kaydedildi/);
  assert.ok(html.includes(`href="${record.googleDocUrl}"`));
  assert.match(html, /PDF İndir/);
  assert.doesNotMatch(html, /<iframe|Gerçek PDF önizleniyor/);
});
