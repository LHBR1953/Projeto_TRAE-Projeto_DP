begin;

alter table public.usuario_empresas
  drop constraint if exists usuario_empresas_perfil_check;

alter table public.usuario_empresas
  drop constraint if exists usuario_empresas_perfil_check1;

do $$
begin
  if to_regclass('public.usuario_empresas') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuario_empresas'
      and column_name = 'perfil'
  ) then
    alter table public.usuario_empresas
      add constraint usuario_empresas_perfil_check
      check (lower(perfil) in ('admin','supervisor','dentista','protetico','recepcao'));
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

