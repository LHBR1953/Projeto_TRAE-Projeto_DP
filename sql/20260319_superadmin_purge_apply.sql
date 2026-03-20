begin;

create or replace function public.rpc_occ_purge_empresa(
  p_empresa_id text,
  p_scope text,
  p_table text default null,
  p_confirm text default null,
  p_dry_run boolean default true,
  p_clear_audit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope text := upper(coalesce(p_scope, 'TABLE'));
  v_table text := lower(coalesce(p_table, ''));
  v_empresa text := coalesce(p_empresa_id, '');
  v_expected text := 'DELETE ' || v_empresa;
  v_steps jsonb := '[]'::jsonb;
  v_rowcount bigint;
  v_count bigint;
  v_rel regclass;
  v_has_empresa boolean;
  r record;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'lhbr@lhbr.com.br' then
    raise exception 'Acesso negado.';
  end if;

  if v_empresa = '' then
    raise exception 'Empresa inválida.';
  end if;

  if not p_dry_run then
    if coalesce(trim(p_confirm), '') <> v_expected then
      raise exception 'Confirmação inválida.';
    end if;
  end if;

  create temporary table if not exists occ_purge_allowed(table_name text primary key) on commit drop;
  insert into occ_purge_allowed(table_name)
  select unnest(array[
    'usuario_empresas',
    'orcamento_itens',
    'orcamento_pagamentos',
    'orcamento_cancelados',
    'financeiro_comissoes',
    'financeiro_transacoes',
    'agenda_agendamentos',
    'agenda_disponibilidade',
    'paciente_documentos',
    'paciente_evolucao',
    'ordens_proteticas_anexos',
    'ordens_proteticas_eventos',
    'ordens_proteticas',
    'laboratorios_proteticos',
    'orcamentos',
    'pacientes',
    'profissionais',
    'especialidade_subdivisoes',
    'especialidades',
    'servicos',
    'occ_audit_log'
  ])
  on conflict do nothing;

  create temporary table if not exists occ_purge_targets(table_name text primary key) on commit drop;
  delete from occ_purge_targets;

  if v_scope = 'AUDIT' then
    insert into occ_purge_targets(table_name) values ('occ_audit_log') on conflict do nothing;
  elsif v_scope = 'ALL' then
    insert into occ_purge_targets(table_name)
    select table_name from occ_purge_allowed where table_name <> 'occ_audit_log'
    on conflict do nothing;
  elsif v_scope = 'BUDGETS' then
    insert into occ_purge_targets(table_name)
    select unnest(array['orcamento_itens','orcamento_pagamentos','orcamento_cancelados','orcamentos'])
    on conflict do nothing;
  elsif v_scope = 'FINANCE' then
    insert into occ_purge_targets(table_name)
    select unnest(array['financeiro_comissoes','financeiro_transacoes'])
    on conflict do nothing;
  elsif v_scope = 'AGENDA' then
    insert into occ_purge_targets(table_name)
    select unnest(array['agenda_agendamentos','agenda_disponibilidade'])
    on conflict do nothing;
  elsif v_scope = 'PROTESE' then
    insert into occ_purge_targets(table_name)
    select unnest(array['ordens_proteticas_anexos','ordens_proteticas_eventos','ordens_proteticas','laboratorios_proteticos'])
    on conflict do nothing;
  elsif v_scope = 'PATIENTS' then
    insert into occ_purge_targets(table_name)
    select unnest(array['paciente_documentos','paciente_evolucao','pacientes'])
    on conflict do nothing;
  elsif v_scope = 'CATALOG' then
    insert into occ_purge_targets(table_name)
    select unnest(array['especialidade_subdivisoes','especialidades','servicos'])
    on conflict do nothing;
  elsif v_scope = 'TABLE' then
    if v_table = '' then
      raise exception 'Tabela inválida.';
    end if;
    if not exists(select 1 from occ_purge_allowed where table_name = v_table) then
      raise exception 'Tabela não permitida.';
    end if;

    with recursive chain as (
      select c.oid as relid, c.relname as table_name, 0 as depth
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname = v_table
      union all
      select child.oid as relid, child.relname as table_name, chain.depth + 1 as depth
      from chain
      join pg_constraint fk on fk.contype = 'f' and fk.confrelid = chain.relid
      join pg_class child on child.oid = fk.conrelid
      join pg_namespace n on n.oid = child.relnamespace and n.nspname = 'public'
      where exists(select 1 from occ_purge_allowed a where a.table_name = child.relname)
    ),
    ranked as (
      select table_name, max(depth) as depth
      from chain
      group by table_name
    )
    insert into occ_purge_targets(table_name)
    select table_name from ranked
    on conflict do nothing;
  else
    raise exception 'Scope inválido.';
  end if;

  if p_clear_audit then
    insert into occ_purge_targets(table_name) values ('occ_audit_log') on conflict do nothing;
  end if;

  create temporary table if not exists occ_purge_ordered(table_name text primary key, depth int not null) on commit drop;
  delete from occ_purge_ordered;

  with allowed_rels as (
    select c.oid as relid, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and exists(select 1 from occ_purge_targets t where t.table_name = c.relname)
  ),
  edges as (
    select child.relname as child_table, parent.relname as parent_table
    from pg_constraint fk
    join pg_class child on child.oid = fk.conrelid
    join pg_namespace nc on nc.oid = child.relnamespace and nc.nspname = 'public'
    join pg_class parent on parent.oid = fk.confrelid
    join pg_namespace np on np.oid = parent.relnamespace and np.nspname = 'public'
    where fk.contype = 'f'
      and exists(select 1 from occ_purge_targets t where t.table_name = child.relname)
      and exists(select 1 from occ_purge_targets t where t.table_name = parent.relname)
  ),
  walk as (
    select ar.table_name, 0 as depth
    from allowed_rels ar
    union all
    select w.table_name, w.depth + 1
    from walk w
    join edges e on e.parent_table = w.table_name
  ),
  ranked as (
    select table_name, max(depth) as depth
    from walk
    group by table_name
  )
  insert into occ_purge_ordered(table_name, depth)
  select r.table_name, r.depth
  from ranked r
  on conflict (table_name) do update set depth = excluded.depth;

  for r in
    select table_name
    from occ_purge_ordered
    order by depth desc, table_name asc
  loop
    v_rel := to_regclass('public.' || r.table_name);
    if v_rel is null then
      continue;
    end if;

    select exists(
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = r.table_name
        and c.column_name = 'empresa_id'
    ) into v_has_empresa;

    if r.table_name = 'occ_audit_log' and not p_clear_audit and v_scope <> 'AUDIT' then
      continue;
    end if;

    if not v_has_empresa and r.table_name <> 'occ_audit_log' then
      continue;
    end if;

    if p_dry_run then
      if r.table_name = 'occ_audit_log' then
        execute 'select count(*) from public.occ_audit_log where empresa_id = $1' into v_count using v_empresa;
      else
        execute format('select count(*) from public.%I where empresa_id = $1', r.table_name) into v_count using v_empresa;
      end if;
      v_steps := v_steps || jsonb_build_array(jsonb_build_object('table', r.table_name, 'count', coalesce(v_count, 0), 'action', 'count'));
    else
      if r.table_name = 'occ_audit_log' then
        execute 'delete from public.occ_audit_log where empresa_id = $1' using v_empresa;
      else
        execute format('delete from public.%I where empresa_id = $1', r.table_name) using v_empresa;
      end if;
      get diagnostics v_rowcount = row_count;
      v_steps := v_steps || jsonb_build_array(jsonb_build_object('table', r.table_name, 'deleted', coalesce(v_rowcount, 0), 'action', 'delete'));
    end if;
  end loop;

  return jsonb_build_object(
    'empresa_id', v_empresa,
    'scope', v_scope,
    'dry_run', p_dry_run,
    'clear_audit', p_clear_audit,
    'steps', v_steps
  );
end;
$$;

grant execute on function public.rpc_occ_purge_empresa(text, text, text, text, boolean, boolean) to authenticated;

commit;
