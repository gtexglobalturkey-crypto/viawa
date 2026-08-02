alter table public.exhibition_pricing_configs
  add column if not exists service_fee_type text not null default 'fixed';

alter table public.exhibition_pricing_configs
  drop constraint if exists exhibition_pricing_configs_service_fee_type_check;

alter table public.exhibition_pricing_configs
  add constraint exhibition_pricing_configs_service_fee_type_check
  check (service_fee_type in ('per-sqm', 'fixed'));
