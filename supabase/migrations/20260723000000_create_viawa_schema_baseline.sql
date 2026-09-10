-- VIAWA schema foundation recovered from the schema-only production reference.
--
-- This migration intentionally contains only VIAWA-owned objects that predate
-- the checked-in migration history. Later migrations remain responsible for
-- every subsequently added column, constraint, policy, function and table.
-- It contains no production rows, auth identities, credentials or storage data.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- VIAWA-specific function present in the production foundation. The production
-- public-schema reference contains no event-trigger binding, so none is invented.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
      and cmd.schema_name in ('public')
      and cmd.schema_name not in ('pg_catalog', 'information_schema')
      and cmd.schema_name not like 'pg_toast%'
      and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)',
        cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text,
  email text,
  phone text,
  website text,
  country text,
  industry text,
  status text not null default 'lead',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Required by the first checked-in migration. The following migration also
  -- declares them with IF NOT EXISTS as part of its wider letterhead change.
  tax_number text,
  address text
);

create table public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text,
  sector text,
  organizer text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id text primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  company_id text not null,
  first_name text not null,
  last_name text not null,
  title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  exhibition_id uuid
    references public.exhibitions(id) on delete set null,
  stage text not null default 'new',
  interest_level integer not null default 0,
  estimated_value numeric(14,2) not null default 0,
  next_action text,
  next_action_date timestamptz,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  title text not null,
  due_date timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  subject text,
  body text,
  status text not null default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.call_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  opportunity_id uuid,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  opportunity_id uuid
    references public.opportunities(id) on delete cascade,
  type text,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.ai_memory (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies(id) on delete cascade,
  summary text,
  risk text,
  recommendation text,
  confidence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_memory_company_unique unique (company_id)
);

create table public.ai_memories (
  id text primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  company_id text not null,
  opportunity_id text,
  category text not null
    check (category in ('general', 'customer-preference', 'objection', 'pricing', 'commitment', 'next-step')),
  content text not null,
  importance integer not null default 5 check (importance between 1 and 10),
  source_timeline_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  company_id text,
  opportunity_id text,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index companies_company_name_idx on public.companies(company_name);
create index contacts_company_id_idx on public.contacts(company_id);
create index opportunities_company_id_idx on public.opportunities(company_id);
create index opportunities_exhibition_id_idx on public.opportunities(exhibition_id);
create index opportunities_next_action_date_idx on public.opportunities(next_action_date);
create index reminders_company_id_idx on public.reminders(company_id);
create index reminders_due_date_idx on public.reminders(due_date);
create index emails_company_id_idx on public.emails(company_id);
create index timeline_events_company_id_idx on public.timeline_events(company_id);
create index timeline_events_opportunity_id_idx on public.timeline_events(opportunity_id);
create index timeline_events_created_at_idx on public.timeline_events(created_at desc);
create index ai_memory_company_id_idx on public.ai_memory(company_id);
create index ai_memories_company_id_idx on public.ai_memories(company_id);
create index ai_memories_importance_idx on public.ai_memories(importance desc);
create index tasks_company_id_idx on public.tasks(company_id);
create index tasks_due_at_idx on public.tasks(due_at);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create trigger emails_set_updated_at
before update on public.emails
for each row execute function public.set_updated_at();

create trigger exhibitions_set_updated_at
before update on public.exhibitions
for each row execute function public.set_updated_at();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function public.set_updated_at();

create trigger reminders_set_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

create trigger ai_memory_set_updated_at
before update on public.ai_memory
for each row execute function public.set_updated_at();

create trigger ai_memories_set_updated_at
before update on public.ai_memories
for each row execute function public.set_updated_at();

grant all on table public.companies, public.contacts, public.exhibitions,
  public.opportunities, public.reminders, public.emails, public.call_notes,
  public.timeline_events, public.ai_memory, public.ai_memories, public.tasks
to authenticated, service_role;

grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.rls_auto_enable() to authenticated, service_role;
