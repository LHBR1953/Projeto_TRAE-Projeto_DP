begin;

do $$
declare
  has_photo boolean;
begin
  if to_regclass('public.profissionais') is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profissionais'
      and column_name = 'photo'
  ) into has_photo;

  if not has_photo then
    alter table public.profissionais add column photo text;
  end if;

  -- Backfill from common legacy column names if they exist
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'foto'
  ) then
    execute 'update public.profissionais set photo = coalesce(photo, foto) where photo is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'foto_base64'
  ) then
    execute 'update public.profissionais set photo = coalesce(photo, foto_base64) where photo is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'photo_base64'
  ) then
    execute 'update public.profissionais set photo = coalesce(photo, photo_base64) where photo is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'imagem'
  ) then
    execute 'update public.profissionais set photo = coalesce(photo, imagem) where photo is null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profissionais' and column_name = 'imagem_base64'
  ) then
    execute 'update public.profissionais set photo = coalesce(photo, imagem_base64) where photo is null';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

