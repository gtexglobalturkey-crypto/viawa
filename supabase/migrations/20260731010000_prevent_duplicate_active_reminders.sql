alter table public.reminders
  add column if not exists opportunity_id uuid null
    references public.opportunities (id) on delete set null,
  add column if not exists task_type text null;

with ranked_legacy_duplicates as (
  select
    id,
    row_number() over (
      partition by
        company_id,
        lower(regexp_replace(trim(title), '\s+', ' ', 'g')),
        due_date
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.reminders
  where completed = false
    and opportunity_id is null
    and task_type is null
), completed_duplicates as (
  update public.reminders as reminder
  set completed = true
  from ranked_legacy_duplicates as duplicate
  where reminder.id = duplicate.id
    and duplicate.duplicate_rank > 1
  returning reminder.id
)
select count(*) as completed_duplicate_reminder_count
from completed_duplicates;

create unique index if not exists reminders_active_opportunity_task_type_unique
  on public.reminders (opportunity_id, task_type)
  where completed = false
    and opportunity_id is not null
    and task_type is not null;
