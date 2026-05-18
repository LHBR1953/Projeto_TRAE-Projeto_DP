do $$
declare
  v_emp text;
  v_diag text;
  v_keep_gaze text;
  v_tpl_count int := 0;
  v_dst_count int := 0;
  v_missing_count int := 0;
  v_missing_list text := '';
  v_um_emp_is_uuid boolean := false;
  v_inv_emp_is_uuid boolean := false;
  v_um_has_include boolean := false;
  v_sql text;
begin
  select id::text into v_emp
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like 'clinica 1%'
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp is null then
    raise exception 'Clínica 1 não encontrada.';
  end if;

  select (udt_name='uuid') into v_um_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='usage_models' and column_name='empresa_id';

  select (udt_name='uuid') into v_inv_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='inventory' and column_name='empresa_id';

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='usage_models' and column_name='include_biosseguranca'
  ) into v_um_has_include;

  update public.inventory_template
  set nome = btrim(regexp_replace(nome, '[[:space:]]+', ' ', 'g'))
  where nome is not null
    and nome <> btrim(regexp_replace(nome, '[[:space:]]+', ' ', 'g'));

  select id::text into v_diag
  from public.usage_models_template
  where lower(btrim(nome_modelo)) = lower('Kit Diagnóstico')
  limit 1;

  if v_diag is null then
    raise exception 'Kit Diagnóstico não encontrado no template.';
  end if;

  delete from public.model_items_template mi
  using public.inventory_template it
  where mi.model_id::text = v_diag
    and it.id::text = mi.inventory_id::text
    and (lower(it.nome) like '%touca%' or lower(it.nome) like '%sugador%');

  select it.id::text into v_keep_gaze
  from public.inventory_template it
  where lower(it.nome) like '%gaze est%'
    and (lower(it.nome) like '%pct 10%' or lower(it.nome) like '%pct. 10%' or lower(it.nome) like '%pacote 10%')
  order by it.id::text
  limit 1;

  if v_keep_gaze is not null then
    delete from public.model_items_template mi
    using public.inventory_template it
    where mi.model_id::text = v_diag
      and it.id::text = mi.inventory_id::text
      and lower(it.nome) like '%gaze%'
      and mi.inventory_id::text <> v_keep_gaze;
  end if;

  delete from public.model_items_template a
  using public.model_items_template b, public.inventory_template ia, public.inventory_template ib
  where a.id::text > b.id::text
    and a.model_id::text = b.model_id::text
    and upper(translate(regexp_replace(btrim(ia.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
        = upper(translate(regexp_replace(btrim(ib.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
    and ia.id::text = a.inventory_id::text
    and ib.id::text = b.inventory_id::text;

  with tpl as (
    select distinct
      umt.nome_modelo as model_name,
      it.nome as item_name
    from public.model_items_template t
    join public.usage_models_template umt on umt.id::text = t.model_id::text
    join public.inventory_template it on it.id::text = t.inventory_id::text
  ), missing as (
    select tpl.model_name, tpl.item_name
    from tpl
    left join public.usage_models um
      on um.empresa_id::text = v_emp
     and upper(translate(regexp_replace(btrim(um.nome_modelo), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(tpl.model_name), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
    left join public.inventory iv
      on iv.empresa_id::text = v_emp
     and upper(translate(regexp_replace(btrim(iv.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(tpl.item_name), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
    where um.id is null or iv.id is null
  )
  select count(*), string_agg(model_name || ' -> ' || item_name, ' | ' order by model_name, item_name)
  into v_missing_count, v_missing_list
  from missing;

  v_sql :=
    'insert into public.usage_models(empresa_id, nome_modelo'
    || case when v_um_has_include then ', include_biosseguranca' else '' end
    || ') '
    || 'select '
    || case when v_um_emp_is_uuid then '$1::uuid' else '$1' end
    || ', umt.nome_modelo'
    || case when v_um_has_include then ', coalesce(umt.include_biosseguranca, true)' else '' end
    || ' from public.usage_models_template umt '
    || 'where not exists ('
    || '  select 1 from public.usage_models um '
    || '  where um.empresa_id::text = $1 '
    || '    and upper(translate(regexp_replace(btrim(um.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '        = upper(translate(regexp_replace(btrim(umt.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ')';
  execute v_sql using v_emp;

  v_sql :=
    'insert into public.inventory(empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo) '
    || 'select '
    || case when v_inv_emp_is_uuid then '$1::uuid' else '$1' end
    || ', it.nome, coalesce(it.unidade, ''un''), coalesce(it.unidade_medida, ''un''), coalesce(it.fator_conversao,1), coalesce(it.preco_custo,0), coalesce(it.estoque_minimo,0), coalesce(it.tipo_inventario,''consumiveis''), coalesce(it.area,''Geral''), coalesce(it.categoria,''Geral''), coalesce(it.eh_consumivel,true), coalesce(it.ativo,true) '
    || 'from public.inventory_template it '
    || 'where not exists ('
    || '  select 1 from public.inventory iv '
    || '  where iv.empresa_id::text = $1 '
    || '    and upper(translate(regexp_replace(btrim(iv.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '        = upper(translate(regexp_replace(btrim(it.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ')';
  execute v_sql using v_emp;

  perform public.rpc_import_default_templates(v_emp);
  perform public.rpc_resync_stock_from_templates(v_emp);

  select count(*) into v_tpl_count
  from (
    select distinct t.model_id::text, t.inventory_id::text
    from public.model_items_template t
  ) x;

  select count(*) into v_dst_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_emp;

  if v_dst_count <> v_tpl_count then
    raise exception 'Gap persistente: tpl_count=%, dst_count=%, missing_before_fix=%', v_tpl_count, v_dst_count, coalesce(v_missing_list, '');
  end if;
end
$$;

notify pgrst, 'reload schema';
