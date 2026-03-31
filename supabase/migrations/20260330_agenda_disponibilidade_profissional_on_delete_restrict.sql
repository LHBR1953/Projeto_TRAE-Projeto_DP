begin;

do $$
begin
  if to_regclass('public.agenda_disponibilidade') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='agenda_disponibilidade' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='agenda_disponibilidade' and column_name='profissional_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.agenda_disponibilidade drop constraint if exists agenda_disponibilidade_profissional_id_fkey;
    alter table public.agenda_disponibilidade
      add constraint agenda_disponibilidade_profissional_id_fkey
      foreign key (empresa_id, profissional_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
