-- Adds the second contact role (İmza Yetkilisi / signatory) alongside the
-- existing is_primary (Fuar Yetkilisi / Ana İletişim Kişisi) flag. A contact
-- can hold both roles at once, or neither — no row is auto-assigned a role.
--
-- Only adds a column on the existing public.contacts table — no new table,
-- no data touched.

alter table public.contacts
  add column if not exists is_signatory boolean not null default false;
