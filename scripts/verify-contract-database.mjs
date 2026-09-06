// Local PostgreSQL verification only. No network, Supabase link, credentials or production data.
// Setup: npm install --no-save --package-lock=false --prefix .tmp/contract-sql @electric-sql/pglite@0.5.8
// Run: node --test scripts/verify-contract-database.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
const { PGlite } = await import("../.tmp/contract-sql/node_modules/@electric-sql/pglite/dist/index.js");
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const nonOwner = "22222222-2222-4222-8222-222222222222";
const inactive = "33333333-3333-4333-8333-333333333333";
const company = "44444444-4444-4444-8444-444444444444";
const fair = "55555555-5555-4555-8555-555555555555";
const opportunity = "66666666-6666-4666-8666-666666666666";
const contract = "77777777-7777-4777-8777-777777777777";
const document = "88888888-8888-4888-8888-888888888888";
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  insert into auth.users values ('${owner}'), ('${nonOwner}'), ('${inactive}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  grant usage on schema auth to authenticated;
  create table public.application_users (id uuid primary key, is_active boolean, is_admin boolean);
  insert into public.application_users values ('${owner}', true, false), ('${nonOwner}', true, false), ('${inactive}', false, true);
  create function public.is_active_application_user() returns boolean language sql stable security definer set search_path=public,pg_catalog as $$ select coalesce((select is_active from public.application_users where id=auth.uid()), false) $$;
  create function public.is_active_application_admin() returns boolean language sql stable security definer set search_path=public,pg_catalog as $$ select coalesce((select is_active and is_admin from public.application_users where id=auth.uid()), false) $$;
  create table companies (id uuid primary key);
  create table exhibitions (id uuid primary key);
  create table opportunities (id uuid primary key, company_id uuid, exhibition_id uuid, owner text);
  create table contract_numbers (id uuid primary key, company_id uuid, exhibition_id uuid, opportunity_id uuid, contract_number text);
  create table approved_price_snapshots (id uuid primary key, company_id uuid, opportunity_id uuid);
  create table document_settings (id text primary key);
  insert into companies values ('${company}'); insert into exhibitions values ('${fair}');
  insert into opportunities values ('${opportunity}', '${company}', '${fair}', '${owner}');
  insert into contract_numbers values ('${contract}', '${company}', '${fair}', '${opportunity}', 'EXP-2027-000001');
  insert into approved_price_snapshots values ('${document}', '${company}', '${opportunity}');
  insert into document_settings values ('participation-contract');
  grant select on companies, exhibitions, opportunities, contract_numbers to authenticated;
  grant all on approved_price_snapshots, document_settings to authenticated;
  alter table approved_price_snapshots enable row level security;
  alter table document_settings enable row level security;
  create policy approved_price_snapshots_select_active_admin on approved_price_snapshots for select to authenticated using (public.is_active_application_admin());
  create policy document_settings_select_active_admin on document_settings for select to authenticated using (public.is_active_application_admin());
`);
for (const name of ["20260825120000_create_generated_documents.sql", "20260825130000_fix_contract_generation_read_authorization.sql"]) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
}
await db.exec(`insert into generated_documents(id,contract_id,opportunity_id,company_id,exhibition_id,template_id,created_by,google_doc_id,google_doc_url,google_pdf_id,google_pdf_url,generation_status)
values ('${document}','${contract}','${opportunity}','${company}','${fair}','master','${owner}','historical-copy','https://docs.google.com/document/d/historical-copy/edit','historical-pdf','https://drive.google.com/file/d/historical-pdf/view','COMPLETED');`);
await db.exec(await readFile(new URL("../supabase/migrations/20260906120000_harden_generated_document_pdf_identity.sql", import.meta.url), "utf8"));

async function asUser(id, email = "owner@example.invalid") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)", [id, email]);
  await db.exec("set role authenticated");
}
after(async () => { await db.close(); });

test("additive migration leaves historical references and archive fields untouched", async () => {
  const { rows } = await db.query("select google_doc_id,google_pdf_id,pdf_storage_path from generated_documents");
  assert.deepEqual(rows, [{ google_doc_id: "historical-copy", google_pdf_id: "historical-pdf", pdf_storage_path: null }]);
});
test("active owner reads generated history, approved snapshot and document settings", async () => {
  await asUser(owner);
  for (const table of ["generated_documents", "approved_price_snapshots", "document_settings"]) {
    assert.equal((await db.query(`select * from ${table}`)).rows.length, 1);
  }
});
test("active non-owner cannot read or update generated documents or read owner snapshot", async () => {
  await asUser(nonOwner);
  assert.equal((await db.query("select * from generated_documents")).rows.length, 0);
  assert.equal((await db.query("select * from approved_price_snapshots")).rows.length, 0);
  assert.equal((await db.query("update generated_documents set generation_status='FAILED' returning id")).rows.length, 0);
  await assert.rejects(() => db.query(`insert into generated_documents(contract_id,opportunity_id,company_id,exhibition_id,template_id,version) values ('${contract}','${opportunity}','${company}','${fair}','master',2)`), /row-level security/);
});
test("inactive owner cannot read or insert, even with matching email ownership", async () => {
  await db.exec(`reset role; update opportunities set owner='owner@example.invalid'`);
  await asUser(inactive);
  for (const table of ["generated_documents", "approved_price_snapshots", "document_settings"]) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
  await assert.rejects(() => db.query(`insert into generated_documents(contract_id,opportunity_id,company_id,exhibition_id,template_id,version) values ('${contract}','${opportunity}','${company}','${fair}','master',2)`), /row-level security/);
});
test("email owner can create next canonical version; archive path/hash become immutable", async () => {
  await asUser(owner);
  const { rows: [created] } = await db.query(`insert into generated_documents(contract_id,opportunity_id,company_id,exhibition_id,template_id,version) values ('${contract}','${opportunity}','${company}','${fair}','master',2) returning id`);
  const path = `${owner}/${company}/${created.id}/contract.pdf`;
  await db.query("update generated_documents set pdf_storage_path=$1,pdf_sha256=$2,pdf_size_bytes=123,file_name='contract.pdf' where id=$3", [path, "a".repeat(64), created.id]);
  await assert.rejects(() => db.query("update generated_documents set pdf_sha256=$1 where id=$2", ["b".repeat(64), created.id]), /archive is immutable/);
  await assert.rejects(() => db.query("delete from generated_documents where id=$1", [created.id]), /permission denied/);
  await assert.rejects(() => db.query("update generated_documents set pdf_storage_path=$1,pdf_sha256=$2,pdf_size_bytes=123,file_name='old.pdf' where id=$3", [path, "a".repeat(64), document]), /constraint|duplicate/);
});
test("RLS-bypassing table privileges remain revoked", async () => {
  const { rows } = await db.query("select has_table_privilege('authenticated','document_settings','TRUNCATE') as settings, has_table_privilege('authenticated','approved_price_snapshots','TRUNCATE') as snapshots");
  assert.deepEqual(rows, [{ settings: false, snapshots: false }]);
});
