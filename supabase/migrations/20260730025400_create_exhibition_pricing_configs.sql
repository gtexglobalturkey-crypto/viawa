-- Sprint 22.1 — VIAWA Fuar Repository Yönetim Modülü (MVP): Fiyat
-- Hesaplayıcı tab persistence.
--
-- One pricing config row per exhibition, keyed to the real Supabase
-- `exhibitions` table (not the separate, localStorage-only "Exhibition"
-- used by the sidebar/pricing-lookup flow in
-- src/modules/exhibitions/storage/exhibitionStorage.ts — those two
-- "exhibition" concepts are not linked yet; this table intentionally
-- anchors to the real, shared one so the repository is an actual common
-- data source, not per-browser state).
--
-- This does NOT touch or replace the pricing data path the live Price
-- Calculator (PriceCalculatorModal) currently reads from
-- (resources/templates/test-data/exhibitions/*/pricing/pricing.json via
-- the Vite dev-server middleware) — that flow is untouched this sprint.
-- This table only backs the new standalone repository management screen
-- (src/modules/exhibition-repository/). See
-- src/modules/exhibition-repository/models/ExhibitionPricingRecord.ts
-- for the mapping to the existing ExhibitionPricingConfig shape the
-- pricing engine already knows how to consume
-- (src/modules/call-workspace/pricing/engine/pricingConfigAdapter.ts) —
-- that's the "prepared to use this data" part; actually swapping the
-- live calculator's data source is a follow-up, not done here.
--
-- Flat columns rather than JSONB — this MVP only ever needs the fixed
-- set of 4 stand types + 4 location surcharges + 2 fees the "Fiyat
-- Hesaplayıcı" tab edits, so a dynamic/JSONB shape would be unused
-- generality for this sprint.
--
-- RLS follows the exact convention established in
-- supabase/migrations/20260728_add_sectors_and_product_groups.sql: RLS
-- enabled, one policy per CRUD verb, `to authenticated` only (anon gets
-- no access), `drop policy if exists` before `create policy` so this
-- file can be re-run safely. Permissive `using (true)`/`with check
-- (true)` for all authenticated users, same as sectors/product_groups —
-- this is shared internal repository data, not per-user data.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI) — the app's anon key
-- cannot execute DDL, so this file is not applied automatically,
-- matching every other migration in this folder.

create table if not exists public.exhibition_pricing_configs (
  exhibition_id uuid primary key
    references public.exhibitions (id) on delete cascade,

  currency text not null default 'EUR',
  vat_rate numeric not null default 0.20, -- fractional: 0.20 = 20%

  space_only_price numeric not null default 0,
  shell_scheme_price numeric not null default 0,
  custom_stand_price numeric not null default 0,
  outdoor_price numeric not null default 0,

  -- Fractional rates, same convention as vat_rate (0.10 = 10%).
  location_normal_rate numeric not null default 0,
  location_corner_rate numeric not null default 0,
  location_two_fronts_rate numeric not null default 0,
  location_island_rate numeric not null default 0,

  registration_fee numeric not null default 0,
  service_fee numeric not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exhibition_pricing_configs
  enable row level security;

drop policy if exists "Authenticated users can read exhibition pricing configs" on public.exhibition_pricing_configs;
drop policy if exists "Authenticated users can insert exhibition pricing configs" on public.exhibition_pricing_configs;
drop policy if exists "Authenticated users can update exhibition pricing configs" on public.exhibition_pricing_configs;
drop policy if exists "Authenticated users can delete exhibition pricing configs" on public.exhibition_pricing_configs;

create policy "Authenticated users can read exhibition pricing configs"
  on public.exhibition_pricing_configs for select
  to authenticated using (true);

create policy "Authenticated users can insert exhibition pricing configs"
  on public.exhibition_pricing_configs for insert
  to authenticated with check (true);

create policy "Authenticated users can update exhibition pricing configs"
  on public.exhibition_pricing_configs for update
  to authenticated using (true) with check (true);

create policy "Authenticated users can delete exhibition pricing configs"
  on public.exhibition_pricing_configs for delete
  to authenticated using (true);
