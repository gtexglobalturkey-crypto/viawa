-- Fixes RLS on public.contacts so authenticated app users can actually
-- read/write contact rows (Kişi 1-4). Verified live on 2026-07-24: contacts
-- SELECT works for the anon role (200), but INSERT is rejected with
-- 42501 "new row violates row-level security policy" — no INSERT/UPDATE/
-- DELETE policy exists for any role on this table yet, so every contact
-- save in NewCompanyPage.tsx has been silently failing (0 rows in the
-- table). Anon is intentionally NOT granted write access here.
--
-- Run this in the Supabase Dashboard SQL Editor for project qpyqqkkkparobyucnqgb
-- (ATLAS / production), or via `supabase db push` if linked via the CLI.

alter table public.contacts enable row level security;

drop policy if exists "Authenticated users can read contacts"
  on public.contacts;

drop policy if exists "Authenticated users can insert contacts"
  on public.contacts;

drop policy if exists "Authenticated users can update contacts"
  on public.contacts;

drop policy if exists "Authenticated users can delete contacts"
  on public.contacts;

drop policy if exists "Allow authenticated write access to contacts"
  on public.contacts;

create policy "Authenticated users can read contacts"
  on public.contacts
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert contacts"
  on public.contacts
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update contacts"
  on public.contacts
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete contacts"
  on public.contacts
  for delete
  to authenticated
  using (true);
