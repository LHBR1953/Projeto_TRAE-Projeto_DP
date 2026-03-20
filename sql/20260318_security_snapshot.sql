begin;

create temporary table if not exists occ_snapshot_flags (
  table_name text primary key,
  exists_in_db boolean not null,
  rls_enabled boolean,
  rls_forced boolean
) on commit drop;

insert into occ_snapshot_flags(table_name, exists_in_db, rls_enabled, rls_forced)
select
  e.table_name,
  (c.oid is not null) as exists_in_db,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from (
  select distinct unnest(array[
    'pacientes','profissionais','especialidades','especialidade_subdivisoes','servicos',
    'orcamentos','orcamento_itens','orcamento_pagamentos',
    'agenda_disponibilidade','agenda_agendamentos',
    'financeiro_transacoes','financeiro_comissoes',
    'orcamento_cancelados','usuario_empresas',
    'paciente_evolucao','paciente_documentos',
    'laboratorios_proteticos','ordens_proteticas','ordens_proteticas_eventos','ordens_proteticas_anexos'
  ]) as table_name
) e
left join (
  select c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
) c on c.relname = e.table_name;

select
  case when sum(case when exists_in_db and rls_enabled then 1 else 0 end) = sum(case when exists_in_db then 1 else 0 end)
    then 'OK' else 'NÃO' end as status_rls,
  sum(case when exists_in_db then 1 else 0 end) as tabelas_existentes,
  sum(case when exists_in_db and rls_enabled then 1 else 0 end) as tabelas_rls_on,
  sum(case when exists_in_db and not rls_enabled then 1 else 0 end) as tabelas_rls_off,
  sum(case when not exists_in_db then 1 else 0 end) as tabelas_ausentes
from occ_snapshot_flags;

select
  table_name,
  exists_in_db,
  rls_enabled,
  rls_forced
from occ_snapshot_flags
where not exists_in_db or rls_enabled is distinct from true
order by table_name;

select
  p.tablename,
  count(*) as policies_occ_v1
from pg_policies p
where p.schemaname = 'public'
  and p.policyname like 'occ\_v1\_%' escape '\'
group by p.tablename
order by p.tablename;

select
  c.relname as table_name,
  count(*) as audit_triggers
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and t.tgname = 'occ_audit_trg'
group by c.relname
order by c.relname;

commit;
