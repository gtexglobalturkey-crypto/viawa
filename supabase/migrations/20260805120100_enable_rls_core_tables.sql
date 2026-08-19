-- Multi-user login (RC-AUTH) security audit finding: companies,
-- opportunities, exhibitions, reminders, emails, call_notes and
-- timeline_events were never brought under row level security by any
-- tracked migration (they predate this migrations folder) — confirmed
-- live: all seven were readable with ONLY the public anon key, no
-- Authorization/session required at all. Every other CRM table already
-- follows the "authenticated, fully shared, no per-user filtering"
-- pattern (see contacts/sectors/product_groups in earlier migrations).
-- Data remains shared between authorized VIAWA users, but Supabase Auth
-- alone is not authorization: every operation also requires the caller's
-- own active public.application_users row.
alter table public.companies enable row level security;
alter table public.opportunities enable row level security;
alter table public.exhibitions enable row level security;
alter table public.reminders enable row level security;
alter table public.emails enable row level security;
alter table public.call_notes enable row level security;
alter table public.timeline_events enable row level security;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'companies',
    'opportunities',
    'exhibitions',
    'reminders',
    'emails',
    'call_notes',
    'timeline_events'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_select_authenticated', target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_insert_authenticated', target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_update_authenticated', target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      target_table || '_delete_authenticated', target_table
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (exists (select 1 from public.application_users as application_user where application_user.id = auth.uid() and application_user.is_active))',
      target_table || '_select_authenticated', target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.application_users as application_user where application_user.id = auth.uid() and application_user.is_active))',
      target_table || '_insert_authenticated', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (exists (select 1 from public.application_users as application_user where application_user.id = auth.uid() and application_user.is_active)) with check (exists (select 1 from public.application_users as application_user where application_user.id = auth.uid() and application_user.is_active))',
      target_table || '_update_authenticated', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.application_users as application_user where application_user.id = auth.uid() and application_user.is_active))',
      target_table || '_delete_authenticated', target_table
    );
    execute format('revoke all on public.%I from anon', target_table);
  end loop;
end $$;
