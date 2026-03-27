begin;

alter table public.servicos
  add column if not exists subdivisao_id text;

update public.servicos s
set subdivisao_id = sub.id
from public.especialidade_subdivisoes sub
where s.empresa_id = sub.empresa_id
  and (
    upper(btrim(regexp_replace(coalesce(s.subdivisao, ''), '^[0-9]+\\.[0-9]+\\s*-\\s*', '', 'g'))) = upper(btrim(sub.nome))
    or upper(btrim(coalesce(s.subdivisao, ''))) = upper(btrim(sub.nome))
  )
  and (s.subdivisao_id is null or btrim(s.subdivisao_id) = '');

alter table public.servicos
  drop constraint if exists servicos_subdivisao_id_fkey;

alter table public.servicos
  add constraint servicos_subdivisao_id_fkey
  foreign key (subdivisao_id)
  references public.especialidade_subdivisoes(id)
  on delete restrict
  not valid;

alter table public.ordens_proteticas
  drop constraint if exists ordens_proteticas_protetico_id_fkey;

alter table public.ordens_proteticas
  add constraint ordens_proteticas_protetico_id_fkey
  foreign key (protetico_id)
  references public.profissionais(id)
  on delete restrict
  not valid;

alter table public.orcamento_itens
  drop constraint if exists orcamento_itens_servico_id_fkey;

alter table public.orcamento_itens
  add constraint orcamento_itens_servico_id_fkey
  foreign key (servico_id)
  references public.servicos(id)
  on delete restrict
  not valid;

do $$
begin
  if to_regclass('public.ordens_proteticas') is not null and to_regclass('public.pacientes') is not null then
    alter table public.ordens_proteticas drop constraint if exists ordens_proteticas_paciente_id_fkey;
    alter table public.ordens_proteticas
      add constraint ordens_proteticas_paciente_id_fkey
      foreign key (paciente_id) references public.pacientes(id) on delete restrict not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.orcamentos') is not null and to_regclass('public.pacientes') is not null then
    alter table public.orcamentos drop constraint if exists orcamentos_pacienteid_fkey;
    alter table public.orcamentos
      add constraint orcamentos_pacienteid_fkey
      foreign key (pacienteid) references public.pacientes(id) on delete restrict not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.pacientes') is not null then
    if not exists (select 1 from pg_constraint where conname = 'pacientes_empresa_seqid_unique') then
      if exists (
        select 1
        from public.pacientes
        group by empresa_id, seqid
        having count(*) > 1
      ) then
        raise exception 'Existem duplicidades de (empresa_id, seqid) em public.pacientes. Corrija antes de aplicar as FKs por (empresa_id, paciente_id).';
      end if;
      alter table public.pacientes
        add constraint pacientes_empresa_seqid_unique unique (empresa_id, seqid);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.agenda_agendamentos') is not null and to_regclass('public.pacientes') is not null then
    alter table public.agenda_agendamentos drop constraint if exists agenda_agendamentos_paciente_id_fkey;
    alter table public.agenda_agendamentos
      add constraint agenda_agendamentos_paciente_id_fkey
      foreign key (empresa_id, paciente_id) references public.pacientes(empresa_id, seqid) on delete restrict not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.financeiro_transacoes') is not null and to_regclass('public.pacientes') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='financeiro_transacoes' and column_name='empresa_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='financeiro_transacoes' and column_name='paciente_id'
    ) then
      alter table public.financeiro_transacoes drop constraint if exists financeiro_transacoes_paciente_id_fkey;
      alter table public.financeiro_transacoes
        add constraint financeiro_transacoes_paciente_id_fkey
        foreign key (empresa_id, paciente_id) references public.pacientes(empresa_id, seqid) on delete restrict not valid;
    end if;
    if exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='financeiro_transacoes' and column_name='empresa_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='financeiro_transacoes' and column_name='paciente_destino_id'
    ) then
      alter table public.financeiro_transacoes drop constraint if exists financeiro_transacoes_paciente_destino_id_fkey;
      alter table public.financeiro_transacoes
        add constraint financeiro_transacoes_paciente_destino_id_fkey
        foreign key (empresa_id, paciente_destino_id) references public.pacientes(empresa_id, seqid) on delete restrict not valid;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.paciente_evolucao') is not null and to_regclass('public.pacientes') is not null then
    alter table public.paciente_evolucao drop constraint if exists paciente_evolucao_paciente_id_fkey;
    alter table public.paciente_evolucao
      add constraint paciente_evolucao_paciente_id_fkey
      foreign key (paciente_id) references public.pacientes(id) on delete restrict not valid;
  end if;
end $$;

do $$
begin
  if to_regclass('public.paciente_documentos') is not null and to_regclass('public.pacientes') is not null then
    alter table public.paciente_documentos drop constraint if exists paciente_documentos_paciente_id_fkey;
    alter table public.paciente_documentos
      add constraint paciente_documentos_paciente_id_fkey
      foreign key (paciente_id) references public.pacientes(id) on delete restrict not valid;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
