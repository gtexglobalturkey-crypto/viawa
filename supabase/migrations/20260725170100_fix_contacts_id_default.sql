-- Fixes the real root cause found live on 2026-07-24: contacts INSERT now
-- passes RLS (previous fix applied) but fails with:
--   23502 — null value in column "id" of relation "contacts" violates
--   not-null constraint
--
-- contactService.ts (createContact) intentionally omits `id` from the
-- insert payload, the same convention every other table in this schema
-- follows (companyService.createCompany, etc.) — it relies on the column
-- having `default gen_random_uuid()`. Every other table already has this
-- default; `contacts` (pre-existing, unused until this feature) does not,
-- so the app never generates or sends an id, and the column has nothing to
-- fall back on.
--
-- This only sets a default on the existing id column — no table, no new
-- column, no data touched.

alter table public.contacts
  alter column id set default gen_random_uuid();
