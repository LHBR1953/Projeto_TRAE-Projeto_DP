begin;

create or replace view public.occ_schema_audit_tables as
with tbl as (
  select t.table_name
  from information_schema.tables t
  where t.table_schema = 'public'
    and t.table_type = 'BASE TABLE'
),
empresa_col as (
  select c.table_name,
         bool_or(c.column_name = 'empresa_id') as has_empresa_id,
         bool_or(c.column_name = 'empresa_id' and c.is_nullable = 'NO') as empresa_id_not_null
  from information_schema.columns c
  where c.table_schema = 'public'
  group by c.table_name
),
fk_to_empresas as (
  select
    kcu.table_name,
    bool_or(kcu.column_name = 'empresa_id') as empresa_id_has_fk,
    string_agg(distinct rc.delete_rule, ', ' order by rc.delete_rule) as empresa_fk_delete_rules,
    count(*) as total_fks_to_empresas
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = tc.constraint_name
   and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = tc.constraint_name
   and ccu.table_schema = tc.table_schema
  join information_schema.referential_constraints rc
    on rc.constraint_name = tc.constraint_name
   and rc.constraint_schema = tc.table_schema
  where tc.table_schema = 'public'
    and tc.constraint_type = 'FOREIGN KEY'
    and ccu.table_name = 'empresas'
  group by kcu.table_name
)
select
  t.table_name,
  coalesce(ec.has_empresa_id, false) as has_empresa_id,
  coalesce(ec.empresa_id_not_null, false) as empresa_id_not_null,
  coalesce(fe.empresa_id_has_fk, false) as empresa_id_has_fk_to_empresas,
  coalesce(fe.empresa_fk_delete_rules, '') as empresas_fk_delete_rules,
  coalesce(fe.total_fks_to_empresas, 0) as total_fks_to_empresas,
  case when coalesce(ec.has_empresa_id, false) then 'OK' else 'SEM empresa_id' end as integridade_multiempresa
from tbl t
left join empresa_col ec on ec.table_name = t.table_name
left join fk_to_empresas fe on fe.table_name = t.table_name
order by t.table_name;

create or replace view public.occ_schema_audit_fks as
select
  kcu.table_name,
  kcu.column_name,
  ccu.table_name as ref_table,
  ccu.column_name as ref_column,
  rc.delete_rule as on_delete
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
  on rc.constraint_name = tc.constraint_name
 and rc.constraint_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by kcu.table_name, kcu.column_name;

grant select on public.occ_schema_audit_tables to anon, authenticated;
grant select on public.occ_schema_audit_fks to anon, authenticated;

notify pgrst, 'reload schema';

commit;
