begin;

create temporary table if not exists occ_tenant_audit (
  issue text not null,
  object_name text not null,
  details text not null
) on commit drop;

do $$
declare
  t text;
  has_empresa boolean;
  null_cnt bigint;
begin
  foreach t in array array[
    'pacientes','profissionais','especialidades','especialidade_subdivisoes','servicos',
    'orcamentos','orcamento_itens','orcamento_pagamentos',
    'agenda_disponibilidade','agenda_agendamentos',
    'financeiro_transacoes','financeiro_comissoes',
    'orcamento_cancelados','usuario_empresas',
    'paciente_evolucao','paciente_documentos'
  ] loop
    if to_regclass('public.' || t) is null then
      insert into occ_tenant_audit(issue, object_name, details)
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
      insert into occ_tenant_audit(issue, object_name, details)
      values ('SEM_EMPRESA_ID', t, 'Tabela existe mas não possui coluna empresa_id.');
      continue;
    end if;

    execute format('select count(*) from public.%I where empresa_id is null', t) into null_cnt;
    if null_cnt > 0 then
      insert into occ_tenant_audit(issue, object_name, details)
      values ('EMPRESA_ID_NULO', t, 'Linhas com empresa_id NULL: ' || null_cnt);
    end if;
  end loop;
end $$;

-- FK audit: fks que não incluem empresa_id no relacionamento (potencial vazamento multi-tenant)
insert into occ_tenant_audit(issue, object_name, details)
select
  'FK_SEM_EMPRESA_ID' as issue,
  tc.constraint_name as object_name,
  'origem=' || tc.table_name || '(' || string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) || ')' ||
  ' -> destino=' || ccu.table_name || '(' || string_agg(ccu.column_name, ', ' order by kcu.ordinal_position) || ')' as details
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
group by tc.constraint_name, tc.table_name, ccu.table_name
having
  sum(case when kcu.column_name = 'empresa_id' then 1 else 0 end) = 0
  or sum(case when ccu.column_name = 'empresa_id' then 1 else 0 end) = 0;

-- seqid audit: colisões por empresa (quando existir coluna seqid)
do $$
declare
  t text;
  has_seq boolean;
  dup_cnt bigint;
begin
  foreach t in array array['pacientes','profissionais','especialidades','servicos','orcamentos'] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    select exists(
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'seqid'
    ) into has_seq;
    if not has_seq then
      continue;
    end if;
    execute format(
      'select count(*) from (select empresa_id, seqid from public.%I where empresa_id is not null and seqid is not null group by empresa_id, seqid having count(*)>1) d',
      t
    ) into dup_cnt;
    if dup_cnt > 0 then
      insert into occ_tenant_audit(issue, object_name, details)
      values ('SEQID_DUPLICADO_POR_EMPRESA', t, 'Chaves repetidas (empresa_id, seqid): ' || dup_cnt);
    end if;
  end loop;
end $$;

select *
from occ_tenant_audit
order by issue, object_name;

commit;

