-- Approved prices are authoritative commercial records. Active VIAWA admins
-- may read and create them across the shared operational workspace, while the
-- snapshot must remain linked to the exact opportunity/company/exhibition.

drop policy if exists approved_price_snapshots_select_active_owner
  on public.approved_price_snapshots;
drop policy if exists approved_price_snapshots_insert_active_owner
  on public.approved_price_snapshots;
drop policy if exists approved_price_snapshots_select_active_admin
  on public.approved_price_snapshots;
drop policy if exists approved_price_snapshots_insert_active_admin
  on public.approved_price_snapshots;

create policy approved_price_snapshots_select_active_admin
on public.approved_price_snapshots for select to authenticated
using (
  public.is_active_application_admin()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = approved_price_snapshots.opportunity_id
      and opportunity.company_id = approved_price_snapshots.company_id
  )
);

create policy approved_price_snapshots_insert_active_admin
on public.approved_price_snapshots for insert to authenticated
with check (
  public.is_active_application_admin()
  and created_by = auth.uid()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = approved_price_snapshots.opportunity_id
      and opportunity.company_id = approved_price_snapshots.company_id
      and opportunity.exhibition_id = approved_price_snapshots.exhibition_id
  )
);
