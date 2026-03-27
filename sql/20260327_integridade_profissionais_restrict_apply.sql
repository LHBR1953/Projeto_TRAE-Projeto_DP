begin;

do $$
begin
  if to_regclass('public.profissionais') is null then
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profissionais' and column_name='empresa_id'
  )
  and not exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique') then
    if exists (
      select 1
      from public.profissionais
      group by empresa_id, seqid
      having count(*) > 1
    ) then
      raise exception 'Existem duplicidades de (empresa_id, seqid) em public.profissionais. Corrija antes de aplicar as FKs por (empresa_id, profissional_id).';
    end if;
    alter table public.profissionais
      add constraint profissionais_empresa_seqid_unique unique (empresa_id, seqid);
  end if;
end $$;

do $$
begin
  if to_regclass('public.agenda_agendamentos') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='agenda_agendamentos' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='agenda_agendamentos' and column_name='profissional_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.agenda_agendamentos drop constraint if exists agenda_agendamentos_profissional_id_fkey;
    alter table public.agenda_agendamentos
      add constraint agenda_agendamentos_profissional_id_fkey
      foreign key (empresa_id, profissional_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;
end $$;

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

do $$
begin
  if to_regclass('public.orcamentos') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamentos' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamentos' and column_name='profissional_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.orcamentos drop constraint if exists orcamentos_profissional_id_fkey;
    alter table public.orcamentos
      add constraint orcamentos_profissional_id_fkey
      foreign key (empresa_id, profissional_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.orcamento_itens') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_itens' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_itens' and column_name='profissional_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.orcamento_itens drop constraint if exists orcamento_itens_profissional_id_fkey;
    alter table public.orcamento_itens
      add constraint orcamento_itens_profissional_id_fkey
      foreign key (empresa_id, profissional_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;

  if to_regclass('public.orcamento_itens') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_itens' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orcamento_itens' and column_name='protetico_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.orcamento_itens drop constraint if exists orcamento_itens_protetico_id_fkey;
    alter table public.orcamento_itens
      add constraint orcamento_itens_protetico_id_fkey
      foreign key (empresa_id, protetico_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.financeiro_comissoes') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='financeiro_comissoes' and column_name='empresa_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='financeiro_comissoes' and column_name='profissional_id')
     and exists (select 1 from pg_constraint where conname = 'profissionais_empresa_seqid_unique')
  then
    alter table public.financeiro_comissoes drop constraint if exists financeiro_comissoes_profissional_id_fkey;
    alter table public.financeiro_comissoes
      add constraint financeiro_comissoes_profissional_id_fkey
      foreign key (empresa_id, profissional_id)
      references public.profissionais(empresa_id, seqid)
      on delete restrict
      not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.paciente_evolucao') is not null
     and to_regclass('public.profissionais') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='paciente_evolucao' and column_name='profissional_id')
  then
    alter table public.paciente_evolucao drop constraint if exists paciente_evolucao_profissional_id_fkey;
    alter table public.paciente_evolucao
      add constraint paciente_evolucao_profissional_id_fkey
      foreign key (profissional_id)
      references public.profissionais(id)
      on delete restrict
      not valid;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
