-- Adds letterhead (kaşe) fields to companies. Verified against the live
-- schema on 2026-07-24 via the PostgREST API (anon key): companies only has
-- id, company_name, contact_person, email, phone, website, country,
-- industry, status, created_at, updated_at — none of the columns below
-- exist yet.
--
-- Person 2/3/4 (and, going forward, person 1's title) are handled by the
-- existing `public.contacts` table (id, company_id, first_name, last_name,
-- title, phone, email, is_primary, created_at, updated_at), which already
-- exists in this project and needs no migration.
--
-- Run this manually in the Supabase SQL editor (or via `supabase db push`
-- if you link this project to the CLI) — the app's anon key cannot execute
-- DDL, so this file is not applied automatically. Until this is run, the
-- app intentionally does NOT send these fields to Supabase (see
-- NewCompanyPage.tsx), so company/contact saving keeps working without it.

alter table public.companies
  add column if not exists tax_office text,
  add column if not exists tax_number text,
  add column if not exists postal_code text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists district text;
