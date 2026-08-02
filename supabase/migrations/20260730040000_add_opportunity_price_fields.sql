-- Sprint 22.4 — Repository Pricing → Opportunity Price Calculator
-- Entegrasyonu: persists the approved price breakdown directly onto the
-- opportunity it belongs to, so it survives beyond the current browser
-- session/localStorage and is available for contract generation.
--
-- Before this migration, `public.opportunities` had no price-related
-- columns at all (only `estimated_value`, a generic pre-existing
-- pipeline/deal-size field, unrelated to a Repository-priced stand
-- breakdown) — confirmed by grepping every file in this migrations
-- folder for "opportunit" (zero hits) and reading src/types/database.ts's
-- Opportunity interface directly. This is the first migration to touch
-- `opportunities` in this repo; its RLS policies are NOT recreated here
-- (adding columns doesn't require it) — only new nullable columns.
--
-- Flat, named columns rather than a JSONB blob — matches the same
-- decision already made in
-- 20260730025400_create_exhibition_pricing_configs.sql (same rationale:
-- a small, fixed set of fields, not a dynamic/variable schema), and
-- keeps every value directly queryable/usable by the contract-generation
-- code path without a JSON-parsing step.
--
-- All columns are nullable with no default — an opportunity with no
-- approved price yet simply has all of these as null, which is exactly
-- what "no price has been calculated/approved for this opportunity"
-- should mean. Nothing is backfilled.
--
-- This does NOT replace the existing localStorage-based
-- ApprovedPriceSnapshot (src/modules/call-workspace/pricing/services/
-- approvedPriceSnapshotStorage.ts) that the contract-generation pipeline
-- (buildContractDocumentData.ts) already reads from — that flow is left
-- completely untouched this sprint. These new columns are an ADDITIONAL,
-- Supabase-persisted copy of the same approved price, written alongside
-- (not instead of) the existing snapshot when a price is approved.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push` if this project is linked to the CLI) — the app's anon key
-- cannot execute DDL, so this file is not applied automatically,
-- matching every other migration in this folder.

alter table public.opportunities
  add column if not exists price_stand_type text,
  add column if not exists price_stand_area_sqm numeric,
  add column if not exists price_location_surcharge_type text,
  add column if not exists price_currency text,
  add column if not exists price_base_amount numeric,
  add column if not exists price_location_surcharge_amount numeric,
  add column if not exists price_registration_fee numeric,
  add column if not exists price_service_fee numeric,
  add column if not exists price_subtotal numeric,
  add column if not exists price_vat_rate numeric,
  add column if not exists price_vat_amount numeric,
  add column if not exists price_grand_total numeric,
  add column if not exists price_calculated_at timestamptz;
