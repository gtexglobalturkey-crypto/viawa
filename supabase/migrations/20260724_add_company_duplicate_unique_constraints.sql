-- Sprint 18.4 — database-level safety net for company duplicate
-- prevention. The application layer (src/core/validation/
-- companyDuplicateCheck.ts) already blocks duplicate phone / email /
-- tax_number / website / address before save, but a single frontend
-- check is not enough on its own (races, direct API calls, future
-- integrations) — this adds real UNIQUE constraints on normalized,
-- generated columns so the database itself rejects a duplicate.
--
-- Normalization here mirrors src/core/validation/companyDuplicateCheck.ts
-- as closely as SQL allows:
--   company_name -> trim, collapse repeated whitespace, lower
--   phone        -> digits only
--   email        -> trim + lower
--   tax_number   -> trim, whitespace stripped
--   website      -> trim, lower, strip http(s)://, strip www., strip
--                   trailing slash(es)
--   address      -> trim, collapse repeated whitespace, lower
--
-- Empty/null values are excluded from the unique indexes (partial
-- indexes with a `<> ''` predicate), matching the app rule that blank
-- fields are never treated as duplicates.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI). Nothing here is applied
-- automatically — verify on a copy of the data first, since existing
-- rows that already collide under this normalization will make the
-- migration fail until those rows are cleaned up.

alter table public.companies
  add column if not exists company_name_normalized text
    generated always as (
      lower(regexp_replace(trim(coalesce(company_name, '')), '\s+', ' ', 'g'))
    ) stored,
  add column if not exists phone_normalized text
    generated always as (
      regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
    ) stored,
  add column if not exists email_normalized text
    generated always as (
      lower(trim(coalesce(email, '')))
    ) stored,
  add column if not exists tax_number_normalized text
    generated always as (
      regexp_replace(trim(coalesce(tax_number, '')), '\s', '', 'g')
    ) stored,
  add column if not exists website_normalized text
    generated always as (
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(trim(coalesce(website, ''))),
            '^https?://', ''
          ),
          '^www\.', ''
        ),
        '/+$', ''
      )
    ) stored,
  add column if not exists address_normalized text
    generated always as (
      lower(regexp_replace(trim(coalesce(address, '')), '\s+', ' ', 'g'))
    ) stored;

create unique index if not exists companies_company_name_normalized_unique
  on public.companies (company_name_normalized)
  where company_name_normalized <> '';

create unique index if not exists companies_phone_normalized_unique
  on public.companies (phone_normalized)
  where phone_normalized <> '';

create unique index if not exists companies_email_normalized_unique
  on public.companies (email_normalized)
  where email_normalized <> '';

create unique index if not exists companies_tax_number_normalized_unique
  on public.companies (tax_number_normalized)
  where tax_number_normalized <> '';

create unique index if not exists companies_website_normalized_unique
  on public.companies (website_normalized)
  where website_normalized <> '';

create unique index if not exists companies_address_normalized_unique
  on public.companies (address_normalized)
  where address_normalized <> '';
