begin;

create table if not exists public.commercial_area_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('offer_issued', 'contract_completed')),
  company_id uuid not null references public.companies(id) on update cascade on delete restrict,
  opportunity_id uuid not null references public.opportunities(id) on update cascade on delete restrict,
  exhibition_id uuid not null references public.exhibitions(id) on update cascade on delete restrict,
  approved_price_snapshot_id uuid not null references public.approved_price_snapshots(id) on update cascade on delete restrict,
  area_sqm numeric not null check (area_sqm > 0),
  occurred_at timestamptz not null default now(),
  event_operation_key text not null unique check (length(btrim(event_operation_key)) > 0),
  artifact_id text not null check (length(btrim(artifact_id)) > 0),
  artifact_revision integer not null check (artifact_revision > 0),
  created_at timestamptz not null default now()
);

create index if not exists commercial_area_events_exhibition_period_idx
  on public.commercial_area_events (exhibition_id, event_type, occurred_at);

create index if not exists commercial_area_events_opportunity_idx
  on public.commercial_area_events (opportunity_id, occurred_at);

create or replace function public.prevent_commercial_area_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Commercial area events are immutable';
end;
$$;

drop trigger if exists commercial_area_events_immutable
  on public.commercial_area_events;
create trigger commercial_area_events_immutable
before update or delete on public.commercial_area_events
for each row execute function public.prevent_commercial_area_event_mutation();

alter table public.commercial_area_events enable row level security;

drop policy if exists commercial_area_events_select_active
  on public.commercial_area_events;
create policy commercial_area_events_select_active
on public.commercial_area_events for select
to authenticated
using (
  exists (
    select 1
    from public.application_users as application_user
    where application_user.id = auth.uid()
      and application_user.is_active
  )
);

revoke all on table public.commercial_area_events from public, anon, authenticated, service_role;
grant select on table public.commercial_area_events to authenticated, service_role;

create or replace function public.create_commercial_area_event(
  requested_event_type text,
  requested_company_id uuid,
  requested_opportunity_id uuid,
  requested_exhibition_id uuid,
  requested_approved_price_snapshot_id uuid,
  requested_event_operation_key text,
  requested_artifact_id text,
  requested_artifact_revision integer
)
returns public.commercial_area_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_area_sqm numeric;
  created_event public.commercial_area_events;
  existing_event public.commercial_area_events;
begin
  if requested_event_type not in ('offer_issued', 'contract_completed') then
    raise exception 'Unsupported commercial area event type';
  end if;

  if length(btrim(coalesce(requested_event_operation_key, ''))) = 0
    or length(btrim(coalesce(requested_artifact_id, ''))) = 0
    or requested_artifact_revision is null
    or requested_artifact_revision <= 0 then
    raise exception 'Commercial area event identity is invalid';
  end if;

  select (snapshot.price_input ->> 'standAreaSqm')::numeric
  into resolved_area_sqm
  from public.approved_price_snapshots as snapshot
  join public.opportunities as opportunity
    on opportunity.id = requested_opportunity_id
   and opportunity.company_id = requested_company_id
   and opportunity.exhibition_id = requested_exhibition_id
  where snapshot.id = requested_approved_price_snapshot_id
    and snapshot.company_id = requested_company_id
    and snapshot.opportunity_id = requested_opportunity_id
    and snapshot.exhibition_id = requested_exhibition_id
    and jsonb_typeof(snapshot.price_input -> 'standAreaSqm') = 'number';

  if resolved_area_sqm is null or resolved_area_sqm <= 0 then
    raise exception 'Approved price snapshot has no valid positive stand area';
  end if;

  begin
    insert into public.commercial_area_events (
      event_type,
      company_id,
      opportunity_id,
      exhibition_id,
      approved_price_snapshot_id,
      area_sqm,
      occurred_at,
      event_operation_key,
      artifact_id,
      artifact_revision
    ) values (
      requested_event_type,
      requested_company_id,
      requested_opportunity_id,
      requested_exhibition_id,
      requested_approved_price_snapshot_id,
      resolved_area_sqm,
      now(),
      btrim(requested_event_operation_key),
      btrim(requested_artifact_id),
      requested_artifact_revision
    )
    returning * into created_event;

    return created_event;
  exception when unique_violation then
    select * into existing_event
    from public.commercial_area_events
    where event_operation_key = btrim(requested_event_operation_key);

    if existing_event.id is null
      or existing_event.event_type <> requested_event_type
      or existing_event.company_id <> requested_company_id
      or existing_event.opportunity_id <> requested_opportunity_id
      or existing_event.exhibition_id <> requested_exhibition_id
      or existing_event.approved_price_snapshot_id <> requested_approved_price_snapshot_id
      or existing_event.artifact_id <> btrim(requested_artifact_id)
      or existing_event.artifact_revision <> requested_artifact_revision then
      raise exception 'Commercial area event operation key collision';
    end if;

    return existing_event;
  end;
end;
$$;

revoke all on function public.create_commercial_area_event(text, uuid, uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_commercial_area_event(text, uuid, uuid, uuid, uuid, text, text, integer)
  to service_role;

revoke all on function public.prevent_commercial_area_event_mutation()
  from public, anon, authenticated, service_role;

commit;
