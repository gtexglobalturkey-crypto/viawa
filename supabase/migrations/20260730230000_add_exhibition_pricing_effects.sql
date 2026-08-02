alter table public.exhibition_pricing_configs
  add column if not exists premium_shell_price numeric not null default 0,
  add column if not exists location_double_deck_rate numeric not null default 0,
  add column if not exists additional_services_fee numeric not null default 0,
  add column if not exists discount_enabled boolean not null default false,
  add column if not exists discount_max_percent numeric;
