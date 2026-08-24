-- Master/reference writes are production-administration operations.
do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'sectors', 'product_groups', 'company_sectors',
    'company_product_groups', 'exhibition_pricing_configs'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_application_user())',
      target_table || '_select_active_application_user', target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active_application_admin())',
      target_table || '_insert_active_admin', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active_application_admin()) with check (public.is_active_application_admin())',
      target_table || '_update_active_admin', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_active_application_admin())',
      target_table || '_delete_active_admin', target_table
    );

    execute format('revoke all on table public.%I from anon', target_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', target_table);
  end loop;
end $$;

alter table public.document_settings enable row level security;
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'document_settings'
  loop
    execute format('drop policy if exists %I on public.document_settings', policy_record.policyname);
  end loop;
end $$;

create policy document_settings_select_active_admin
on public.document_settings for select
to authenticated
using (public.is_active_application_admin());

revoke all on table public.document_settings from anon;
revoke insert, update, delete on table public.document_settings from authenticated;
grant select on table public.document_settings to authenticated;
