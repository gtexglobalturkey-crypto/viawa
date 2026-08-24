import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260824100000_fix_approved_price_admin_authorization.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");

test("approved-price SELECT and INSERT require active VIAWA admin", () => {
  assert.match(
    sql,
    /create policy approved_price_snapshots_select_active_admin[\s\S]*?for select[\s\S]*?using\s*\([\s\S]*?public\.is_active_application_admin\(\)/i,
  );
  assert.match(
    sql,
    /create policy approved_price_snapshots_insert_active_admin[\s\S]*?for insert[\s\S]*?with check\s*\([\s\S]*?public\.is_active_application_admin\(\)/i,
  );
  assert.doesNotMatch(sql, /public\.is_active_application_user\(\)/i);
});

test("approved-price INSERT remains caller-bound and relationally exact", () => {
  assert.match(sql, /created_by\s*=\s*auth\.uid\(\)/i);
  assert.match(
    sql,
    /opportunity\.id\s*=\s*approved_price_snapshots\.opportunity_id/i,
  );
  assert.match(
    sql,
    /opportunity\.company_id\s*=\s*approved_price_snapshots\.company_id/i,
  );
  assert.match(
    sql,
    /opportunity\.exhibition_id\s*=\s*approved_price_snapshots\.exhibition_id/i,
  );
});

test("approved-price policies contain neither owner matching nor self-comparisons", () => {
  assert.doesNotMatch(sql, /opportunity\.owner/i);
  assert.doesNotMatch(sql, /auth\.jwt\(\)/i);
  assert.doesNotMatch(
    sql,
    /opportunity\.company_id\s*=\s*opportunity\.company_id/i,
  );
  assert.doesNotMatch(
    sql,
    /opportunity\.exhibition_id\s*=\s*opportunity\.exhibition_id/i,
  );
});

test("migration changes only the two approved-price policies", () => {
  assert.doesNotMatch(sql, /\b(alter table|grant|revoke|insert into|update|delete from)\b/i);
  const createdPolicies = [
    ...sql.matchAll(/create policy\s+([a-z0-9_]+)/gi),
  ].map((match) => match[1]);
  assert.deepEqual(createdPolicies, [
    "approved_price_snapshots_select_active_admin",
    "approved_price_snapshots_insert_active_admin",
  ]);
});
