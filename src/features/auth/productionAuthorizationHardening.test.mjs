import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("authorization helpers are uid-bound, RLS-safe, and unavailable to anon", async () => {
  const sql = await source("supabase/migrations/20260824090200_add_application_authorization_helpers.sql");
  assert.match(sql, /create or replace function public\.is_active_application_user\(\)/i);
  assert.match(sql, /create or replace function public\.is_active_application_admin\(\)/i);
  assert.match(sql, /application_user\.id = auth\.uid\(\)/i);
  assert.match(sql, /application_user\.is_active/i);
  assert.match(sql, /application_user\.role = 'admin'/i);
  assert.match(sql, /security definer/gi);
  assert.match(sql, /set search_path = pg_catalog, public/gi);
  assert.match(sql, /revoke all .* from public, anon/gi);
});

test("development policies and anon operational privileges are removed", async () => {
  const sql = await source("supabase/migrations/20260824090300_remove_development_access_policies.sql");
  for (const table of ["companies", "emails", "exhibitions", "opportunities", "reminders", "timeline_events", "ai_memory"]) {
    assert.match(sql, new RegExp(`'${table}'`, "i"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon`, "i"));
  }
  assert.match(sql, /lower\(policyname\) like 'development access%'/i);
});

test("core operational policies require active membership and preserve user-owned tables", async () => {
  const sql = await source("supabase/migrations/20260824090400_harden_core_operational_rls.sql");
  for (const table of ["companies", "contacts", "opportunities", "exhibitions", "reminders", "emails", "call_notes", "timeline_events", "ai_memory"]) {
    assert.match(sql, new RegExp(`'${table}'`, "i"));
  }
  assert.match(sql, /public\.is_active_application_user\(\)/i);
  assert.match(sql, /array\['ai_memories', 'tasks'\]/i);
  assert.match(sql, /user_id = auth\.uid\(\)/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("reference writes and document settings reads require active admin", async () => {
  const sql = await source("supabase/migrations/20260824090500_harden_reference_configuration_rls.sql");
  for (const table of ["sectors", "product_groups", "company_sectors", "company_product_groups", "exhibition_pricing_configs", "document_settings"]) {
    assert.match(sql, new RegExp(table, "i"));
  }
  assert.match(sql, /public\.is_active_application_admin\(\)/i);
  assert.match(sql, /document_settings_select_active_admin/i);
  assert.match(sql, /revoke insert, update, delete on table public\.document_settings from authenticated/i);
});

test("owned records and contract Storage combine membership with ownership", async () => {
  const sql = await source("supabase/migrations/20260824090600_harden_owned_tables_and_storage.sql");
  assert.match(sql, /approved_price_snapshots_select_active_owner/i);
  assert.match(sql, /contract_numbers_select_active_owner/i);
  assert.match(sql, /opportunity\.owner = auth\.uid\(\)::text/i);
  assert.match(sql, /public\.is_active_application_user\(\)/i);
  assert.match(sql, /opportunity\.id\s*=\s*approved_price_snapshots\.opportunity_id/i);
  assert.match(sql, /opportunity\.company_id\s*=\s*approved_price_snapshots\.company_id/i);
  assert.match(sql, /opportunity\.exhibition_id\s*=\s*approved_price_snapshots\.exhibition_id/i);
  assert.match(sql, /opportunity\.id\s*=\s*contract_numbers\.opportunity_id/i);
  assert.match(sql, /opportunity\.company_id\s*=\s*contract_numbers\.company_id/i);
  assert.doesNotMatch(sql, /opportunity\.(company_id|exhibition_id)\s*=\s*(?:opportunity\.)?\1/i);
  assert.match(sql, /bucket_id = 'contract-documents'/i);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
  for (const operation of ["upload", "read", "update", "delete"]) {
    const policyName = `Active VIAWA users can ${operation} their own contract documents`;
    const escapedName = policyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(sql, new RegExp(`drop\\s+policy\\s+if\\s+exists\\s+"${escapedName}"\\s+on\\s+storage\\.objects`, "i"));
    assert.match(sql, new RegExp(`create\\s+policy\\s+"${escapedName}"[\\s\\S]*?public\\.is_active_application_user\\(\\)[\\s\\S]*?auth\\.uid\\(\\)::text`, "i"));
  }
  assert.doesNotMatch(sql, /to anon/i);
});

test("business RPCs reject anon and enforce membership without weakening ownership", async () => {
  const sql = await source("supabase/migrations/20260824090700_harden_business_rpc_permissions.sql");
  assert.match(sql, /if not public\.is_active_application_admin\(\)/i);
  assert.match(sql, /if not public\.is_active_application_user\(\)/i);
  assert.match(sql, /revoke all on function public\.replace_company_sectors[\s\S]*from public, anon/i);
  assert.match(sql, /revoke all on function public\.replace_company_product_groups[\s\S]*from public, anon/i);
  assert.match(sql, /revoke all on function public\.get_or_create_contract_number[\s\S]*from public, anon/i);
  assert.match(sql, /v_owner[\s\S]*v_authenticated_user[\s\S]*v_authenticated_email/i);
});

test("contract endpoint checks active membership before business records", async () => {
  const code = await source("vite-plugins/contract-docx-endpoint/supabaseAuthorization.ts");
  const membership = code.indexOf('.from("application_users")');
  const companies = code.indexOf('.from("companies")');
  assert.ok(membership >= 0 && companies > membership);
  assert.match(code, /if \(!applicationUser\?\.is_active\)/i);
  assert.match(code, /status: 403[\s\S]*APPLICATION_ACCESS_DENIED/i);
});

test("Dropbox Sign checks active membership before secrets or provider work", async () => {
  const code = await source("supabase/functions/dropbox-sign-send/index.ts");
  const membership = code.indexOf("/rest/v1/application_users");
  const apiKeyRead = code.indexOf('.get("DROPBOX_SIGN_API_KEY")');
  assert.ok(membership >= 0 && apiKeyRead > membership);
  assert.match(code, /applicationUser\.is_active !== true/i);
  assert.match(code, /Active VIAWA access is required/i);
});

test("Phase 2 does not alter rls_auto_enable", async () => {
  const migrationPaths = [
    "20260824090200_add_application_authorization_helpers.sql",
    "20260824090300_remove_development_access_policies.sql",
    "20260824090400_harden_core_operational_rls.sql",
    "20260824090500_harden_reference_configuration_rls.sql",
    "20260824090600_harden_owned_tables_and_storage.sql",
    "20260824090700_harden_business_rpc_permissions.sql",
  ];
  const combined = (await Promise.all(migrationPaths.map((name) => source(`supabase/migrations/${name}`)))).join("\n");
  assert.doesNotMatch(combined, /(drop|alter|create or replace)\s+(event trigger|function)\s+[^;]*rls_auto_enable/i);
});

test("opportunity-limit reconciliation installs the final concurrency-safe rule", async () => {
  const sql = await source("supabase/migrations/20260824090000_reconcile_active_opportunity_limit.sql");
  assert.match(sql, /max_active constant integer := 4/i);
  assert.match(sql, /terminal_stages constant text\[\] := array\['signed', 'lost', 'won'\]/i);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(new\.company_id::text, 0\)\)/i);
  assert.match(sql, /create or replace function public\.enforce_active_opportunity_limit\(\)/i);
  assert.match(sql, /create trigger enforce_active_opportunity_limit[\s\S]*execute function public\.enforce_active_opportunity_limit\(\)/i);
});

test("application-users reconciliation is privilege-only and DML-free", async () => {
  const sql = await source("supabase/migrations/20260824090100_reconcile_application_users_privileges.sql");
  assert.match(sql, /revoke all on table public\.application_users from anon/i);
  assert.match(sql, /revoke insert, update, delete on table public\.application_users from authenticated/i);
  assert.match(sql, /grant select on table public\.application_users to authenticated/i);
  assert.doesNotMatch(sql, /\b(insert\s+into|update|upsert|delete\s+from)\s+public\.application_users\b/i);
});

test("Phase 2 migration filenames preserve the approved order and timestamps", async () => {
  const { readdir } = await import("node:fs/promises");
  const migrationDirectory = new URL("supabase/migrations/", root);
  const names = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const expectedQueue = [
    "20260824090000_reconcile_active_opportunity_limit.sql",
    "20260824090100_reconcile_application_users_privileges.sql",
    "20260824090200_add_application_authorization_helpers.sql",
    "20260824090300_remove_development_access_policies.sql",
    "20260824090400_harden_core_operational_rls.sql",
    "20260824090500_harden_reference_configuration_rls.sql",
    "20260824090600_harden_owned_tables_and_storage.sql",
    "20260824090700_harden_business_rpc_permissions.sql",
  ];
  assert.deepEqual(names.filter((name) => name.startsWith("20260824")), expectedQueue);
  assert.equal(names.some((name) => name.startsWith("2026082109")), false);
  assert.equal(names.includes("20260823160000_create_commercial_area_events.sql"), true);
});
