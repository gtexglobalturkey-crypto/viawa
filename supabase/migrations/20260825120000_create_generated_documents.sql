begin;

create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contract_numbers(id) on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  exhibition_id uuid not null references public.exhibitions(id) on delete restrict,
  document_type text not null default 'participation-contract'
    check (length(btrim(document_type)) > 0),
  template_id text not null check (length(btrim(template_id)) > 0),
  google_doc_id text check (google_doc_id is null or length(btrim(google_doc_id)) > 0),
  google_doc_url text check (google_doc_url is null or google_doc_url ~ '^https://'),
  google_pdf_id text check (google_pdf_id is null or length(btrim(google_pdf_id)) > 0),
  google_pdf_url text check (google_pdf_url is null or google_pdf_url ~ '^https://'),
  generation_status text not null default 'PENDING'
    check (length(btrim(generation_status)) > 0),
  version integer not null default 1 check (version > 0),
  generated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
    references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_documents_contract_version_unique unique (contract_id, version),
  constraint generated_documents_google_doc_unique unique (google_doc_id),
  constraint generated_documents_google_pdf_unique unique (google_pdf_id),
  constraint generated_documents_doc_reference_complete check (
    (google_doc_id is null and google_doc_url is null)
    or (google_doc_id is not null and google_doc_url is not null)
  ),
  constraint generated_documents_pdf_reference_complete check (
    (google_pdf_id is null and google_pdf_url is null)
    or (google_pdf_id is not null and google_pdf_url is not null)
  )
);

-- Current UI access paths list contract versions by opportunity and company.
-- The contract/version unique constraint already supports contract lookups.
create index generated_documents_opportunity_generated_idx
  on public.generated_documents (opportunity_id, generated_at desc);

create index generated_documents_company_generated_idx
  on public.generated_documents (company_id, generated_at desc);

create or replace function public.protect_generated_document()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id
      or new.contract_id <> old.contract_id
      or new.opportunity_id <> old.opportunity_id
      or new.company_id <> old.company_id
      or new.exhibition_id <> old.exhibition_id
      or new.document_type <> old.document_type
      or new.template_id <> old.template_id
      or new.version <> old.version
      or new.generated_at <> old.generated_at
      or new.created_by <> old.created_by
      or new.created_at <> old.created_at then
      raise exception 'Generated document identity is immutable';
    end if;
  end if;

  if not exists (
    select 1
    from public.contract_numbers contract_number
    join public.opportunities opportunity
      on opportunity.id = contract_number.opportunity_id
    where contract_number.id = new.contract_id
      and contract_number.opportunity_id = new.opportunity_id
      and contract_number.company_id = new.company_id
      and contract_number.exhibition_id = new.exhibition_id
      and opportunity.company_id = new.company_id
      and opportunity.exhibition_id = new.exhibition_id
  ) then
    raise exception using errcode = '23514',
      message = 'Generated document business context is invalid';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger generated_documents_protected
before insert or update on public.generated_documents
for each row execute function public.protect_generated_document();

alter table public.generated_documents enable row level security;

create policy generated_documents_select_active_owner
on public.generated_documents for select to authenticated
using (
  public.is_active_application_user()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = generated_documents.opportunity_id
      and opportunity.company_id = generated_documents.company_id
      and opportunity.exhibition_id = generated_documents.exhibition_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy generated_documents_insert_active_owner
on public.generated_documents for insert to authenticated
with check (
  public.is_active_application_user()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = generated_documents.opportunity_id
      and opportunity.company_id = generated_documents.company_id
      and opportunity.exhibition_id = generated_documents.exhibition_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create policy generated_documents_update_active_owner
on public.generated_documents for update to authenticated
using (
  public.is_active_application_user()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = generated_documents.opportunity_id
      and opportunity.company_id = generated_documents.company_id
      and opportunity.exhibition_id = generated_documents.exhibition_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
)
with check (
  public.is_active_application_user()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = generated_documents.opportunity_id
      and opportunity.company_id = generated_documents.company_id
      and opportunity.exhibition_id = generated_documents.exhibition_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

revoke all on table public.generated_documents from public, anon, authenticated;
grant select, insert, update on table public.generated_documents to authenticated;

revoke all on function public.protect_generated_document() from public, anon, authenticated;

commit;
