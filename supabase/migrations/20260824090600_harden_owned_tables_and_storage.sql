-- Preserve opportunity ownership and add active VIAWA membership.
alter table public.approved_price_snapshots enable row level security;
do $$
declare policy_record record;
begin
  for policy_record in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'approved_price_snapshots'
  loop
    execute format('drop policy if exists %I on public.approved_price_snapshots', policy_record.policyname);
  end loop;
end $$;

create policy approved_price_snapshots_select_active_owner
on public.approved_price_snapshots for select to authenticated
using (
  public.is_active_application_user()
  and exists (
    select 1 from public.opportunities opportunity
    where opportunity.id = approved_price_snapshots.opportunity_id
      and opportunity.company_id = approved_price_snapshots.company_id
      and (opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

create policy approved_price_snapshots_insert_active_owner
on public.approved_price_snapshots for insert to authenticated
with check (
  public.is_active_application_user()
  and created_by = auth.uid()
  and exists (
    select 1 from public.opportunities opportunity
    where opportunity.id = approved_price_snapshots.opportunity_id
      and opportunity.company_id = approved_price_snapshots.company_id
      and opportunity.exhibition_id = approved_price_snapshots.exhibition_id
      and (opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

revoke all on table public.approved_price_snapshots from anon;
revoke update, delete on table public.approved_price_snapshots from authenticated;
grant select, insert on table public.approved_price_snapshots to authenticated;

alter table public.contract_numbers enable row level security;
do $$
declare policy_record record;
begin
  for policy_record in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'contract_numbers'
  loop
    execute format('drop policy if exists %I on public.contract_numbers', policy_record.policyname);
  end loop;
end $$;

create policy contract_numbers_select_active_owner
on public.contract_numbers for select to authenticated
using (
  public.is_active_application_user()
  and exists (
    select 1 from public.opportunities opportunity
    where opportunity.id = contract_numbers.opportunity_id
      and opportunity.company_id = contract_numbers.company_id
      and (opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
);

revoke all on table public.contract_numbers from anon;
revoke insert, update, delete on table public.contract_numbers from authenticated;
grant select on table public.contract_numbers to authenticated;

-- Preserve the private bucket and caller UUID prefix while requiring active
-- application membership. The verified four bucket-specific policies are
-- replaced by exact-name operations; unrelated Storage policies are untouched.
drop policy if exists "VIAWA users can upload their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can read their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can update their own contract documents" on storage.objects;
drop policy if exists "VIAWA users can delete their own contract documents" on storage.objects;
drop policy if exists "Active VIAWA users can upload their own contract documents" on storage.objects;
drop policy if exists "Active VIAWA users can read their own contract documents" on storage.objects;
drop policy if exists "Active VIAWA users can update their own contract documents" on storage.objects;
drop policy if exists "Active VIAWA users can delete their own contract documents" on storage.objects;

create policy "Active VIAWA users can upload their own contract documents"
on storage.objects for insert to authenticated
with check (bucket_id = 'contract-documents'
  and public.is_active_application_user()
  and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Active VIAWA users can read their own contract documents"
on storage.objects for select to authenticated
using (bucket_id = 'contract-documents'
  and public.is_active_application_user()
  and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Active VIAWA users can update their own contract documents"
on storage.objects for update to authenticated
using (bucket_id = 'contract-documents'
  and public.is_active_application_user()
  and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'contract-documents'
  and public.is_active_application_user()
  and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Active VIAWA users can delete their own contract documents"
on storage.objects for delete to authenticated
using (bucket_id = 'contract-documents'
  and public.is_active_application_user()
  and (storage.foldername(name))[1] = auth.uid()::text);
