alter table public.emails
  add column if not exists to_recipients text[] not null default '{}'::text[],
  add column if not exists cc_recipients text[] not null default '{}'::text[],
  add column if not exists bcc_recipients text[] not null default '{}'::text[];
