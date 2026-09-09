-- Atomic price approval: the opportunity's price_* columns and the
-- immutable approved_price_snapshots row it is derived from must be
-- written together or not at all. Before this migration the client made
-- two independent requests (update opportunities, then insert
-- approved_price_snapshots) — a failure of the second request left the
-- opportunity's price fields changed with no snapshot to justify them,
-- and a contract could later be generated against a stale/mismatched
-- snapshot. A single plpgsql function call is one implicit transaction:
-- any unhandled exception (including an RLS with-check violation on the
-- insert) rolls back everything the function did, so the invariant
-- "both writes happen or neither does" is enforced by Postgres itself,
-- not by client-side try/catch ordering.
--
-- security invoker on purpose: this performs exactly the two statements
-- the client used to issue itself, under the caller's own role. The
-- existing opportunities RLS policy (any active application user may
-- update) and approved_price_snapshots RLS policy (active admin only,
-- see 20260824100000_fix_approved_price_admin_authorization.sql) are
-- left untouched and still fully govern who can call this successfully —
-- nothing here loosens or re-implements that authorization.
create or replace function public.approve_opportunity_price(
  p_opportunity_id uuid,
  p_company_id uuid,
  p_exhibition_id uuid,
  p_currency text,
  p_price_stand_type text,
  p_price_stand_area_sqm numeric,
  p_price_location_surcharge_type text,
  p_price_base_amount numeric,
  p_price_location_surcharge_amount numeric,
  p_price_registration_fee numeric,
  p_price_service_fee numeric,
  p_price_subtotal numeric,
  p_price_vat_rate numeric,
  p_price_vat_amount numeric,
  p_price_grand_total numeric,
  p_price_calculated_at timestamptz,
  p_snapshot_approved_at timestamptz,
  p_snapshot_pricing_source text,
  p_snapshot_pricing_source_version text,
  p_snapshot_pricing_config_updated_at timestamptz,
  p_snapshot_matched_repository_folder text,
  p_snapshot_price_input jsonb,
  p_snapshot_price_result jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_updated_opportunity_id uuid;
  v_snapshot_id uuid;
begin
  update public.opportunities
  set
    price_stand_type = p_price_stand_type,
    price_stand_area_sqm = p_price_stand_area_sqm,
    price_location_surcharge_type = p_price_location_surcharge_type,
    price_currency = p_currency,
    price_base_amount = p_price_base_amount,
    price_location_surcharge_amount = p_price_location_surcharge_amount,
    price_registration_fee = p_price_registration_fee,
    price_service_fee = p_price_service_fee,
    price_subtotal = p_price_subtotal,
    price_vat_rate = p_price_vat_rate,
    price_vat_amount = p_price_vat_amount,
    price_grand_total = p_price_grand_total,
    price_calculated_at = p_price_calculated_at,
    -- A payment plan is entered against a specific approved price. The
    -- moment a new price snapshot is approved for this opportunity, any
    -- payment_plan left over from the previous teklif no longer
    -- corresponds to the new figures (see CustomerWorkspace.tsx,
    -- "Kritik Akış Düzeltmesi 1"). Enforcing that here means it can
    -- never be forgotten by a future caller of this function.
    payment_plan = null
  where id = p_opportunity_id
  returning id into v_updated_opportunity_id;

  if v_updated_opportunity_id is null then
    raise exception using errcode = 'P0002',
      message = 'Opportunity price update was not authorized or the opportunity was not found.';
  end if;

  insert into public.approved_price_snapshots (
    company_id,
    opportunity_id,
    exhibition_id,
    approved_at,
    currency,
    pricing_source,
    pricing_source_version,
    pricing_config_updated_at,
    matched_repository_folder,
    price_input,
    price_result
  ) values (
    p_company_id,
    p_opportunity_id,
    p_exhibition_id,
    p_snapshot_approved_at,
    p_currency,
    p_snapshot_pricing_source,
    p_snapshot_pricing_source_version,
    p_snapshot_pricing_config_updated_at,
    p_snapshot_matched_repository_folder,
    p_snapshot_price_input,
    p_snapshot_price_result
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

revoke all on function public.approve_opportunity_price(
  uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, timestamptz, timestamptz,
  text, text, timestamptz, text, jsonb, jsonb
) from public, anon;

grant execute on function public.approve_opportunity_price(
  uuid, uuid, uuid, text, text, numeric, text, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, numeric, timestamptz, timestamptz,
  text, text, timestamptz, text, jsonb, jsonb
) to authenticated, service_role;
