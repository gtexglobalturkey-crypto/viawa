import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260825120000_create_generated_documents.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");

test("generated documents use the existing contract and business UUID relationships", () => {
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(sql, /contract_id uuid not null references public\.contract_numbers\(id\) on delete restrict/i);
  assert.match(sql, /opportunity_id uuid not null references public\.opportunities\(id\) on delete restrict/i);
  assert.match(sql, /company_id uuid not null references public\.companies\(id\) on delete restrict/i);
  assert.match(sql, /exhibition_id uuid not null references public\.exhibitions\(id\) on delete restrict/i);
  assert.match(sql, /generated_documents_contract_version_unique unique \(contract_id, version\)/i);
});

test("Google references are pair-complete and provider IDs cannot be reused", () => {
  assert.match(sql, /generated_documents_doc_reference_complete check/i);
  assert.match(sql, /generated_documents_pdf_reference_complete check/i);
  assert.match(sql, /generated_documents_google_doc_unique unique \(google_doc_id\)/i);
  assert.match(sql, /generated_documents_google_pdf_unique unique \(google_pdf_id\)/i);
});

test("Google-first persistence contains no signing-provider lifecycle", () => {
  assert.doesNotMatch(sql, /signing_status|READY_FOR_SIGNATURE|dropbox/i);
});

test("generated document writes require active membership and opportunity ownership", () => {
  for (const operation of ["select", "insert", "update"]) {
    assert.match(sql, new RegExp(`generated_documents_${operation}_active_owner`, "i"));
  }
  assert.match(sql, /public\.is_active_application_user\(\)/i);
  assert.match(sql, /opportunity\.owner = auth\.uid\(\)::text/i);
  assert.match(sql, /created_by = auth\.uid\(\)/i);
  assert.doesNotMatch(sql, /create policy generated_documents_delete/i);
  assert.match(sql, /grant select, insert, update on table public\.generated_documents to authenticated/i);
  assert.doesNotMatch(sql, /grant[^;]*delete[^;]*generated_documents/i);
});

test("identity and business linkage are protected while lifecycle fields remain updateable", () => {
  assert.match(sql, /create trigger generated_documents_protected[\s\S]*before insert or update/i);
  assert.match(sql, /Generated document identity is immutable/i);
  assert.match(sql, /contract_number\.opportunity_id = new\.opportunity_id/i);
  assert.match(sql, /contract_number\.company_id = new\.company_id/i);
  assert.match(sql, /contract_number\.exhibition_id = new\.exhibition_id/i);
  assert.match(sql, /new\.updated_at := now\(\)/i);
});

test("only current list access paths receive non-constraint indexes", () => {
  assert.match(sql, /generated_documents_opportunity_generated_idx[\s\S]*\(opportunity_id, generated_at desc\)/i);
  assert.match(sql, /generated_documents_company_generated_idx[\s\S]*\(company_id, generated_at desc\)/i);
  assert.doesNotMatch(sql, /create index[^;]*(template_id|exhibition_id|signing_status|generation_status)/i);
});
