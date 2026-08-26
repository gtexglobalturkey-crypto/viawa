-- Large-data company directory read model. Read-only and RLS preserving:
-- SECURITY INVOKER means callers can only see rows allowed by table policies.
create or replace function public.list_company_directory_page(
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null,
  p_country text default null,
  p_city text default null,
  p_sector_id uuid default null,
  p_product_group_id uuid default null,
  p_communication text default 'all',
  p_exhibition_id uuid default null,
  p_status text default null
) returns table (
  company jsonb,
  active_opportunity_count bigint,
  next_opportunity jsonb,
  company_status text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with filtered as (
    select c.*
    from public.companies c
    where (p_country is null or c.country = p_country)
      and (p_city is null or c.city = p_city)
      and (coalesce(p_communication, 'all') = 'all'
        or (p_communication = 'email' and nullif(btrim(c.email), '') is not null)
        or (p_communication = 'phone' and nullif(btrim(c.phone), '') is not null)
        or (p_communication = 'either' and (nullif(btrim(c.email), '') is not null or nullif(btrim(c.phone), '') is not null))
        or (p_communication = 'both' and nullif(btrim(c.email), '') is not null and nullif(btrim(c.phone), '') is not null)
        or (p_communication = 'none' and nullif(btrim(c.email), '') is null and nullif(btrim(c.phone), '') is null))
      and (p_sector_id is null or exists (
        select 1 from public.company_sectors cs
        where cs.company_id = c.id and cs.sector_id = p_sector_id
      ))
      and (p_product_group_id is null or exists (
        select 1 from public.company_product_groups cpg
        where cpg.company_id = c.id and cpg.product_group_id = p_product_group_id
      ))
      and (p_exhibition_id is null or exists (
        select 1 from public.opportunities eo
        where eo.company_id = c.id and eo.exhibition_id = p_exhibition_id
      ))
      and (p_status is null
        or (p_status = 'Yeni Firma' and not exists (select 1 from public.opportunities so where so.company_id = c.id))
        or (p_status = 'Sözleşmeli Firma' and exists (select 1 from public.opportunities so where so.company_id = c.id and so.stage in ('signed', 'won')))
        or (p_status = 'Potansiyel Firma'
          and not exists (select 1 from public.opportunities so where so.company_id = c.id and so.stage in ('signed', 'won'))
          and exists (select 1 from public.opportunities so where so.company_id = c.id and so.stage not in ('signed', 'lost', 'won')))
        or (p_status = 'Pasif Firma'
          and exists (select 1 from public.opportunities so where so.company_id = c.id)
          and not exists (select 1 from public.opportunities so where so.company_id = c.id and so.stage in ('signed', 'won'))
          and not exists (select 1 from public.opportunities so where so.company_id = c.id and so.stage not in ('signed', 'lost', 'won'))))
      and (nullif(btrim(p_search), '') is null or
        c.company_name ilike '%' || btrim(p_search) || '%' or
        coalesce(c.email, '') ilike '%' || btrim(p_search) || '%' or
        coalesce(c.phone, '') ilike '%' || btrim(p_search) || '%' or
        coalesce(c.website, '') ilike '%' || btrim(p_search) || '%' or
        coalesce(c.city, '') ilike '%' || btrim(p_search) || '%' or
        coalesce(c.country, '') ilike '%' || btrim(p_search) || '%' or
        exists (
          select 1 from public.contacts ct
          where ct.company_id = c.id::text and (
            concat_ws(' ', ct.first_name, ct.last_name) ilike '%' || btrim(p_search) || '%' or
            coalesce(ct.email, '') ilike '%' || btrim(p_search) || '%' or
            coalesce(ct.phone, '') ilike '%' || btrim(p_search) || '%'
          )
        )
      )
  ), counted as (
    select f.*, count(*) over() as total_count
    from filtered f
    order by f.company_name, f.id
    limit greatest(1, least(coalesce(p_page_size, 50), 100))
    offset (greatest(coalesce(p_page, 1), 1) - 1) * greatest(1, least(coalesce(p_page_size, 50), 100))
  )
  select
    to_jsonb(c) - 'company_name_normalized' - 'phone_normalized' - 'email_normalized'
      - 'tax_number_normalized' - 'website_normalized' - 'address_normalized',
    coalesce(o.active_count, 0),
    case when o.next_row is null then null else to_jsonb(o.next_row) end,
    case
      when coalesce(o.all_count, 0) = 0 then 'Yeni Firma'
      when coalesce(o.has_won, false) then 'Sözleşmeli Firma'
      when coalesce(o.active_count, 0) > 0 then 'Potansiyel Firma'
      else 'Pasif Firma'
    end,
    c.total_count
  from counted c
  left join lateral (
    select
      count(*) as all_count,
      count(*) filter (where op.stage not in ('signed', 'lost', 'won')) as active_count,
      bool_or(op.stage in ('signed', 'won')) as has_won,
      (array_agg(op order by op.next_action_date asc nulls last, op.created_at desc)
        filter (where op.stage not in ('signed', 'lost', 'won')))[1] as next_row
    from public.opportunities op where op.company_id = c.id
  ) o on true;
$$;

revoke all on function public.list_company_directory_page(integer, integer, text, text, text, uuid, uuid, text, uuid, text) from public, anon;
grant execute on function public.list_company_directory_page(integer, integer, text, text, text, uuid, uuid, text, uuid, text) to authenticated;

create or replace function public.list_company_directory_options(p_country text default null)
returns jsonb
language sql stable security invoker set search_path = pg_catalog, public
as $$ select jsonb_build_object(
  'countries', coalesce((select jsonb_agg(x.country order by x.country) from (select distinct c.country from public.companies c where nullif(btrim(c.country), '') is not null) x), '[]'::jsonb),
  'cities', coalesce((select jsonb_agg(x.city order by x.city) from (select distinct c.city from public.companies c where nullif(btrim(c.city), '') is not null and (p_country is null or c.country = p_country)) x), '[]'::jsonb)
) $$;
revoke all on function public.list_company_directory_options(text) from public, anon;
grant execute on function public.list_company_directory_options(text) to authenticated;
