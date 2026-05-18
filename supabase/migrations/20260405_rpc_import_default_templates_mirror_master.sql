create extension if not exists pgcrypto;

create or replace function rpc_import_default_templates(p_empresa_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_src text := 'emp_a279673a1b';
  v_uid uuid := auth.uid();
  v_service_tbl text;
  v_inv_src text;
  v_cols text;
  v_sel text;
  v_sql text;
  v_has_emp boolean;
  v_has_origem boolean;
  v_id_is_uuid boolean;
  v_emp_is_uuid boolean;
  v_serv_count int := 0;
  v_inv_count int := 0;
  v_models_count int := 0;
  v_model_items_count int := 0;
  v_map_count int := 0;
  v_inv_has_atual boolean;
  v_inv_has_min boolean;
  v_inv_has_saldo boolean;
  v_model_items_has_emp boolean;
  v_service_map_has_emp boolean;
  v_service_id_is_uuid boolean;
  v_model_id_is_uuid boolean;
  v_inventory_id_is_uuid boolean;
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

  if exists (select 1 from public.servicos where empresa_id::text = v_emp limit 1)
     or exists (select 1 from public.inventory where empresa_id::text = v_emp limit 1)
     or exists (select 1 from public.usage_models where empresa_id::text = v_emp limit 1) then
    raise exception 'Os dados padrão já foram importados para esta empresa';
  end if;

  v_service_tbl := case
    when to_regclass('public.servicos') is not null then 'servicos'
    when to_regclass('public.services') is not null then 'services'
    else null
  end;
  if v_service_tbl is null then
    raise exception 'Tabela de serviços não encontrada (servicos/services).';
  end if;

  if not exists (select 1 from public.empresas where id::text = v_src) then
    raise exception 'Fonte mestre % não encontrada em empresas.', v_src;
  end if;

  create temporary table tmp_serv_map(old_id text primary key, new_id uuid not null) on commit drop;
  create temporary table tmp_inv_map(old_id text primary key, new_id uuid not null) on commit drop;
  create temporary table tmp_model_map(old_id text primary key, new_id uuid not null) on commit drop;

  execute format('insert into tmp_serv_map(old_id,new_id) select id::text, gen_random_uuid() from public.%I where empresa_id::text = %L', v_service_tbl, v_src);
  v_inv_src := case
    when to_regclass('public.inventory_template') is not null then 'inventory_template'
    else 'inventory'
  end;
  if v_inv_src = 'inventory_template' then
    execute 'insert into tmp_inv_map(old_id,new_id) select id::text, gen_random_uuid() from public.inventory_template';
  else
    execute format('insert into tmp_inv_map(old_id,new_id) select id::text, gen_random_uuid() from public.inventory where empresa_id::text = %L', v_src);
  end if;
  execute format('insert into tmp_model_map(old_id,new_id) select id::text, gen_random_uuid() from public.usage_models where empresa_id::text = %L', v_src);

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_service_tbl and column_name = 'empresa_id'
  ) into v_has_emp;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_service_tbl and column_name = 'origem'
  ) into v_has_origem;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_service_tbl and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_service_tbl and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_service_tbl
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = v_service_tbl
    and c.column_name not in ('id','empresa_id','origem','created_at','updated_at','especialidadeid','subdivisao_id');

  v_sql := format('insert into public.%I(id', v_service_tbl)
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when v_has_origem then ', origem' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when v_has_origem then ', ''template''' else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || format(' from public.%I t join tmp_serv_map m on m.old_id = t.id::text where t.empresa_id::text = %L', v_service_tbl, v_src);
  execute v_sql using v_emp;
  get diagnostics v_serv_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'empresa_id';
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'estoque_atual'
  ) into v_inv_has_atual;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'estoque_minimo'
  ) into v_inv_has_min;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'saldo_atual'
  ) into v_inv_has_saldo;

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_inv_src
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'inventory'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','estoque_atual','estoque_minimo','saldo_atual');

  v_sql := 'insert into public.inventory(id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when v_inv_has_atual then ', estoque_atual' else '' end)
        || (case when v_inv_has_min then ', estoque_minimo' else '' end)
        || (case when v_inv_has_saldo then ', saldo_atual' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when v_inv_has_atual then ', 0' else '' end)
        || (case when v_inv_has_min then ', 0' else '' end)
        || (case when v_inv_has_saldo then ', 0' else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || format(' from public.%I t join tmp_inv_map m on m.old_id = t.id::text', v_inv_src)
        || case when v_inv_src = 'inventory' then format(' where t.empresa_id::text = %L', v_src) else '' end;
  execute v_sql using v_emp;
  get diagnostics v_inv_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usage_models' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = 'usage_models'
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'usage_models'
    and c.column_name not in ('id','empresa_id','created_at','updated_at');

  v_sql := 'insert into public.usage_models(id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || format(' from public.usage_models t join tmp_model_map m on m.old_id = t.id::text where t.empresa_id::text = %L', v_src);
  execute v_sql using v_emp;
  get diagnostics v_models_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'model_items' and column_name = 'empresa_id'
  ) into v_model_items_has_emp;
  select (c.udt_name = 'uuid')
    into v_model_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'model_id';
  select (c.udt_name = 'uuid')
    into v_inventory_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'inventory_id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = 'model_items'
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'model_items'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','model_id','inventory_id');

  v_sql := 'insert into public.model_items(model_id, inventory_id'
        || (case when v_model_items_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') select '
        || (case when v_model_id_is_uuid then 'mm.new_id' else 'mm.new_id::text' end)
        || ', '
        || (case when v_inventory_id_is_uuid then 'im.new_id' else 'im.new_id::text' end)
        || (case when v_model_items_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || format(' from public.model_items t join tmp_model_map mm on mm.old_id = t.model_id::text join tmp_inv_map im on im.old_id = t.inventory_id::text join public.usage_models um on um.id::text = t.model_id::text where um.empresa_id::text = %L', v_src);
  execute v_sql using v_emp;
  get diagnostics v_model_items_count = row_count;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_mapping' and column_name = 'empresa_id'
  ) into v_service_map_has_emp;
  select (c.udt_name = 'uuid')
    into v_service_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'service_id';
  select (c.udt_name = 'uuid')
    into v_model_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'model_id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = 'service_mapping'
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'service_mapping'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','service_id','model_id');

  v_sql := 'insert into public.service_mapping(service_id, model_id'
        || (case when v_service_map_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') select '
        || (case when v_service_id_is_uuid then 'sm.new_id' else 'sm.new_id::text' end)
        || ', '
        || (case when v_model_id_is_uuid then 'mm.new_id' else 'mm.new_id::text' end)
        || (case when v_service_map_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || format(' from public.service_mapping t join tmp_serv_map sm on sm.old_id = t.service_id::text join tmp_model_map mm on mm.old_id = t.model_id::text join public.%I s on s.id::text = t.service_id::text where s.empresa_id::text = %L', v_service_tbl, v_src);
  execute v_sql using v_emp;
  get diagnostics v_map_count = row_count;

  insert into public.occ_empresa_imports(empresa_id, kind, imported_by)
  values (v_emp, 'default_templates_v1', v_uid);

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'source_empresa_id', v_src,
    'servicos', v_serv_count,
    'inventory', v_inv_count,
    'usage_models', v_models_count,
    'model_items', v_model_items_count,
    'service_mapping', v_map_count
  );
end;
$$;

notify pgrst, 'reload schema';
