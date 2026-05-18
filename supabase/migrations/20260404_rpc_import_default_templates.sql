create extension if not exists pgcrypto;

create table if not exists occ_empresa_imports (
  empresa_id text not null,
  kind text not null default 'default_templates_v1',
  imported_at timestamptz not null default now(),
  imported_by uuid,
  primary key (empresa_id, kind)
);

create or replace function rpc_import_default_templates(p_empresa_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_uid uuid := auth.uid();
  v_tpl_serv text;
  v_tpl_inv text;
  v_tpl_models text;
  v_tpl_model_items text;
  v_tpl_map text;
  v_cols text;
  v_sel text;
  v_sql text;
  v_has_emp boolean;
  v_has_serv_origem boolean;
  v_serv_count int := 0;
  v_inv_count int := 0;
  v_models_count int := 0;
  v_model_items_count int := 0;
  v_map_count int := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if v_emp = '' then
    raise exception 'empresa_id inválido.';
  end if;

  if not exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = v_uid
      and ue.empresa_id = v_emp
  ) then
    raise exception 'Sem permissão para importar nesta empresa.';
  end if;

  if exists (
    select 1
    from public.occ_empresa_imports i
    where i.empresa_id = v_emp
      and i.kind = 'default_templates_v1'
  ) then
    raise exception 'Os dados padrão já foram importados para esta empresa';
  end if;

  if exists (select 1 from public.servicos where empresa_id = v_emp limit 1)
     or exists (select 1 from public.inventory where empresa_id = v_emp limit 1)
     or exists (select 1 from public.usage_models where empresa_id = v_emp limit 1) then
    raise exception 'Os dados padrão já foram importados para esta empresa';
  end if;

  v_tpl_serv := case
    when to_regclass('public.servicos_template') is not null then 'servicos_template'
    else null
  end;
  v_tpl_inv := case
    when to_regclass('public.inventory_template') is not null then 'inventory_template'
    when to_regclass('public.inventario_template') is not null then 'inventario_template'
    else null
  end;
  v_tpl_models := case
    when to_regclass('public.usage_models_template') is not null then 'usage_models_template'
    when to_regclass('public.modelo_uso_template') is not null then 'modelo_uso_template'
    else null
  end;
  v_tpl_model_items := case
    when to_regclass('public.model_items_template') is not null then 'model_items_template'
    else null
  end;
  v_tpl_map := case
    when to_regclass('public.service_mapping_template') is not null then 'service_mapping_template'
    when to_regclass('public.vinculo_servico_template') is not null then 'vinculo_servico_template'
    else null
  end;

  if v_tpl_serv is null then
    raise exception 'Tabela servicos_template não encontrada.';
  end if;
  if v_tpl_inv is null then
    raise exception 'Tabela inventory_template/inventario_template não encontrada.';
  end if;
  if v_tpl_models is null then
    raise exception 'Tabela usage_models_template/modelo_uso_template não encontrada.';
  end if;
  if v_tpl_model_items is null then
    raise exception 'Tabela model_items_template não encontrada.';
  end if;
  if v_tpl_map is null then
    raise exception 'Tabela service_mapping_template/vinculo_servico_template não encontrada.';
  end if;

  create temporary table tmp_serv_map(old_id text primary key, new_id text not null) on commit drop;
  create temporary table tmp_inv_map(old_id text primary key, new_id text not null) on commit drop;
  create temporary table tmp_model_map(old_id text primary key, new_id text not null) on commit drop;

  execute format('insert into tmp_serv_map(old_id,new_id) select id, gen_random_uuid()::text from public.%I', v_tpl_serv);
  execute format('insert into tmp_inv_map(old_id,new_id) select id, gen_random_uuid()::text from public.%I', v_tpl_inv);
  execute format('insert into tmp_model_map(old_id,new_id) select id, gen_random_uuid()::text from public.%I', v_tpl_models);

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos' and column_name = 'empresa_id'
  ) into v_has_emp;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos' and column_name = 'origem'
  ) into v_has_serv_origem;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_serv
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'servicos'
    and c.column_name not in ('id','empresa_id','origem','created_at','updated_at','especialidadeid','subdivisao_id');

  v_sql := 'insert into public.servicos(id,'
        || (case when v_has_emp then 'empresa_id,' else '' end)
        || (case when v_has_serv_origem then 'origem,' else '' end)
        || coalesce(v_cols,'') || ') '
        || 'select m.new_id,'
        || (case when v_has_emp then '$1,' else '' end)
        || (case when v_has_serv_origem then '''template'',' else '' end)
        || coalesce(v_sel,'') || ' '
        || format('from public.%I t join tmp_serv_map m on m.old_id = t.id', v_tpl_serv);
  execute v_sql using v_emp;
  get diagnostics v_serv_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'empresa_id'
  ) into v_has_emp;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_inv
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'inventory'
    and c.column_name not in ('id','empresa_id','created_at','updated_at');

  v_sql := 'insert into public.inventory(id,' || (case when v_has_emp then 'empresa_id,' else '' end)
        || coalesce(v_cols,'') || ') '
        || 'select m.new_id,' || (case when v_has_emp then '$1,' else '' end)
        || coalesce(v_sel,'') || ' '
        || format('from public.%I t join tmp_inv_map m on m.old_id = t.id', v_tpl_inv);
  execute v_sql using v_emp;
  get diagnostics v_inv_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usage_models' and column_name = 'empresa_id'
  ) into v_has_emp;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_models
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'usage_models'
    and c.column_name not in ('id','empresa_id','created_at','updated_at');

  v_sql := 'insert into public.usage_models(id,' || (case when v_has_emp then 'empresa_id,' else '' end)
        || coalesce(v_cols,'') || ') '
        || 'select m.new_id,' || (case when v_has_emp then '$1,' else '' end)
        || coalesce(v_sel,'') || ' '
        || format('from public.%I t join tmp_model_map m on m.old_id = t.id', v_tpl_models);
  execute v_sql using v_emp;
  get diagnostics v_models_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'model_items' and column_name = 'empresa_id'
  ) into v_has_emp;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_model_items
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'model_items'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','model_id','inventory_id');

  v_sql := 'insert into public.model_items(model_id,inventory_id,' || (case when v_has_emp then 'empresa_id,' else '' end)
        || coalesce(v_cols,'') || ') '
        || 'select mm.new_id, im.new_id,' || (case when v_has_emp then '$1,' else '' end)
        || coalesce(v_sel,'') || ' '
        || format('from public.%I t join tmp_model_map mm on mm.old_id = t.model_id join tmp_inv_map im on im.old_id = t.inventory_id', v_tpl_model_items);
  execute v_sql using v_emp;
  get diagnostics v_model_items_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_mapping' and column_name = 'empresa_id'
  ) into v_has_emp;
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_map
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'service_mapping'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','service_id','model_id');

  v_sql := 'insert into public.service_mapping(service_id,model_id,' || (case when v_has_emp then 'empresa_id,' else '' end)
        || coalesce(v_cols,'') || ') '
        || 'select sm.new_id, mm.new_id,' || (case when v_has_emp then '$1,' else '' end)
        || coalesce(v_sel,'') || ' '
        || format('from public.%I t join tmp_serv_map sm on sm.old_id = t.service_id join tmp_model_map mm on mm.old_id = t.model_id', v_tpl_map);
  execute v_sql using v_emp;
  get diagnostics v_map_count = row_count;

  insert into public.occ_empresa_imports(empresa_id, kind, imported_by)
  values (v_emp, 'default_templates_v1', v_uid);

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'servicos', v_serv_count,
    'inventory', v_inv_count,
    'usage_models', v_models_count,
    'model_items', v_model_items_count,
    'service_mapping', v_map_count
  );
end;
$$;

notify pgrst, 'reload schema';
