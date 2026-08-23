begin;

create table public.organizer_report_email_sends (
  id uuid primary key default gen_random_uuid(),
  organizer_report_snapshot_id uuid not null references public.organizer_report_snapshots(id) on update cascade on delete restrict,
  organizer_report_id text not null,
  recipient text not null check (length(btrim(recipient)) > 3),
  sender_alias text not null check (length(btrim(sender_alias)) > 3),
  provider text not null default 'gmail' check (provider = 'gmail'),
  provider_message_id text unique,
  provider_accepted_at timestamptz,
  status text not null check (status in ('pending', 'accepted', 'failed', 'unknown')),
  send_operation_key text not null unique check (length(send_operation_key) = 64),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_error_code text,
  created_by uuid references auth.users(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizer_report_email_acceptance_complete check (
    (status = 'accepted' and provider_message_id is not null and provider_accepted_at is not null)
    or (status <> 'accepted' and provider_message_id is null and provider_accepted_at is null)
  )
);

create index organizer_report_email_sends_report_idx
  on public.organizer_report_email_sends (organizer_report_snapshot_id, created_at desc);

create or replace function public.protect_organizer_report_email_send()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Organizer report email evidence cannot be deleted';
  end if;
  if old.status in ('accepted', 'unknown') then
    raise exception 'Final organizer report email evidence is immutable';
  end if;
  if new.id <> old.id
    or new.organizer_report_snapshot_id <> old.organizer_report_snapshot_id
    or new.organizer_report_id <> old.organizer_report_id
    or new.recipient <> old.recipient
    or new.sender_alias <> old.sender_alias
    or new.provider <> old.provider
    or new.send_operation_key <> old.send_operation_key
    or new.created_by is distinct from old.created_by
    or new.created_at <> old.created_at then
    raise exception 'Organizer report email identity is immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizer_report_email_sends_protected
before update or delete on public.organizer_report_email_sends
for each row execute function public.protect_organizer_report_email_send();

alter table public.organizer_report_email_sends enable row level security;

revoke all on public.organizer_report_email_sends from public, anon, authenticated, service_role;
grant select, insert, update on public.organizer_report_email_sends to service_role;

revoke all on function public.protect_organizer_report_email_send() from public, anon, authenticated, service_role;

commit;
