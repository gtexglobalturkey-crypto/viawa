-- VIAWA Sprint 24: persistent, atomic participation-contract numbering.
-- Preserves the existing format: EXP-{year}-{six digit sequence}.

create table if not exists public.contract_numbers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  exhibition_id uuid not null references public.exhibitions(id) on delete restrict,
  contract_year integer not null check (contract_year between 2000 and 9999),
  sequence_number integer not null check (sequence_number > 0),
  contract_number text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint contract_numbers_business_key_unique
    unique (opportunity_id, exhibition_id),
  constraint contract_numbers_year_sequence_unique
    unique (contract_year, sequence_number),
  constraint contract_numbers_value_unique unique (contract_number),
  constraint contract_numbers_format_check
    check (contract_number ~ '^EXP-[0-9]{4}-[0-9]{6}$')
);

alter table public.contract_numbers enable row level security;

drop policy if exists contract_numbers_select_owned
  on public.contract_numbers;
create policy contract_numbers_select_owned
on public.contract_numbers for select
to authenticated
using (
  exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = opportunity_id
      and opportunity.company_id = company_id
      and (
        opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

revoke all on table public.contract_numbers from anon;
grant select on table public.contract_numbers to authenticated;

create or replace function public.get_or_create_contract_number(
  p_company_id uuid,
  p_opportunity_id uuid,
  p_exhibition_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_authenticated_user uuid := auth.uid();
  v_authenticated_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_owner text;
  v_actual_exhibition_id uuid;
  v_exhibition_start_date date;
  v_contract_year integer;
  v_sequence_number integer;
  v_contract_number text;
begin
  if v_authenticated_user is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select opportunity.owner, opportunity.exhibition_id, exhibition.start_date
    into v_owner, v_actual_exhibition_id, v_exhibition_start_date
  from public.opportunities opportunity
  join public.exhibitions exhibition on exhibition.id = opportunity.exhibition_id
  where opportunity.id = p_opportunity_id
    and opportunity.company_id = p_company_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Contract business context was not found.';
  end if;

  if v_actual_exhibition_id is distinct from p_exhibition_id then
    raise exception using errcode = '22023', message = 'Contract business context is invalid.';
  end if;

  if lower(coalesce(v_owner, '')) <> lower(v_authenticated_user::text)
     and lower(coalesce(v_owner, '')) <> v_authenticated_email then
    raise exception using errcode = '42501', message = 'Contract access is denied.';
  end if;

  select number.contract_number
    into v_contract_number
  from public.contract_numbers number
  where number.opportunity_id = p_opportunity_id
    and number.exhibition_id = p_exhibition_id;

  if v_contract_number is not null then
    return v_contract_number;
  end if;

  v_contract_year := coalesce(
    extract(year from v_exhibition_start_date)::integer,
    extract(year from timezone('Europe/Istanbul', now()))::integer
  );

  -- Serializes number allocation only within the same year. Calls for other
  -- years continue independently; retries for the same business key reuse it.
  perform pg_advisory_xact_lock(
    hashtext('viawa-contract-number-' || v_contract_year::text)::bigint
  );

  select number.contract_number
    into v_contract_number
  from public.contract_numbers number
  where number.opportunity_id = p_opportunity_id
    and number.exhibition_id = p_exhibition_id;

  if v_contract_number is not null then
    return v_contract_number;
  end if;

  select coalesce(max(number.sequence_number), 0) + 1
    into v_sequence_number
  from public.contract_numbers number
  where number.contract_year = v_contract_year;

  v_contract_number := format(
    'EXP-%s-%s',
    v_contract_year,
    lpad(v_sequence_number::text, 6, '0')
  );

  insert into public.contract_numbers (
    company_id,
    opportunity_id,
    exhibition_id,
    contract_year,
    sequence_number,
    contract_number,
    created_by
  ) values (
    p_company_id,
    p_opportunity_id,
    p_exhibition_id,
    v_contract_year,
    v_sequence_number,
    v_contract_number,
    v_authenticated_user
  );

  return v_contract_number;
end;
$$;

revoke all on function public.get_or_create_contract_number(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.get_or_create_contract_number(uuid, uuid, uuid)
  to authenticated;
