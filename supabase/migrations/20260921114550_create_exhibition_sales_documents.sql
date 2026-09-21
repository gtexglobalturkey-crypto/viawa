-- References to current Google Drive sales documents, never PDF contents.
-- One current reference per exhibition/document type; types remain extensible.
create table public.exhibition_sales_documents (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  document_type text not null
    check (document_type ~ '^[a-z][a-z0-9_]{0,63}$'),
  title text not null check (length(btrim(title)) between 1 and 120),
  drive_file_id text not null
    check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, document_type)
);

comment on table public.exhibition_sales_documents is
  'Current sales-document references. Google Drive owns file contents and versions.';
comment on column public.exhibition_sales_documents.document_type is
  'Extensible type, e.g. floor_plan, flyer, brochure, price_list, email_marketing or other.';
comment on column public.exhibition_sales_documents.drive_file_id is
  'Stable Drive file identity; open https://drive.google.com/file/d/{id}/view directly.';

create trigger exhibition_sales_documents_set_updated_at
before update on public.exhibition_sales_documents
for each row execute function public.set_updated_at();

alter table public.exhibition_sales_documents enable row level security;

create policy exhibition_sales_documents_select_active_application_user
on public.exhibition_sales_documents for select to authenticated
using (public.is_active_application_user());

-- Reference maintenance uses the administrative database path, not client writes.
revoke all on public.exhibition_sales_documents from anon, authenticated;
grant select on public.exhibition_sales_documents to authenticated;
grant all on public.exhibition_sales_documents to service_role;
