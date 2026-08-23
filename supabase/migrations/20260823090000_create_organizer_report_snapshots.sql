begin;

create table if not exists public.organizer_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id text not null unique,
  exhibition_id uuid not null references public.exhibitions(id) on update cascade on delete restrict,
  period_start date,
  period_end date,
  period_label text,
  data_cutoff timestamptz not null,
  generated_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  constraint organizer_report_period_order check (
    period_start is null or period_end is null or period_start <= period_end
  )
);

create index if not exists organizer_report_snapshots_exhibition_idx
  on public.organizer_report_snapshots (exhibition_id, generated_at desc);

create or replace function public.prevent_organizer_report_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Organizer report snapshots are immutable';
end;
$$;

drop trigger if exists organizer_report_snapshots_immutable
  on public.organizer_report_snapshots;
create trigger organizer_report_snapshots_immutable
before update or delete on public.organizer_report_snapshots
for each row execute function public.prevent_organizer_report_snapshot_mutation();

alter table public.organizer_report_snapshots enable row level security;

drop policy if exists organizer_report_snapshots_select_active
  on public.organizer_report_snapshots;
create policy organizer_report_snapshots_select_active
on public.organizer_report_snapshots for select
to authenticated
using (
  exists (
    select 1
    from public.application_users as application_user
    where application_user.id = auth.uid()
      and application_user.is_active
  )
);

revoke all on public.organizer_report_snapshots from anon;
revoke all on public.organizer_report_snapshots from authenticated;
grant select on public.organizer_report_snapshots to authenticated;
grant all on public.organizer_report_snapshots to service_role;

revoke all on function public.prevent_organizer_report_snapshot_mutation() from public, anon, authenticated;
grant execute on function public.prevent_organizer_report_snapshot_mutation() to service_role;

commit;
