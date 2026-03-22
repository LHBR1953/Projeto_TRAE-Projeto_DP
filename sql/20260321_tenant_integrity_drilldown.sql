begin;

create temporary table if not exists occ_fk_audit (
  constraint_name text not null,
  src_table text not null,
  src_cols text not null,
  dst_table text not null,
  dst_cols text not null,
  src_has_empresa boolean not null,
  dst_has_empresa boolean not null,
  includes_empresa_in_fk boolean not null
) on commit drop;

insert into occ_fk_audit(constraint_name, src_table, src_cols, dst_table, dst_cols, src_has_empresa, dst_has_empresa, includes_empresa_in_fk)
select
  tc.constraint_name,
  tc.table_name as src_table,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as src_cols,
  ccu.table_name as dst_table,
  string_agg(ccu.column_name, ', ' order by kcu.ordinal_position) as dst_cols,
  exists(
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=tc.table_name and c.column_name='empresa_id'
  ) as src_has_empresa,
  exists(
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=ccu.table_name and c.column_name='empresa_id'
  ) as dst_has_empresa,
  (sum(case when kcu.column_name = 'empresa_id' then 1 else 0 end) > 0) as includes_empresa_in_fk
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type='FOREIGN KEY'
  and tc.table_schema='public'
group by tc.constraint_name, tc.table_name, ccu.table_name;

-- 1) Lista completa de FKs e se estão "amarradas" ao empresa_id
select *
from occ_fk_audit
order by includes_empresa_in_fk asc, src_table, constraint_name;

-- 2) FKs que são multi-tenant "perigosas": ambas as tabelas têm empresa_id, mas a FK não inclui empresa_id
select *
from occ_fk_audit
where src_has_empresa
  and dst_has_empresa
  and not includes_empresa_in_fk
order by src_table, constraint_name;

-- 3) Duplicidade de (empresa_id, seqid) (detalha a tabela que acusou no seu audit)
create temporary table if not exists occ_seqid_dupes (
  table_name text not null,
  empresa_id text,
  seqid bigint,
  qtd bigint,
  sample_ids text
) on commit drop;

do $$
declare
  t text;
  has_seq boolean;
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
    execute format($q$
      insert into occ_seqid_dupes(table_name, empresa_id, seqid, qtd, sample_ids)
      select %L as table_name,
             d.empresa_id,
             d.seqid,
             d.qtd,
             d.sample_ids
      from (
        select empresa_id,
               seqid,
               count(*) as qtd,
               string_agg(id::text, ', ' order by id::text) filter (where rn <= 5) as sample_ids
        from (
          select id, empresa_id, seqid,
                 row_number() over (partition by empresa_id, seqid order by id::text) as rn
          from public.%I
          where empresa_id is not null and seqid is not null
        ) x
        group by empresa_id, seqid
        having count(*) > 1
      ) d
    $q$, t, t);
  end loop;
end $$;

select *
from occ_seqid_dupes
order by table_name, empresa_id, seqid;

commit;

