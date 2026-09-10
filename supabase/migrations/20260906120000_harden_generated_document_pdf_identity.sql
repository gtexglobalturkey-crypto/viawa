begin;

-- Additive only: historical rows and their Google references remain unchanged.
alter table public.generated_documents
  add column file_name text,
  add column pdf_storage_path text unique,
  add column pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  add column pdf_size_bytes bigint check (pdf_size_bytes is null or pdf_size_bytes > 0),
  -- Existing manual signed-PDF upload remains separate from generation/signing providers.
  add column signed_pdf_storage_path text,
  add column signed_pdf_file_name text,
  add column signature_completed_at timestamptz,
  add constraint generated_documents_signed_evidence_complete check (
    (signed_pdf_storage_path is null and signed_pdf_file_name is null and signature_completed_at is null)
    or (signed_pdf_storage_path is not null and signed_pdf_file_name is not null and signature_completed_at is not null
      and signed_pdf_storage_path like created_by::text || '/' || company_id::text || '/' || id::text || '/signed-%.pdf')
  ),
  add constraint generated_documents_pdf_archive_complete check (
    (pdf_storage_path is null and pdf_sha256 is null and pdf_size_bytes is null)
    or (file_name is not null and pdf_storage_path is not null and pdf_sha256 is not null and pdf_size_bytes is not null)
  ),
  add constraint generated_documents_pdf_archive_identity check (
    pdf_storage_path is null or pdf_storage_path =
      created_by::text || '/' || company_id::text || '/' || id::text || '/contract.pdf'
  );

-- Once published, the archive identity cannot be redirected to another PDF.
create function public.protect_generated_document_archive()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if old.pdf_storage_path is not null and (
    new.pdf_storage_path is distinct from old.pdf_storage_path
    or new.pdf_sha256 is distinct from old.pdf_sha256
    or new.pdf_size_bytes is distinct from old.pdf_size_bytes
    or new.file_name is distinct from old.file_name
  ) then
    raise exception 'Generated PDF archive is immutable';
  end if;
  return new;
end;
$$;

create trigger generated_documents_archive_protected before update on public.generated_documents
for each row execute function public.protect_generated_document_archive();
revoke all on function public.protect_generated_document_archive() from public, anon, authenticated;

-- Keep existing generated_documents grants and active-owner RLS unchanged.
commit;
