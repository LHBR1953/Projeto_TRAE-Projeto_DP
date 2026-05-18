create or replace function public.rpc_resync_stock_from_templates(p_empresa_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_sql_admin boolean := false;
  v_ins_mi int := 0;
  v_ins_map int := 0;
  v_has_mi_emp boolean := false;
  v_has_sm_emp boolean := false;
  v_tpl_inv text;
  v_tpl_serv text;
  v_tpl_models text;
  v_tpl_model_items text;
  v_tpl_map text;
  v_sql text;
  v_expected_mi int := 0;
  v_actual_mi int := 0;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_mi_emp_is_uuid boolean := false;
  v_sm_service_is_uuid boolean := false;
  v_sm_model_is_uuid boolean := false;
  v_sm_emp_is_uuid boolean := false;
begin
  if v_emp = '' then
    raise exception 'empresa_id inválido.';
  end if;

  v_is_sql_admin := (current_user in ('postgres', 'supabase_admin'));

  if v_uid is null and v_role <> 'service_role' and not v_is_sql_admin then
    raise exception 'Usuário não autenticado.';
  end if;

  if v_uid is not null and not v_is_sql_admin then
    if not exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_uid
        and ue.empresa_id = v_emp
    ) then
      raise exception 'Sem permissão para esta empresa.';
    end if;
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
    else null
  end;

  if v_tpl_serv is null or v_tpl_inv is null or v_tpl_models is null or v_tpl_model_items is null or v_tpl_map is null then
    raise exception 'Tabelas de template ausentes para resync.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'model_items'
      and column_name = 'empresa_id'
  ) into v_has_mi_emp;
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_mapping'
      and column_name = 'empresa_id'
  ) into v_has_sm_emp;
  select (udt_name = 'uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';
  select (udt_name = 'uuid') into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='inventory_id';
  select (udt_name = 'uuid') into v_mi_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='empresa_id';
  select (udt_name = 'uuid') into v_sm_service_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='service_mapping' and column_name='service_id';
  select (udt_name = 'uuid') into v_sm_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='service_mapping' and column_name='model_id';
  select (udt_name = 'uuid') into v_sm_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='service_mapping' and column_name='empresa_id';

  create temporary table tmp_serv_match(tpl_service_id text primary key, live_service_id text not null) on commit drop;
  create temporary table tmp_model_match(tpl_model_id text primary key, live_model_id text not null) on commit drop;
  create temporary table tmp_inv_match(tpl_inventory_id text primary key, live_inventory_id text not null) on commit drop;

  insert into tmp_serv_match(tpl_service_id, live_service_id)
  select st.id::text, s.id::text
  from public.servicos_template st
  join public.servicos s
    on upper(btrim(s.descricao)) = upper(btrim(st.descricao))
   and s.empresa_id = v_emp
  where st.descricao is not null and btrim(st.descricao) <> '';

  execute format($sql$
    insert into tmp_model_match(tpl_model_id, live_model_id)
    select mt.id::text, m.id::text
    from public.%I mt
    join public.usage_models m
      on upper(translate(regexp_replace(btrim(m.nome_modelo), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(mt.nome_modelo), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
     and m.empresa_id = $1
    where mt.nome_modelo is not null and btrim(mt.nome_modelo) <> ''
  $sql$, v_tpl_models) using v_emp;

  execute format($sql$
    insert into tmp_inv_match(tpl_inventory_id, live_inventory_id)
    select it.id::text, i.id::text
    from public.%I it
    join public.inventory i
      on upper(translate(regexp_replace(btrim(i.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(it.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
     and i.empresa_id = $1
    where it.nome is not null and btrim(it.nome) <> ''
  $sql$, v_tpl_inv) using v_emp;

  if v_has_mi_emp then
    execute 'delete from public.model_items where empresa_id::text = $1' using v_emp;
  else
    execute
      'delete from public.model_items mi using public.usage_models um ' ||
      'where um.id::text = mi.model_id::text and um.empresa_id::text = $1'
    using v_emp;
  end if;

  if v_has_mi_emp then
    v_sql := format($sql$
      insert into public.model_items(model_id, inventory_id, quantidade_sugerida, empresa_id)
      select
        %s,
        %s,
        coalesce(t.quantidade_sugerida, 1),
        %s
      from public.%I t
      join tmp_model_match mm on mm.tpl_model_id = t.model_id::text
      join tmp_inv_match im on im.tpl_inventory_id = t.inventory_id::text
      where not exists (
        select 1
        from public.model_items mi
        where mi.model_id::text = mm.live_model_id
          and mi.inventory_id::text = im.live_inventory_id
          and mi.empresa_id::text = $1
      )
    $sql$,
      case when v_mi_model_is_uuid then 'mm.live_model_id::uuid' else 'mm.live_model_id::text' end,
      case when v_mi_inv_is_uuid then 'im.live_inventory_id::uuid' else 'im.live_inventory_id::text' end,
      case when v_mi_emp_is_uuid then '$1::uuid' else '$1' end,
      v_tpl_model_items
    );
  else
    v_sql := format($sql$
      insert into public.model_items(model_id, inventory_id, quantidade_sugerida)
      select
        %s,
        %s,
        coalesce(t.quantidade_sugerida, 1)
      from public.%I t
      join tmp_model_match mm on mm.tpl_model_id = t.model_id::text
      join tmp_inv_match im on im.tpl_inventory_id = t.inventory_id::text
      where not exists (
        select 1
        from public.model_items mi
        where mi.model_id::text = mm.live_model_id
          and mi.inventory_id::text = im.live_inventory_id
      )
    $sql$,
      case when v_mi_model_is_uuid then 'mm.live_model_id::uuid' else 'mm.live_model_id::text' end,
      case when v_mi_inv_is_uuid then 'im.live_inventory_id::uuid' else 'im.live_inventory_id::text' end,
      v_tpl_model_items
    );
  end if;
  execute v_sql using v_emp;
  get diagnostics v_ins_mi = row_count;

  execute format(
    'select count(*) from public.%I t join tmp_model_match mm on mm.tpl_model_id = t.model_id::text join tmp_inv_match im on im.tpl_inventory_id = t.inventory_id::text',
    v_tpl_model_items
  ) into v_expected_mi;

  if v_has_mi_emp then
    execute 'select count(*) from public.model_items where empresa_id::text = $1' into v_actual_mi using v_emp;
  else
    execute
      'select count(*) from public.model_items mi join public.usage_models um on um.id::text = mi.model_id::text where um.empresa_id::text = $1'
    into v_actual_mi using v_emp;
  end if;

  if v_expected_mi <> v_actual_mi then
    raise exception 'Falha na integridade da importação: Esperados % itens, mas foram inseridos %. Operação cancelada para evitar kits vazios.', v_expected_mi, v_actual_mi;
  end if;

  if v_has_sm_emp then
    v_sql := format($sql$
      insert into public.service_mapping(service_id, model_id, empresa_id)
      select
        %s,
        %s,
        %s
      from public.%I t
      join tmp_serv_match sm on sm.tpl_service_id = t.service_id::text
      join tmp_model_match mm on mm.tpl_model_id = t.model_id::text
      where not exists (
        select 1
        from public.service_mapping x
        where x.service_id::text = sm.live_service_id
          and x.model_id::text = mm.live_model_id
          and x.empresa_id::text = $1
      )
    $sql$,
      case when v_sm_service_is_uuid then 'sm.live_service_id::uuid' else 'sm.live_service_id::text' end,
      case when v_sm_model_is_uuid then 'mm.live_model_id::uuid' else 'mm.live_model_id::text' end,
      case when v_sm_emp_is_uuid then '$1::uuid' else '$1' end,
      v_tpl_map
    );
    execute v_sql using v_emp;
  else
    v_sql := format($sql$
      insert into public.service_mapping(service_id, model_id)
      select
        %s,
        %s
      from public.%I t
      join tmp_serv_match sm on sm.tpl_service_id = t.service_id::text
      join tmp_model_match mm on mm.tpl_model_id = t.model_id::text
      where not exists (
        select 1
        from public.service_mapping x
        where x.service_id::text = sm.live_service_id
          and x.model_id::text = mm.live_model_id
      )
    $sql$,
      case when v_sm_service_is_uuid then 'sm.live_service_id::uuid' else 'sm.live_service_id::text' end,
      case when v_sm_model_is_uuid then 'mm.live_model_id::uuid' else 'mm.live_model_id::text' end,
      v_tpl_map
    );
    execute v_sql;
  end if;
  get diagnostics v_ins_map = row_count;

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'inserted_model_items', v_ins_mi,
    'inserted_service_mapping', v_ins_map
  );
end;
$$;

notify pgrst, 'reload schema';
