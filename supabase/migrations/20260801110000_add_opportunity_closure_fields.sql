-- Sprint 25.5 — Opportunity Lifecycle Completion (Won / Lost).
--
-- Before this migration, an opportunity's commercial outcome lived
-- entirely in `stage`, and "signed" was the only positive terminal value
-- — there was no way to record a company simply not proceeding (lost),
-- nor any timestamp/reason for either outcome. This adds the three
-- columns "Fırsatı Kapat" writes; the `won` stage value itself needs no
-- migration (opportunities.stage has always been a free-text column —
-- see 20260730040000_add_opportunity_price_fields.sql's own note that
-- this table has no CHECK constraint on stage).
--
-- closure_reason/closure_note are Lost-only in the product flow (see
-- src/types/opportunityClosure.ts's LOST_REASON_OPTIONS) but are left
-- unconstrained here — the fixed reason catalog is enforced in the
-- frontend, the same way `stage`'s own catalog already is.
--
-- All columns nullable, no default, no backfill: an opportunity that has
-- never been explicitly closed via this flow simply has all three as
-- null, regardless of what its `stage` already says (including
-- pre-existing 'signed'/'lost' rows from before this sprint).
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push`) — matches every other migration in this folder.

alter table public.opportunities
  add column if not exists closed_at timestamptz,
  add column if not exists closure_reason text,
  add column if not exists closure_note text;
