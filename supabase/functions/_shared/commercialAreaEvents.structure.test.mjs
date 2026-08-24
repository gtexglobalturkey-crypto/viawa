import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../migrations/20260823160000_create_commercial_area_events.sql", import.meta.url);
const sql = await readFile(migrationUrl, "utf8");

test("ledger permits exactly the two approved immutable event types", () => {
  assert.match(sql, /event_type in \('offer_issued', 'contract_completed'\)/);
  assert.match(sql, /before update or delete/);
  assert.match(sql, /Commercial area events are immutable/);
});

test("server derives area from the exact linked approved snapshot", () => {
  assert.match(sql, /snapshot\.price_input ->> 'standAreaSqm'/);
  assert.match(sql, /snapshot\.company_id = requested_company_id/);
  assert.match(sql, /snapshot\.opportunity_id = requested_opportunity_id/);
  assert.match(sql, /snapshot\.exhibition_id = requested_exhibition_id/);
  assert.match(sql, /opportunity\.company_id = requested_company_id/);
  assert.match(sql, /opportunity\.exhibition_id = requested_exhibition_id/);
  assert.doesNotMatch(sql, /requested_area/);
});

test("browser cannot create or mutate authoritative events", () => {
  assert.match(sql, /revoke all on table public\.commercial_area_events from public, anon, authenticated, service_role/);
  assert.match(sql, /revoke all on function public\.create_commercial_area_event[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.create_commercial_area_event[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant (insert|update|delete).*authenticated/i);
});

test("operation identity is unique and conflicting reuse is rejected", () => {
  assert.match(sql, /event_operation_key text not null unique/);
  assert.match(sql, /exception when unique_violation/);
  assert.match(sql, /Commercial area event operation key collision/);
});

test("occurrence time is server-assigned and migration performs no historical inference", () => {
  assert.match(sql, /occurred_at[\s\S]*now\(\)/);
  assert.doesNotMatch(sql, /insert into public\.commercial_area_events[\s\S]*select[\s\S]*from public\.(emails|timeline_events)/i);
  assert.doesNotMatch(sql, /localStorage|quote_created/i);
});
