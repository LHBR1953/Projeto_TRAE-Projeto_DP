create or replace function public.rpc_refresh_apuracao_custo_insumos_from_logs(
  p_orcamento_item_id text,
  p_empresa_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text := trim(coalesce(p_orcamento_item_id, ''));
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_has_fas boolean := false;
  v_has_fas_item boolean := false;
  v_has_fas_custo boolean := false;
  v_has_fas_emp boolean := false;
  v_sql text;
begin
  if v_item = '' then
    return;
  end if;

  select to_regclass('public.financeiro_apuracao_servicos') is not null into v_has_fas;
  if not v_has_fas then
    return;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='financeiro_apuracao_servicos' and column_name='orcamento_item_id'
  ) into v_has_fas_item;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='financeiro_apuracao_servicos' and column_name='valor_custo_insumos'
  ) into v_has_fas_custo;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='financeiro_apuracao_servicos' and column_name='empresa_id'
  ) into v_has_fas_emp;

  if not v_has_fas_item or not v_has_fas_custo then
    return;
  end if;

  v_sql :=
    'update public.financeiro_apuracao_servicos fas ' ||
    'set valor_custo_insumos = src.custo ' ||
    'from ( ' ||
    '  select coalesce(sum(abs(coalesce(l.quantidade,0)) * coalesce(i.preco_custo,0)),0) as custo ' ||
    '  from public.inventory_logs l ' ||
    '  join public.inventory i on i.id::text = l.inventory_id::text ' ||
    '  where l.orcamento_item_id::text = $1 ' ||
    '    and upper(coalesce(l.tipo, '''')) in (''USO'',''SAIDA'') ' ||
    ') src ' ||
    'where fas.orcamento_item_id::text = $1';

  if v_has_fas_emp and v_emp <> '' then
    v_sql := v_sql || ' and fas.empresa_id::text = $2';
    execute v_sql using v_item, v_emp;
  else
    execute v_sql using v_item;
  end if;
end
$$;

create or replace function public.trg_inventory_logs_refresh_apuracao_custo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text := '';
  v_emp text := '';
begin
  if tg_op = 'DELETE' then
    v_item := trim(coalesce(old.orcamento_item_id::text, ''));
    v_emp := trim(coalesce(old.empresa_id::text, ''));
  else
    v_item := trim(coalesce(new.orcamento_item_id::text, ''));
    v_emp := trim(coalesce(new.empresa_id::text, ''));
  end if;

  if v_item <> '' then
    perform public.rpc_refresh_apuracao_custo_insumos_from_logs(v_item, v_emp);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists trg_inventory_logs_refresh_apuracao_custo on public.inventory_logs;
create trigger trg_inventory_logs_refresh_apuracao_custo
after insert or update of quantidade, inventory_id, tipo, orcamento_item_id or delete
on public.inventory_logs
for each row
execute function public.trg_inventory_logs_refresh_apuracao_custo();

notify pgrst, 'reload schema';
