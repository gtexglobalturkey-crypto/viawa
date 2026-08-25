import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../../../supabase/migrations/20260825130000_fix_contract_generation_read_authorization.sql", import.meta.url),
  "utf8",
);
const generatedDocuments = await readFile(
  new URL("../../../supabase/migrations/20260825120000_create_generated_documents.sql", import.meta.url),
  "utf8",
);
const referenceHardening = await readFile(
  new URL("../../../supabase/migrations/20260824090500_harden_reference_configuration_rls.sql", import.meta.url),
  "utf8",
);
const approvedPriceHardening = await readFile(
  new URL("../../../supabase/migrations/20260824100000_fix_approved_price_admin_authorization.sql", import.meta.url),
  "utf8",
);

test("approved snapshot SELECT requires active membership and exact opportunity ownership", () => {
  assert.match(migration, /approved_price_snapshots_select_active_owner_or_admin[\s\S]*for select[\s\S]*public\.is_active_application_user\(\)/i);
  assert.match(migration, /opportunity\.id\s*=\s*approved_price_snapshots\.opportunity_id/i);
  assert.match(migration, /opportunity\.company_id\s*=\s*approved_price_snapshots\.company_id/i);
  assert.match(migration, /opportunity\.owner\s*=\s*auth\.uid\(\)::text/i);
  assert.match(migration, /lower\(opportunity\.owner\)\s*=\s*lower\(coalesce\(auth\.jwt\(\)\s*->>\s*'email'/i);
});

test("approved snapshot admins retain read access", () => {
  assert.match(migration, /public\.is_active_application_admin\(\)[\s\S]*or opportunity\.owner/i);
});

test("document settings SELECT requires active application membership", () => {
  assert.match(migration, /document_settings_select_active_application_user[\s\S]*for select[\s\S]*using \(public\.is_active_application_user\(\)\)/i);
});

test("authorization fix preserves DML policies and removes RLS-bypassing table capabilities", () => {
  assert.doesNotMatch(migration, /for\s+(insert|update|delete)|\bgrant\b/i);
  assert.doesNotMatch(migration, /approved_price_snapshots_insert_active_admin/i);
  assert.match(migration, /revoke truncate, trigger, references on table public\.approved_price_snapshots\s+from authenticated/i);
  assert.match(migration, /revoke truncate, trigger, references on table public\.document_settings\s+from authenticated/i);
  assert.match(referenceHardening, /revoke insert, update, delete on table public\.document_settings from authenticated/i);
  assert.match(approvedPriceHardening, /approved_price_snapshots_insert_active_admin[\s\S]*for insert[\s\S]*public\.is_active_application_admin\(\)/i);
  assert.match(approvedPriceHardening, /created_by\s*=\s*auth\.uid\(\)/i);
});

test("generated document RLS remains owned by its existing migration", () => {
  assert.doesNotMatch(migration, /generated_documents/i);
  assert.match(generatedDocuments, /generated_documents_select_active_owner/i);
  assert.match(generatedDocuments, /generated_documents_insert_active_owner/i);
  assert.match(generatedDocuments, /generated_documents_update_active_owner/i);
});
