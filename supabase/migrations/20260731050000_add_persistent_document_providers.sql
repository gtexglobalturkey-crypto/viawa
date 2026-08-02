-- Sprint 22.4: immutable approved-price snapshots and persistent document settings.

create table if not exists public.approved_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  exhibition_id uuid not null references public.exhibitions(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  currency text not null,
  price_input jsonb not null,
  price_result jsonb not null,
  pricing_source text not null,
  pricing_source_version text,
  pricing_config_updated_at timestamptz,
  matched_repository_folder text,
  created_at timestamptz not null default now(),
  constraint approved_price_snapshots_price_input_object
    check (jsonb_typeof(price_input) = 'object'),
  constraint approved_price_snapshots_price_result_object
    check (jsonb_typeof(price_result) = 'object')
);

create index if not exists approved_price_snapshots_lookup_idx
  on public.approved_price_snapshots
  (opportunity_id, exhibition_id, approved_at desc, created_at desc);

create or replace function public.prevent_approved_price_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Approved price snapshots are immutable';
end;
$$;

drop trigger if exists approved_price_snapshots_immutable
  on public.approved_price_snapshots;
create trigger approved_price_snapshots_immutable
before update or delete on public.approved_price_snapshots
for each row execute function public.prevent_approved_price_snapshot_mutation();

alter table public.approved_price_snapshots enable row level security;

drop policy if exists approved_price_snapshots_select_owned
  on public.approved_price_snapshots;
create policy approved_price_snapshots_select_owned
on public.approved_price_snapshots for select
to authenticated
using (
  exists (
    select 1 from public.opportunities opportunity
    where opportunity.id = opportunity_id
      and opportunity.company_id = company_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists approved_price_snapshots_insert_owned
  on public.approved_price_snapshots;
create policy approved_price_snapshots_insert_owned
on public.approved_price_snapshots for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.opportunities opportunity
    where opportunity.id = opportunity_id
      and opportunity.company_id = company_id
      and opportunity.exhibition_id = exhibition_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

create table if not exists public.document_settings (
  id text primary key,
  issuer jsonb not null,
  bank jsonb not null,
  contract_defaults jsonb not null default '{}'::jsonb,
  document_defaults jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint document_settings_issuer_object check (jsonb_typeof(issuer) = 'object'),
  constraint document_settings_bank_object check (jsonb_typeof(bank) = 'object'),
  constraint document_settings_contract_defaults_object
    check (jsonb_typeof(contract_defaults) = 'object'),
  constraint document_settings_document_defaults_object
    check (jsonb_typeof(document_defaults) = 'object')
);

alter table public.document_settings enable row level security;

drop policy if exists document_settings_authenticated_read
  on public.document_settings;
create policy document_settings_authenticated_read
on public.document_settings for select
to authenticated
using (true);

-- No client write policy is intentionally created. Settings are maintained
-- through an administrative database process until a dedicated settings UI exists.
