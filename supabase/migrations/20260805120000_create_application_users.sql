-- Multi-user login (RC-AUTH) — a Supabase Auth account alone is not
-- sufficient for VIAWA access. This table is the single source of truth
-- for "is this authenticated person allowed into the app, and with what
-- role." Rows are created/edited only via the Supabase Dashboard
-- (Authentication -> Users, then this table), never by the app itself —
-- see README "VIAWA Kullanıcısı Ekleme". Minimum two roles for now, no
-- further permission system.
create table if not exists public.application_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'representative'
    check (role in ('admin', 'representative')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_users enable row level security;

-- The app only ever needs to answer "am I allowed in, and as what role"
-- for the CURRENTLY signed-in user — never to browse other users' rows.
-- Row creation/editing stays Dashboard-only (service role), so no
-- insert/update/delete policy is defined for authenticated users at all.
drop policy if exists application_users_select_self
  on public.application_users;

create policy application_users_select_self
  on public.application_users for select
  to authenticated
  using (id = auth.uid());

revoke all on public.application_users from anon;
revoke insert, update, delete on public.application_users from authenticated;
grant select on public.application_users to authenticated;

-- Environment-specific application users are fixtures, not schema. Create the
-- Auth identity first, then add the matching application_users row through the
-- controlled environment bootstrap. No production identity is seeded here.
