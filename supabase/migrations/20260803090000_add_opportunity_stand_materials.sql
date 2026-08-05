-- Sprint 25.8 — Stand Malzemeleri Veri Giriş Alanı.
--
-- The participation contract's "Stand Malzemeleri" section and its
-- "Ekstra Malzeme / Açıklamalar" note have been merge-ready for a while
-- (see StandMaterials.*.Selected/.Quantity and ExtraInformation.Line1-3
-- in src/modules/document-engine/merge/participationContractMapping.ts,
-- and DocumentMergeOpportunity in
-- src/modules/document-engine/merge/models.ts), but nothing ever wrote
-- to them — this table had no columns for either, so every generated
-- contract's Stand Malzemeleri section rendered fully blank. This adds
-- the two columns the existing mapping already reads by name.
--
-- stand_materials is a JSON object keyed by the same material keys the
-- mapping already uses (Table, Shelf, HangingRail, Spotlight,
-- PowerSocket, Refrigerator, InfoDesk, Chair, WasteBin, HeaderText,
-- DigitalPrints, Other), each value shaped as
-- { "selected": boolean, "quantity"?: number }.
--
-- extra_information is a JSON array of up to 3 free-text strings,
-- matching ExtraInformation.Line1/Line2/Line3.
--
-- Both nullable, no default, no backfill: an opportunity that predates
-- this migration (or one nobody has edited stand materials on yet)
-- simply has both as null, which the existing mapping already treats
-- as "nothing selected / no note" — identical to today's behavior.
--
-- Run this manually in the Supabase SQL Editor (or via `supabase db
-- push`) — matches every other migration in this folder.

alter table public.opportunities
  add column if not exists stand_materials jsonb,
  add column if not exists extra_information jsonb;
