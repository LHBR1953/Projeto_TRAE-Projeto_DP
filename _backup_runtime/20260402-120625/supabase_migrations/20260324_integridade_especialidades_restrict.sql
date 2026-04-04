begin;

do $$
begin
  if to_regclass('public.profissionais') is not null
     and to_regclass('public.especialidades') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'profissionais'
         and column_name = 'especialidadeid'
     ) then
    alter table public.profissionais
      drop constraint if exists profissionais_especialidadeid_fkey;
    alter table public.profissionais
      add constraint profissionais_especialidadeid_fkey
      foreign key (especialidadeid) references public.especialidades(id)
      on delete restrict not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.especialidade_subdivisoes') is not null
     and to_regclass('public.especialidades') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'especialidade_subdivisoes'
         and column_name = 'especialidade_id'
     ) then
    alter table public.especialidade_subdivisoes
      drop constraint if exists especialidade_subdivisoes_especialidade_id_fkey;
    alter table public.especialidade_subdivisoes
      add constraint especialidade_subdivisoes_especialidade_id_fkey
      foreign key (especialidade_id) references public.especialidades(id)
      on delete restrict not valid;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

