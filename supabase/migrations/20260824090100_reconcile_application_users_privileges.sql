-- Reconcile application_users table privileges without modifying any rows.
revoke all on table public.application_users from anon;
revoke insert, update, delete on table public.application_users from authenticated;
grant select on table public.application_users to authenticated;
