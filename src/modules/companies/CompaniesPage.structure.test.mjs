import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./CompaniesPage.tsx", import.meta.url), "utf8");

test("Companies page uses compact operations and one filter row", () => {
  assert.match(source, /companies-operations/);
  assert.match(source, /companies-filter-row/);
  assert.doesNotMatch(source, /<PageHeader/);
  assert.doesNotMatch(source, /Firma Çalışma Alanı/);
  assert.doesNotMatch(source, /Açık Fırsatlar/);
  assert.doesNotMatch(source, /Bugünkü Takipler/);
  assert.match(source, /<TopbarSlot>/);
});

test("Companies operations render through the shared Topbar slot only", async () => {
  const topbar = await readFile(
    new URL("../../components/layout/Topbar.tsx", import.meta.url),
    "utf8",
  );
  const today = await readFile(
    new URL("../today/TodayPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(topbar, /<TopbarSlotOutlet/);
  assert.doesNotMatch(today, /TopbarSlot/);
});

test("List and Kanban controls and preserved list operations remain present", () => {
  for (const label of ["Kanban", "Liste", "+ Yeni Firma", "Portföy İçe Aktar", "CSV Dışa Aktar", "Yenile", "Firmayı Aç"]) {
    assert.ok(source.includes(label), label);
  }
});

test("company-level Durum filter renders only in List view", () => {
  assert.match(
    source,
    /viewMode === "list" && <label><span>Durum<\/span>/,
  );
  assert.doesNotMatch(source, /disabled=\{viewMode === "kanban"\}/);
});

test("List Durum uses the canonical four-status catalog and resolver", () => {
  assert.match(source, /COMPANY_STATUS_LABELS\.map/);
  assert.match(source, /companyStatus: resolveCompanyStatus\(companyOpportunities\)/);
  assert.doesNotMatch(
    source,
    /<option>Potansiyel Firma<\/option><option>Pasif Firma<\/option>/,
  );
});

test("loading, error retry, empty, filtered-empty, and CSV semantics remain present", () => {
  for (const text of [
    "Firmalar yükleniyor...",
    "Tekrar Dene",
    "Firma bulunamadı",
    "Eşleşen firma yok",
    "viawa-companies.csv",
    "Sonraki Aksiyon Tarihi",
  ]) assert.ok(source.includes(text), text);
});

test("Kanban does not create or update opportunities", () => {
  assert.doesNotMatch(source, /createOpportunity|updateOpportunity/);
  assert.match(source, /buildWorkspacePath/);
});

test("More Filters is a compact toggle with active count and view-specific fields", () => {
  assert.match(source, /aria-expanded=\{moreOpen\}/);
  assert.match(source, /secondaryFilterCount/);
  for (const label of [
    "Ülke", "Sonraki Aksiyon", "Aktif Fırsat",
    "İletişim Kaydı", "Görüşme Kaydı", "Kapanan Fırsatlar",
  ]) assert.ok(source.includes(label), label);
  assert.match(source, /viewMode === "list".*Aktif Fırsat/);
  assert.match(source, /viewMode === "kanban".*Kapanan Fırsatlar/);
});

test("Responsible filter and owner display mapping are absent", () => {
  assert.doesNotMatch(source, /Sorumlu|ownerFilter|buildOwnerOptions/);
});

test("clearing secondary filters preserves primary filter state", () => {
  const clearBody = source.match(/function clearSecondaryFilters\(\) \{([^}]+)\}/)?.[1] ?? "";
  assert.ok(clearBody.includes('setClosedStageFilter("active")'));
  assert.doesNotMatch(clearBody, /setExhibitionFilter|setIndustryFilter|setProductGroupFilter|setStatusFilter/);
});

test("terminal results render outside the unchanged four-column active Kanban", () => {
  assert.doesNotMatch(source, /Tamamlananlar/);
  assert.match(source, /closedStageFilter === "active" && <KanbanBoard/);
  assert.match(source, /closedStageFilter !== "active" && <ClosedOpportunityList/);
  assert.match(source, /Aktif Kanbana Dön/);
  for (const stage of ["signed", "won", "lost"]) {
    assert.ok(source.includes(`value="${stage}"`), stage);
  }
});
