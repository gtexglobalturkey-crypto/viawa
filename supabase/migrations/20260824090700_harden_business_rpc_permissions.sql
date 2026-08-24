create or replace function public.replace_company_sectors(
  p_company_id uuid,
  p_sector_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_application_admin() then
    raise exception using errcode = '42501', message = 'Active VIAWA administrator access is required.';
  end if;

  delete from public.company_sectors where company_id = p_company_id;

  insert into public.company_sectors (company_id, sector_id, position)
  select p_company_id, sector_id, ordinality::smallint
  from unnest(p_sector_ids) with ordinality as t (sector_id, ordinality)
  where ordinality <= 4;

  update public.companies
  set industry = (
    select sector.name
    from public.company_sectors company_sector
    join public.sectors sector on sector.id = company_sector.sector_id
    where company_sector.company_id = p_company_id and company_sector.position = 1
  )
  where id = p_company_id;
end;
$$;

create or replace function public.replace_company_product_groups(
  p_company_id uuid,
  p_product_group_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_active_application_admin() then
    raise exception using errcode = '42501', message = 'Active VIAWA administrator access is required.';
  end if;

  delete from public.company_product_groups where company_id = p_company_id;

  insert into public.company_product_groups (company_id, product_group_id, position)
  select p_company_id, product_group_id, ordinality::smallint
  from unnest(p_product_group_ids) with ordinality as t (product_group_id, ordinality)
  where ordinality <= 4;
end;
$$;

create or replace function public.get_or_create_contract_number(
  p_company_id uuid,
  p_opportunity_id uuid,
  p_exhibition_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
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

  if not public.is_active_application_user() then
    raise exception using errcode = '42501', message = 'Active VIAWA access is required.';
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

  select number.contract_number into v_contract_number
  from public.contract_numbers number
  where number.opportunity_id = p_opportunity_id
    and number.exhibition_id = p_exhibition_id;

  if v_contract_number is not null then return v_contract_number; end if;

  v_contract_year := coalesce(
    extract(year from v_exhibition_start_date)::integer,
    extract(year from timezone('Europe/Istanbul', now()))::integer
  );

  perform pg_advisory_xact_lock(hashtext('viawa-contract-number-' || v_contract_year::text)::bigint);

  select number.contract_number into v_contract_number
  from public.contract_numbers number
  where number.opportunity_id = p_opportunity_id
    and number.exhibition_id = p_exhibition_id;

  if v_contract_number is not null then return v_contract_number; end if;

  select coalesce(max(number.sequence_number), 0) + 1 into v_sequence_number
  from public.contract_numbers number where number.contract_year = v_contract_year;

  v_contract_number := format('EXP-%s-%s', v_contract_year, lpad(v_sequence_number::text, 6, '0'));

  insert into public.contract_numbers (
    company_id, opportunity_id, exhibition_id, contract_year,
    sequence_number, contract_number, created_by
  ) values (
    p_company_id, p_opportunity_id, p_exhibition_id, v_contract_year,
    v_sequence_number, v_contract_number, v_authenticated_user
  );

  return v_contract_number;
end;
$$;

revoke all on function public.replace_company_sectors(uuid, uuid[]) from public, anon;
revoke all on function public.replace_company_product_groups(uuid, uuid[]) from public, anon;
revoke all on function public.get_or_create_contract_number(uuid, uuid, uuid) from public, anon;

grant execute on function public.replace_company_sectors(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.replace_company_product_groups(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.get_or_create_contract_number(uuid, uuid, uuid) to authenticated, service_role;
