-- Sprint 25.5 — Opportunity Lifecycle Completion (Won / Lost).
--
-- enforce_active_opportunity_limit (see
-- 20260801100000_enforce_active_opportunity_limit.sql) hardcodes its own
-- terminal_stages array and explicitly asks future changes to keep it in
-- sync with src/types/businessStatus.ts. This sprint adds 'won' as a new
-- terminal BUSINESS_STATUSES entry (distinct from 'signed' — see
-- src/types/businessStatus.ts's own note that Signed and Won are not the
-- same thing); without this migration, a company with several Won
-- opportunities would still have them counted as "active" by this
-- trigger and could be incorrectly blocked from creating a new one.
--
-- Everything else about the function (the advisory lock, the INSERT/
-- UPDATE branch logic, the exception code) is unchanged — only the
-- terminal_stages literal grows by one value. Re-defining the function
-- takes effect immediately for the existing trigger binding; the trigger
-- itself does not need to be dropped/recreated.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push`) — matches every other migration in this folder.

create or replace function public.enforce_active_opportunity_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_active constant integer := 4;
  terminal_stages constant text[] := array['signed', 'lost', 'won'];
  should_check boolean := false;
  active_count integer;
begin
  if new.stage = any (terminal_stages) then
    return new;
  end if;

  if new.company_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    should_check := true;
  elsif tg_op = 'UPDATE' then
    if old.stage = any (terminal_stages) then
      should_check := true;
    elsif new.company_id is distinct from old.company_id then
      should_check := true;
    end if;
  end if;

  if not should_check then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 0));

  select count(*) into active_count
  from public.opportunities
  where company_id = new.company_id
    and not (stage = any (terminal_stages))
    and id <> new.id;

  if active_count >= max_active then
    raise exception 'ACTIVE_OPPORTUNITY_LIMIT_REACHED';
  end if;

  return new;
end;
$$;
