alter table if exists public.inventory_logs
  add column if not exists orcamento_item_id text;

create index if not exists inventory_logs_empresa_atendimento_orc_item_idx
  on public.inventory_logs (empresa_id, atendimento_id, orcamento_item_id);

create or replace function public.rpc_backfill_inventory_logs_orcamento_item(
  p_empresa_id text,
  p_atendimento_id text,
  p_orcamento_item_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_atd text := trim(coalesce(p_atendimento_id, ''));
  v_item text := trim(coalesce(p_orcamento_item_id, ''));
  v_updated int := 0;
begin
  if v_emp = '' or v_atd = '' or v_item = '' then
    raise exception 'Parâmetros inválidos: empresa_id, atendimento_id e orcamento_item_id são obrigatórios.';
  end if;

  if not exists (
    select 1
    from public.orcamento_itens oi
    where oi.id::text = v_item
      and oi.empresa_id::text = v_emp
  ) then
    raise exception 'orcamento_item_id não encontrado para a empresa informada.';
  end if;

  update public.inventory_logs l
  set orcamento_item_id = v_item
  where l.empresa_id::text = v_emp
    and l.atendimento_id::text = v_atd
    and upper(coalesce(l.tipo, '')) in ('USO', 'SAIDA')
    and coalesce(btrim(l.orcamento_item_id), '') = '';
  get diagnostics v_updated = row_count;

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'atendimento_id', v_atd,
    'orcamento_item_id', v_item,
    'updated_logs', v_updated
  );
end
$$;

create or replace function public.rpc_backfill_inventory_logs_orcamento_item_auto(
  p_empresa_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_updated_by_atd int := 0;
  v_updated_by_item int := 0;
  v_orc_paciente_col text;
  v_ag_paciente_col text;
  v_sql text;
begin
  if v_emp = '' then
    raise exception 'Parâmetro inválido: empresa_id é obrigatório.';
  end if;

  update public.inventory_logs l
  set orcamento_item_id = oi.id::text
  from public.orcamento_itens oi
  where l.empresa_id::text = v_emp
    and oi.empresa_id::text = v_emp
    and coalesce(btrim(l.orcamento_item_id), '') = ''
    and upper(coalesce(l.tipo, '')) in ('USO', 'SAIDA')
    and l.atendimento_id::text = oi.id::text;
  get diagnostics v_updated_by_item = row_count;

  select case
           when exists (
             select 1 from information_schema.columns
             where table_schema='public' and table_name='orcamentos' and column_name='paciente_id'
           ) then 'paciente_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema='public' and table_name='orcamentos' and column_name='pacienteid'
           ) then 'pacienteid'
           else null
         end
  into v_orc_paciente_col;

  select case
           when exists (
             select 1 from information_schema.columns
             where table_schema='public' and table_name='agenda_agendamentos' and column_name='paciente_id'
           ) then 'paciente_id'
           when exists (
             select 1 from information_schema.columns
             where table_schema='public' and table_name='agenda_agendamentos' and column_name='pacienteid'
           ) then 'pacienteid'
           else null
         end
  into v_ag_paciente_col;

  if v_orc_paciente_col is not null and v_ag_paciente_col is not null then
    v_sql := format(
      'update public.inventory_logs l ' ||
      'set orcamento_item_id = x.item_id ' ||
      'from ( ' ||
      '  select ag.id::text as atendimento_id, max(oi.id::text) as item_id ' ||
      '  from public.agenda_agendamentos ag ' ||
      '  join public.orcamentos o ' ||
      '    on o.empresa_id::text = $1 ' ||
      '   and o.%I::text = ag.%I::text ' ||
      '  join public.orcamento_itens oi ' ||
      '    on oi.empresa_id::text = $1 ' ||
      '   and oi.orcamento_id::text = o.id::text ' ||
      '   and upper(coalesce(oi.status, '''')) in (''FINALIZADO'', ''EM EXECUCAO'', ''EM_EXECUCAO'') ' ||
      '  where ag.empresa_id::text = $1 ' ||
      '  group by ag.id::text ' ||
      '  having count(distinct oi.id::text) = 1 ' ||
      ') x ' ||
      'where l.empresa_id::text = $1 ' ||
      '  and coalesce(btrim(l.orcamento_item_id), '''') = '''' ' ||
      '  and upper(coalesce(l.tipo, '''')) in (''USO'', ''SAIDA'') ' ||
      '  and l.atendimento_id::text = x.atendimento_id',
      v_orc_paciente_col, v_ag_paciente_col
    );
    execute v_sql using v_emp;
    get diagnostics v_updated_by_atd = row_count;
  end if;

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'updated_by_itemid_match', v_updated_by_item,
    'updated_by_single_item_attendance', v_updated_by_atd,
    'updated_total', v_updated_by_item + v_updated_by_atd
  );
end
$$;

notify pgrst, 'reload schema';
