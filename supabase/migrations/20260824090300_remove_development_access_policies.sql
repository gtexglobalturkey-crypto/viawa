-- Remove only the verified disposable development policies. The intended
-- active-application-user policies remain in place until the next migration.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'companies', 'emails', 'exhibitions', 'opportunities', 'reminders',
        'timeline_events', 'ai_memory'
      ])
      and lower(policyname) like 'development access%'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

revoke all on table public.companies from anon;
revoke all on table public.emails from anon;
revoke all on table public.exhibitions from anon;
revoke all on table public.opportunities from anon;
revoke all on table public.reminders from anon;
revoke all on table public.timeline_events from anon;
revoke all on table public.ai_memory from anon;
