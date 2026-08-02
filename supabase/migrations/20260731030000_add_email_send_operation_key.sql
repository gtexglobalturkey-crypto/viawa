alter table public.emails
  add column if not exists send_operation_key text;

create unique index if not exists emails_send_operation_key_unique
  on public.emails (send_operation_key)
  where send_operation_key is not null;
