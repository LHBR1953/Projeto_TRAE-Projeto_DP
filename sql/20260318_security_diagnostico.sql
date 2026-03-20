begin;

create temporary table if not exists occ_diag_issues (
  issue text not null,
  object_name text not null,
  details text not null
) on commit drop;

do $$
declare
  t text;
  cnt bigint;
  has_empresa boolean;
begin
  foreach t in array array[
    'pacientes','profissionais','especialidades','especialidade_subdivisoes','servicos',
    'orcamentos','orcamento_itens','orcamento_pagamentos',
    'agenda_disponibilidade','agenda_agendamentos',
    'financeiro_transacoes','financeiro_comissoes',
    'orcamento_cancelados','usuario_empresas',
    'paciente_evolucao','paciente_documentos',
    'laboratorios_proteticos','ordens_proteticas','ordens_proteticas_eventos','ordens_proteticas_anexos'
  ] loop
    if to_regclass('public.' || t) is null then
      insert into occ_diag_issues(issue, object_name, details)
      values ('TABELA_AUSENTE', t, 'Tabela esperada não existe no schema public.');
      continue;
    end if;

    select exists(
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'empresa_id'
    ) into has_empresa;

    if not has_empresa then
      insert into occ_diag_issues(issue, object_name, details)
      values ('SEM_EMPRESA_ID', t, 'Tabela existe mas não possui coluna empresa_id.');
      continue;
    end if;
  end loop;

  foreach t in array array['pacientes','orcamentos','orcamento_itens','financeiro_transacoes'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    select exists(
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'empresa_id'
    ) into has_empresa;

    if not has_empresa then
      continue;
    end if;

    execute format('select count(*) from public.%I where empresa_id is null', t) into cnt;
    if coalesce(cnt, 0) > 0 then
      insert into occ_diag_issues(issue, object_name, details)
      values ('EMPRESA_ID_NULL', t, 'Existem registros com empresa_id NULL: ' || cnt::text);
    end if;
  end loop;
end $$;

select
  case when exists(select 1 from occ_diag_issues) then 'NÃO' else 'OK' end as status,
  (select count(*) from occ_diag_issues) as issues_total,
  (select count(*) from occ_diag_issues where issue = 'TABELA_AUSENTE') as tabelas_ausentes,
  (select count(*) from occ_diag_issues where issue = 'SEM_EMPRESA_ID') as tabelas_sem_empresa_id,
  (select count(*) from occ_diag_issues where issue = 'EMPRESA_ID_NULL') as tabelas_com_empresa_id_null;

select issue, object_name, details
from occ_diag_issues
order by issue, object_name
limit 50;

commit;
