-- Sprint: VIAWA Multi-Sector and Product Group Data Model.
--
-- Adds a normalized master-list + ordered-relation model for up to 4
-- sectors and 4 product groups per company, replacing the single
-- free-text `companies.industry` field as the source of truth for
-- sector data while keeping `industry` itself intact and in sync
-- (backward compatibility — nothing reads/writes it directly anymore
-- after this sprint's app-layer changes, but it is never dropped or
-- left stale: company_sectors position 1 is mirrored into it below,
-- both for the one-time backfill and going forward from the app).
--
-- New tables:
--   sectors                 — master list (id, name, normalized_name, is_active)
--   product_groups          — master list (id, name, normalized_name, is_active)
--   company_sectors         — company -> sector, ordered 1-4, max 4 per company
--   company_product_groups  — company -> product_group, ordered 1-4, max 4 per company
--
-- Normalization (trim + collapse whitespace + Turkish-locale-aware
-- lowercase) happens in the app layer (src/core/normalization/
-- masterListName.ts) before every insert — `normalized_name` here is
-- the already-normalized value, with a plain UNIQUE index as the
-- database-level backstop, following the same pattern as
-- supabase/migrations/20260724_add_company_duplicate_unique_constraints.sql.
--
-- RLS follows the exact convention established in
-- supabase/migrations/20260724_fix_contacts_rls_policies.sql: RLS
-- enabled, one policy per CRUD verb, `to authenticated` only — anon is
-- deliberately not granted read or write on any of the 4 new tables.
--
-- `replace_company_sectors` / `replace_company_product_groups` are this
-- project's first Postgres functions (no RPC existed before this
-- migration — confirmed by grepping every prior migration and the app
-- source). They exist for exactly one reason: replacing a company's
-- ordered sector/product-group set is a delete-then-insert, and doing
-- that as two separate round trips from the browser risks leaving a
-- company with zero sectors if the app/network dies between them. A
-- single Postgres function call is atomic, so this is the smallest
-- possible fix for that specific risk, not a general RPC architecture.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI) — the app's anon key
-- cannot execute DDL, so this file is not applied automatically,
-- matching every other migration in this folder. Statements use
-- `if not exists` / `create or replace` throughout so the file can be
-- re-run safely if it partially applied.

-- ---------------------------------------------------------------------
-- 1. Master lists
-- ---------------------------------------------------------------------

create table if not exists public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists sectors_normalized_name_unique
  on public.sectors (normalized_name);

create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists product_groups_normalized_name_unique
  on public.product_groups (normalized_name);

-- ---------------------------------------------------------------------
-- 2. Ordered company relations (max 4 each, enforced by the position
--    check + the (company_id, position) unique index together)
-- ---------------------------------------------------------------------

create table if not exists public.company_sectors (
  company_id uuid not null references public.companies (id) on delete cascade,
  sector_id uuid not null references public.sectors (id),
  position smallint not null,

  constraint company_sectors_pkey
    primary key (company_id, sector_id),
  constraint company_sectors_position_range
    check (position between 1 and 4)
);

create unique index if not exists company_sectors_company_position_unique
  on public.company_sectors (company_id, position);

create table if not exists public.company_product_groups (
  company_id uuid not null references public.companies (id) on delete cascade,
  product_group_id uuid not null references public.product_groups (id),
  position smallint not null,

  constraint company_product_groups_pkey
    primary key (company_id, product_group_id),
  constraint company_product_groups_position_range
    check (position between 1 and 4)
);

create unique index if not exists company_product_groups_company_position_unique
  on public.company_product_groups (company_id, position);

-- ---------------------------------------------------------------------
-- 3. RLS — identical shape to contacts (see file header)
-- ---------------------------------------------------------------------

alter table public.sectors enable row level security;
alter table public.product_groups enable row level security;
alter table public.company_sectors enable row level security;
alter table public.company_product_groups enable row level security;

drop policy if exists "Authenticated users can read sectors" on public.sectors;
drop policy if exists "Authenticated users can insert sectors" on public.sectors;
drop policy if exists "Authenticated users can update sectors" on public.sectors;
drop policy if exists "Authenticated users can delete sectors" on public.sectors;

create policy "Authenticated users can read sectors"
  on public.sectors for select to authenticated using (true);
create policy "Authenticated users can insert sectors"
  on public.sectors for insert to authenticated with check (true);
create policy "Authenticated users can update sectors"
  on public.sectors for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete sectors"
  on public.sectors for delete to authenticated using (true);

drop policy if exists "Authenticated users can read product groups" on public.product_groups;
drop policy if exists "Authenticated users can insert product groups" on public.product_groups;
drop policy if exists "Authenticated users can update product groups" on public.product_groups;
drop policy if exists "Authenticated users can delete product groups" on public.product_groups;

create policy "Authenticated users can read product groups"
  on public.product_groups for select to authenticated using (true);
create policy "Authenticated users can insert product groups"
  on public.product_groups for insert to authenticated with check (true);
create policy "Authenticated users can update product groups"
  on public.product_groups for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete product groups"
  on public.product_groups for delete to authenticated using (true);

