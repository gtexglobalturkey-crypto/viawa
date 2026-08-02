-- Sprint: Automatic Company ID. Adds a permanent, unique, business-facing
-- "Firma ID" (VWA-000001, VWA-000002, ...) to every company, separate from
-- the existing `id` uuid primary key — no relationship, foreign key, or
-- route that already depends on `id` is touched.
--
-- Safety / concurrency: the format is generated with a Postgres sequence
-- (`companies_company_code_seq`) via `nextval()` as the column DEFAULT.
-- `nextval()` is atomic at the database level — two inserts racing at the
-- same instant can never receive the same number, which a frontend
-- "count existing rows + 1" approach cannot guarantee. The application
-- layer never sets or edits this column (see companyService.ts).
--
-- Existing rows are backfilled once, in `created_at` order (oldest company
-- becomes VWA-000001), and the sequence is advanced past the highest
-- backfilled number so the first newly-created company continues the same
-- sequence rather than colliding with a backfilled id.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db push`
-- if this project is linked to the CLI) — the app's anon key cannot
-- execute DDL, so this file is not applied automatically, matching every
-- other migration in this folder.

create sequence if not exists public.companies_company_code_seq;

alter table public.companies
  add column if not exists company_code text;

-- Backfill existing companies that don't have a code yet, oldest first.
with ordered_companies as (
  select
    id,
    row_number() over (
      order by created_at, id
    ) as row_number
  from public.companies
  where company_code is null
)
update public.companies as companies
set company_code =
  'VWA-' || lpad(ordered_companies.row_number::text, 6, '0')
from ordered_companies
where companies.id = ordered_companies.id;

-- Advance the sequence past whatever was just backfilled so the next
-- generated code continues the run instead of colliding with it.
select setval(
  'public.companies_company_code_seq',
  coalesce(
    (
      select max(substring(company_code from 5)::int)
      from public.companies
      where company_code ~ '^VWA-[0-9]+$'
    ),
    0
  ),
  true
);

-- New rows get their code from the sequence automatically — the app never
-- sends this column on insert.
alter table public.companies
  alter column company_code
  set default (
    'VWA-' || lpad(
      nextval('public.companies_company_code_seq')::text,
      6,
      '0'
    )
  );

alter table public.companies
  alter column company_code set not null;

create unique index if not exists companies_company_code_unique
  on public.companies (company_code);
