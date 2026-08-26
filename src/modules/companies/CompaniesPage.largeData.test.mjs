import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("./CompaniesPage.tsx", import.meta.url), "utf8");
const companyService = await readFile(new URL("../../services/supabase/companyService.ts", import.meta.url), "utf8");
const opportunityService = await readFile(new URL("../../services/supabase/opportunityService.ts", import.meta.url), "utf8");
const importService = await readFile(new URL("../import-portfolio/services/importService.ts", import.meta.url), "utf8");
const reader = await readFile(new URL("../import-portfolio/services/excelReader.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../../../supabase/migrations/20260827090000_add_company_directory_query.sql", import.meta.url), "utf8");

test("company list is a deterministic 50-row server-side page with total count", () => {
  assert.match(companyService, /COMPANY_PAGE_SIZE = 50/);
  assert.match(companyService, /list_company_directory_page/);
  assert.match(migration, /count\(\*\) over\(\) as total_count/i);
  assert.match(migration, /order by f\.company_name, f\.id/i);
  assert.match(migration, /limit greatest/);
  assert.doesNotMatch(page, /getCompanies\(\)|getOpportunities\(\)|getContacts\(\)|getCallNotes\(\)|listCompanySectorRelations/);
});

test("canonical search and filters execute in the database", () => {
  for (const field of ["company_name", "email", "phone", "website", "city", "country"]) assert.ok(migration.includes(field), field);
  for (const parameter of ["p_country", "p_city", "p_sector_id", "p_product_group_id", "p_communication"]) assert.ok(migration.includes(parameter), parameter);
  for (const value of ["email", "phone", "either", "both", "none"]) assert.ok(page.includes(`value=\"${value}\"`), value);
  assert.match(migration, /company_sectors/);
  assert.match(page, /Daha Fazla Filtre/);
});

test("Kanban fetch is selected-fair-only and never fabricates opportunities", () => {
  assert.match(opportunityService, /getOpportunitiesByExhibition[\s\S]*\.eq\("exhibition_id", exhibitionId\)/);
  assert.match(page, /getOpportunitiesByExhibition\(exhibitionId\)/);
  assert.match(page, /!exhibitionId/);
  assert.doesNotMatch(page, /createOpportunity|updateOpportunity|getCompanies\(/);
});

test("bulk import supports the final master, uses controlled chunks, and creates zero opportunities", () => {
  assert.match(reader, /VIAWA Import/);
  assert.match(reader, /isMasterExport \? 0 : HEADER_ROW_INDEX/);
  assert.match(importService, /chunkSize = 250/);
  assert.match(importService, /createCompany/);
  assert.match(importService, /createContact/);
  assert.match(importService, /replaceCompanySectors/);
  assert.match(importService, /replaceCompanyProductGroups/);
  assert.doesNotMatch(importService, /from ["'][^"']*opportunityService|createOpportunity\s*\(/i);
  assert.match(importService, /skipped_duplicate/);
});

test("read RPCs preserve RLS and are unavailable to anon", () => {
  assert.match(migration, /security invoker/gi);
  assert.match(migration, /revoke all[\s\S]*from public, anon/gi);
  assert.match(migration, /grant execute[\s\S]*to authenticated/gi);
});