drop policy if exists "Authenticated users can read company sectors" on public.company_sectors;
drop policy if exists "Authenticated users can insert company sectors" on public.company_sectors;
drop policy if exists "Authenticated users can update company sectors" on public.company_sectors;
drop policy if exists "Authenticated users can delete company sectors" on public.company_sectors;

create policy "Authenticated users can read company sectors"
  on public.company_sectors for select to authenticated using (true);
create policy "Authenticated users can insert company sectors"
  on public.company_sectors for insert to authenticated with check (true);
create policy "Authenticated users can update company sectors"
  on public.company_sectors for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete company sectors"
  on public.company_sectors for delete to authenticated using (true);

drop policy if exists "Authenticated users can read company product groups" on public.company_product_groups;
drop policy if exists "Authenticated users can insert company product groups" on public.company_product_groups;
drop policy if exists "Authenticated users can update company product groups" on public.company_product_groups;
drop policy if exists "Authenticated users can delete company product groups" on public.company_product_groups;

create policy "Authenticated users can read company product groups"
  on public.company_product_groups for select to authenticated using (true);
create policy "Authenticated users can insert company product groups"
  on public.company_product_groups for insert to authenticated with check (true);
create policy "Authenticated users can update company product groups"
  on public.company_product_groups for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete company product groups"
  on public.company_product_groups for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- 4. Atomic "replace ordered relation" functions
-- ---------------------------------------------------------------------

create or replace function public.replace_company_sectors(
  p_company_id uuid,
  p_sector_ids uuid[]
) returns void
language plpgsql
security invoker
as $$
begin
  delete from public.company_sectors where company_id = p_company_id;

  insert into public.company_sectors (company_id, sector_id, position)
  select p_company_id, sector_id, ordinality::smallint
  from unnest(p_sector_ids) with ordinality as t (sector_id, ordinality)
  where ordinality <= 4;

  update public.companies
  set industry = (
    select s.name
    from public.company_sectors cs
    join public.sectors s on s.id = cs.sector_id
    where cs.company_id = p_company_id and cs.position = 1
  )
  where id = p_company_id;
end;
$$;

revoke all on function public.replace_company_sectors(uuid, uuid[]) from public;
grant execute on function public.replace_company_sectors(uuid, uuid[]) to authenticated;

create or replace function public.replace_company_product_groups(
  p_company_id uuid,
  p_product_group_ids uuid[]
) returns void
language plpgsql
security invoker
as $$
begin
  delete from public.company_product_groups where company_id = p_company_id;

  insert into public.company_product_groups (company_id, product_group_id, position)
  select p_company_id, product_group_id, ordinality::smallint
  from unnest(p_product_group_ids) with ordinality as t (product_group_id, ordinality)
  where ordinality <= 4;
end;
$$;

revoke all on function public.replace_company_product_groups(uuid, uuid[]) from public;
grant execute on function public.replace_company_product_groups(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Backfill: every existing company with a non-null industry gets a
--    matching sectors row (find-or-create by normalized name, matching
--    the app's own normalization) and a company_sectors position-1
--    row. companies.industry itself is left completely untouched here
--    — this only ADDS rows, it never overwrites existing company data.
--    Safe to re-run: existing sectors are matched by normalized_name,
--    existing company_sectors position-1 rows are left as-is (the
--    insert below only targets companies that don't already have one).
--
--    Postgres's plain lower() is not Turkish-aware (it follows the
--    database's collation, not a per-call locale), so ASCII 'İ'/'I'
--    are replaced before lower() to match the app-side normalizer
--    (src/core/normalization/masterListName.ts, which uses
--    toLocaleLowerCase("tr")) — this makes "Gıda"/"GIDA"/"gıda" all
--    backfill to the same normalized_name, exactly like new app-layer
--    writes will.
-- ---------------------------------------------------------------------

insert into public.sectors (name, normalized_name)
select distinct
  trim(regexp_replace(c.industry, '\s+', ' ', 'g')),
  lower(replace(replace(
    trim(regexp_replace(c.industry, '\s+', ' ', 'g')),
    'İ', 'i'), 'I', 'ı'))
from public.companies c
where c.industry is not null
  and trim(c.industry) <> ''
  and not exists (
    select 1 from public.sectors s
    where s.normalized_name =
      lower(replace(replace(
        trim(regexp_replace(c.industry, '\s+', ' ', 'g')),
        'İ', 'i'), 'I', 'ı'))
  )
on conflict (normalized_name) do nothing;

insert into public.company_sectors (company_id, sector_id, position)
select c.id, s.id, 1
from public.companies c
join public.sectors s
  on s.normalized_name =
     lower(replace(replace(
       trim(regexp_replace(c.industry, '\s+', ' ', 'g')),
       'İ', 'i'), 'I', 'ı'))
where c.industry is not null
  and trim(c.industry) <> ''
  and not exists (
    select 1 from public.company_sectors cs
    where cs.company_id = c.id and cs.position = 1
  )
on conflict (company_id, sector_id) do nothing;
