-- Reconcile the active-opportunity limit directly to the final intended rule.
-- A company may have at most four non-terminal opportunities. The advisory
-- lock serializes concurrent checks for the same company.

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

drop trigger if exists enforce_active_opportunity_limit
  on public.opportunities;
create trigger enforce_active_opportunity_limit
before insert or update on public.opportunities
for each row execute function public.enforce_active_opportunity_limit();
