-- Sprint 18.4 — database-level safety net for contact duplicate
-- prevention. Root cause found live: the same email (e.g. ino@atlas.com)
-- existed on two DIFFERENT contacts belonging to two DIFFERENT companies
-- — the companies-level UNIQUE constraints (already applied) never
-- covered this, since a duplicate email/phone can live entirely inside
-- public.contacts without ever touching public.companies.
--
-- New rule: a contact's email and phone must each belong to exactly one
-- person, system-wide (across every company). The application layer
-- (src/core/validation/contactDuplicateCheck.ts) already blocks this
-- before save, but that alone is not enough (races, direct API calls) —
-- this adds real UNIQUE constraints on normalized, generated columns so
-- the database itself rejects a duplicate.
--
-- Normalization here mirrors src/core/validation/contactDuplicateCheck.ts:
--   email -> trim + lower
--   phone -> digits only
--
-- Empty/null values are excluded from the unique indexes (partial
-- indexes with a `<> ''` predicate) — blank fields are never treated as
-- duplicates.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI). Nothing here is applied
-- automatically — run the read-only check query first (see this
-- sprint's chat) to confirm no existing contacts already collide under
-- this normalization, or the UNIQUE index creation below will fail.

alter table public.contacts
  add column if not exists email_normalized text
    generated always as (
      lower(trim(coalesce(email, '')))
    ) stored,
  add column if not exists phone_normalized text
    generated always as (
      regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
    ) stored;

create unique index if not exists contacts_email_normalized_unique
  on public.contacts (email_normalized)
  where email_normalized <> '';

create unique index if not exists contacts_phone_normalized_unique
  on public.contacts (phone_normalized)
  where phone_normalized <> '';
