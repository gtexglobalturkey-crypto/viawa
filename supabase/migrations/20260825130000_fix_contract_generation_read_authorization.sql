begin;

-- Contract generation reads the immutable approved snapshot with the caller's
-- authenticated token. Preserve admin visibility while restoring the existing
-- UUID/email opportunity-owner semantics for active VIAWA users.
drop policy if exists approved_price_snapshots_select_active_admin
  on public.approved_price_snapshots;
drop policy if exists approved_price_snapshots_select_active_owner_or_admin
  on public.approved_price_snapshots;

create policy approved_price_snapshots_select_active_owner_or_admin
on public.approved_price_snapshots for select
to authenticated
using (
  public.is_active_application_user()
  and exists (
    select 1
    from public.opportunities opportunity
    where opportunity.id = approved_price_snapshots.opportunity_id
      and opportunity.company_id = approved_price_snapshots.company_id
      and (
        public.is_active_application_admin()
        or opportunity.owner = auth.uid()::text
        or lower(opportunity.owner) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

-- These rows contain contract-visible issuer, bank-display and document
-- configuration. Credentials and provider tokens remain server environment
-- variables and are not stored in public.document_settings.
drop policy if exists document_settings_select_active_admin
  on public.document_settings;
drop policy if exists document_settings_select_active_application_user
  on public.document_settings;

create policy document_settings_select_active_application_user
on public.document_settings for select
to authenticated
using (public.is_active_application_user());

-- Historical default grants left non-DML mutation capabilities on these
-- tables. TRUNCATE bypasses RLS, while TRIGGER/REFERENCES are not application
-- operations. Removing them does not change the intentional snapshot INSERT
-- path or any INSERT/UPDATE/DELETE policy.
revoke truncate, trigger, references on table public.approved_price_snapshots
  from authenticated;
revoke truncate, trigger, references on table public.document_settings
  from authenticated;

commit;
