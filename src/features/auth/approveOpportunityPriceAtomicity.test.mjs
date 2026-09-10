import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260909090000_create_approve_opportunity_price_rpc.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");

test("approve_opportunity_price is a single plpgsql function (one implicit transaction)", () => {
  const functionBodies = [
    ...sql.matchAll(
      /create or replace function public\.approve_opportunity_price\s*\([\s\S]*?\$\$([\s\S]*?)\$\$;/gi,
    ),
  ];
  assert.equal(functionBodies.length, 1);
  assert.match(sql, /language plpgsql/i);
});

test("both writes live inside the same function body", () => {
  const body = sql.match(
    /create or replace function public\.approve_opportunity_price\s*\([\s\S]*?\$\$([\s\S]*?)\$\$;/i,
  )[1];

  assert.match(body, /update public\.opportunities/i);
  assert.match(body, /insert into public\.approved_price_snapshots/i);

  const updateIndex = body.search(/update public\.opportunities/i);
  const insertIndex = body.search(/insert into public\.approved_price_snapshots/i);
  assert.ok(updateIndex >= 0 && insertIndex > updateIndex);
});

test("a failed or unauthorized opportunity update raises instead of silently continuing", () => {
  const body = sql.match(
    /create or replace function public\.approve_opportunity_price\s*\([\s\S]*?\$\$([\s\S]*?)\$\$;/i,
  )[1];

  assert.match(body, /returning id into v_updated_opportunity_id/i);
  assert.match(
    body,
    /if v_updated_opportunity_id is null then\s*raise exception/i,
  );
});

test("does not loosen authorization: security invoker, no admin/RLS bypass logic", () => {
  assert.match(sql, /security invoker/i);
  assert.doesNotMatch(sql, /security definer/i);
  assert.doesNotMatch(sql, /is_active_application_admin/i);
  assert.doesNotMatch(sql, /is_active_application_user/i);
  assert.doesNotMatch(sql, /disable row level security|force row level security/i);
});

test("execute is granted only to authenticated and service_role, never anon/public", () => {
  assert.match(
    sql,
    /grant execute on function public\.approve_opportunity_price\([\s\S]*?\) to authenticated, service_role;/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.approve_opportunity_price\([\s\S]*?\) from public, anon;/i,
  );
});

test("clears any stale payment plan as part of the same atomic write", () => {
  const body = sql.match(
    /create or replace function public\.approve_opportunity_price\s*\([\s\S]*?\$\$([\s\S]*?)\$\$;/i,
  )[1];
  assert.match(body, /payment_plan\s*=\s*null/i);
});
