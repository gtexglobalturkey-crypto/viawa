-- Sprint 25 (BUG-S25-001): a company may have at most 4 active
-- opportunities (every stage except 'signed' and 'lost' is active — keep
-- this in sync with src/types/businessStatus.ts / isTerminalBusinessStatus).
--
-- The frontend (CustomerWorkspace.handleCreateContextOpportunity) and the
-- service layer (opportunityService.createOpportunity) both pre-check this
-- for fast user feedback, but neither guarantees it under concurrency —
-- two simultaneous requests can both read the same "3 active" count and
-- both pass. This trigger is the actual guarantee: it takes a
-- transaction-level advisory lock scoped to the company so concurrent
-- inserts/updates for the same company serialize against each other.
--
-- Existing companies that already exceed 4 active opportunities are left
-- untouched by this migration on purpose (no backfill, no auto-closing):
-- this only blocks a *new* violation from being created, either by
-- inserting another active row, or by reactivating a terminal one, or by
-- moving an active row into a company that is already at the cap. Normal
-- active-to-active stage progress (e.g. contacted -> interested) never
-- triggers the check at all, on any company, regardless of its current
-- count.

create or replace function public.enforce_active_opportunity_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_active constant integer := 4;
  terminal_stages constant text[] := array['signed', 'lost'];
  should_check boolean := false;
  active_count integer;
begin
  -- A row that is itself terminal never counts against, or is blocked by,
  -- the cap (e.g. importing historical signed/lost records).
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
      -- (a) a terminal opportunity is being reactivated.
      should_check := true;
    elsif new.company_id is distinct from old.company_id then
      -- (b) an already-active opportunity is moving to a different company.
      should_check := true;
    end if;
    -- Any other UPDATE (active stage -> a different active stage, or any
    -- other column change, on the same company) is left alone — this is
    -- the normal workflow path and must never be blocked here, no matter
    -- how many active opportunities the company already has.
  end if;

  if not should_check then
    return new;
  end if;

  -- Serializes concurrent inserts/updates for the same company within
  -- this transaction so two simultaneous requests can't both observe the
  -- same pre-violation count and both be allowed through.
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

drop trigger if exists enforce_active_opportunity_limit
  on public.opportunities;
create trigger enforce_active_opportunity_limit
before insert or update on public.opportunities
for each row execute function public.enforce_active_opportunity_limit();
