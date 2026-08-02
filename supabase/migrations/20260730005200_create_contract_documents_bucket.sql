-- Sprint: Contract document Storage foundation (Dropbox Sign prep).
--
-- Creates the private Storage bucket that will eventually hold generated
-- contract PDFs so they can be handed to Dropbox Sign by a server-side
-- role (Edge Function) instead of relying on a browser-local file. This
-- migration only prepares the bucket + RLS — nothing in the app uploads
-- to it yet (see src/modules/document-engine/services/
-- contractDocumentStorage.ts, not wired into any UI flow this sprint).
--
-- Path convention enforced by the RLS policies below:
--   {userId}/{companyId}/{generatedDocumentId}/{safeFileName}
-- so `(storage.foldername(name))[1]` — the first path segment — is
-- always the uploading user's own auth.uid().
--
-- RLS follows the same shape as every other migration in this folder
-- (see 20260728052700_add_sectors_and_product_groups.sql header): one
-- policy per CRUD verb, `to authenticated` only, `drop policy if
-- exists` before `create policy` so this file can be re-run safely. No
-- anon policy, no public bucket, no service-role policy (service role
-- already bypasses RLS, so a policy for it would be redundant).
--
-- Deliberately NOT running `alter table storage.objects enable row
-- level security` here: Supabase enables RLS on storage.objects by
-- default for every project, and the migration role does not own that
-- system table, so re-issuing ENABLE ROW LEVEL SECURITY fails with
-- "must be owner of relation objects" even though the statement would
-- be a no-op. Policy management on storage.objects (create/drop) is
-- separately granted and works fine without table ownership — only the
-- RLS-toggle DDL itself requires it.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI) — the app's anon key
-- cannot execute DDL, so this file is not applied automatically,
-- matching every other migration in this folder.

-- ---------------------------------------------------------------------
-- 1. Private bucket (idempotent — on conflict, settings are kept in
--    sync rather than erroring or silently drifting)
-- ---------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'contract-documents',
  'contract-documents',
  false,
  10485760, -- 10 MB
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. RLS — scoped to the contract-documents bucket only. Every policy
--    checks that the first folder segment of the object's path equals
--    the calling user's own auth.uid().
-- ---------------------------------------------------------------------

drop policy if exists "VIAWA users can upload their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can read their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can update their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can delete their own contract documents" on storage.objects;

create policy "VIAWA users can upload their own contract documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "VIAWA users can read their own contract documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "VIAWA users can update their own contract documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "VIAWA users can delete their own contract documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contract-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
