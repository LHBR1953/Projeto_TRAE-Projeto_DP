begin;

alter table public.orcamento_itens
  add column if not exists protese_tipo_execucao text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcamento_itens_protese_tipo_execucao_chk'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_protese_tipo_execucao_chk
      check (protese_tipo_execucao is null or protese_tipo_execucao in ('INTERNA','EXTERNA'));
  end if;
end $$;

alter table public.orcamento_itens
  add column if not exists protese_laboratorio_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcamento_itens_protese_laboratorio_fk'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_protese_laboratorio_fk
      foreign key (protese_laboratorio_id)
      references public.laboratorios_proteticos(id)
      on delete restrict;
  end if;
end $$;

create index if not exists orcamento_itens_empresa_protese_laboratorio_idx
on public.orcamento_itens (empresa_id, protese_laboratorio_id);

commit;

