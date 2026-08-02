alter table public.opportunities
  add column if not exists contact_id text null;

alter table public.opportunities
  drop constraint if exists opportunities_contact_id_fkey;

alter table public.opportunities
  add constraint opportunities_contact_id_fkey
  foreign key (contact_id)
  references public.contacts (id)
  on delete set null;

create index if not exists opportunities_contact_id_idx
  on public.opportunities (contact_id)
  where contact_id is not null;
