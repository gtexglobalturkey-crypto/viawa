-- One canonical Google Drive folder per exhibition. Only the stable folder id
-- is stored; open https://drive.google.com/drive/folders/{id} directly.
-- NULL means "no folder bound" and stays valid for every existing exhibition.
-- Additive and re-runnable: environments where the column was added by hand
-- keep their data, and no existing row is backfilled or modified.
alter table public.exhibitions
  add column if not exists drive_folder_id text;

comment on column public.exhibitions.drive_folder_id is
  'Canonical Google Drive folder id. Google Drive owns the folder and its contents.';

do $$
begin
  -- Skip when any CHECK on this column already exists, whatever its name.
  if not exists (
    select 1
    from pg_constraint constraint_record
    join pg_attribute attribute_record
      on attribute_record.attrelid = constraint_record.conrelid
      and attribute_record.attnum = any (constraint_record.conkey)
    where constraint_record.conrelid = 'public.exhibitions'::regclass
      and constraint_record.contype = 'c'
      and attribute_record.attname = 'drive_folder_id'
  ) then
    alter table public.exhibitions
      add constraint exhibitions_drive_folder_id_format_check
      check (drive_folder_id is null or drive_folder_id ~ '^[A-Za-z0-9_-]+$');
  end if;

  -- Skip when any unique index on this column already exists, whatever its name.
  if not exists (
    select 1
    from pg_index index_record
    join pg_attribute attribute_record
      on attribute_record.attrelid = index_record.indrelid
      and attribute_record.attnum = any (index_record.indkey::smallint[])
    where index_record.indrelid = 'public.exhibitions'::regclass
      and index_record.indisunique
      and attribute_record.attname = 'drive_folder_id'
  ) then
    create unique index exhibitions_drive_folder_id_unique
      on public.exhibitions (drive_folder_id)
      where drive_folder_id is not null;
  end if;
end $$;
