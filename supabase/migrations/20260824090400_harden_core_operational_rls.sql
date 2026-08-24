-- Replace every verified policy on core operational tables with one canonical
-- active-application-user policy per CRUD command. This also removes duplicate
-- broad/own-user call_notes policies without changing the shared CRM workflow.
do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'companies', 'contacts', 'opportunities', 'exhibitions', 'reminders',
    'emails', 'call_notes', 'timeline_events', 'ai_memory'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_application_user())',
      target_table || '_select_active_application_user', target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active_application_user())',
      target_table || '_insert_active_application_user', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active_application_user()) with check (public.is_active_application_user())',
      target_table || '_update_active_application_user', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_active_application_user())',
      target_table || '_delete_active_application_user', target_table
    );

    execute format('revoke all on table public.%I from anon', target_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', target_table);
  end loop;
end $$;

-- These two live tables are intentionally user-owned in addition to requiring
-- active VIAWA membership.
alter table public.ai_memories enable row level security;
alter table public.tasks enable row level security;

do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array['ai_memories', 'tasks']
  loop
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_application_user() and user_id = auth.uid())',
      target_table || '_select_active_owner', target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active_application_user() and user_id = auth.uid())',
      target_table || '_insert_active_owner', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active_application_user() and user_id = auth.uid()) with check (public.is_active_application_user() and user_id = auth.uid())',
      target_table || '_update_active_owner', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_active_application_user() and user_id = auth.uid())',
      target_table || '_delete_active_owner', target_table
    );

    execute format('revoke all on table public.%I from anon', target_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', target_table);
  end loop;
end $$;
