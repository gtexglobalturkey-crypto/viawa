-- Central VIAWA authorization predicates. These functions deliberately have no
-- caller-controlled arguments and read only the current auth.uid() row.
create or replace function public.is_active_application_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.application_users application_user
    where application_user.id = auth.uid()
      and application_user.is_active
  );
$$;

create or replace function public.is_active_application_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.application_users application_user
    where application_user.id = auth.uid()
      and application_user.is_active
      and application_user.role = 'admin'
  );
$$;

revoke all on function public.is_active_application_user() from public, anon;
revoke all on function public.is_active_application_admin() from public, anon;
grant execute on function public.is_active_application_user() to authenticated, service_role;
grant execute on function public.is_active_application_admin() to authenticated, service_role;
