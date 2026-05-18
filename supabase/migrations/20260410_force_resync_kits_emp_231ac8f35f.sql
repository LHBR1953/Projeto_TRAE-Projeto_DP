do $$
declare
  v_emp text := 'emp_231ac8f35f';
  v_expected int := 0;
  v_actual int := 0;
  v_has_mi_emp boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_emp_is_uuid boolean := false;
  v_inv_emp_is_uuid boolean := false;
  v_um_emp_is_uuid boolean := false;
  v_um_has_include boolean := false;
  v_sql text;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='model_items' and column_name='empresa_id'
  ) into v_has_mi_emp;
  select (udt_name='uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';
  select (udt_name='uuid') into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='inventory_id';
  select (udt_name='uuid') into v_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='empresa_id';
  select (udt_name='uuid') into v_inv_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='inventory' and column_name='empresa_id';
  select (udt_name='uuid') into v_um_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='usage_models' and column_name='empresa_id';
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='usage_models' and column_name='include_biosseguranca'
  ) into v_um_has_include;

  v_sql :=
    'insert into public.usage_models(empresa_id, nome_modelo'
    || case when v_um_has_include then ', include_biosseguranca' else '' end
    || ') '
    || 'select '
    || case when v_um_emp_is_uuid then '$1::uuid' else '$1' end
    || ', t.nome_modelo'
    || case when v_um_has_include then ', coalesce(t.include_biosseguranca, true)' else '' end
    || ' from public.usage_models_template t '
    || 'where not exists ('
    || '  select 1 from public.usage_models u '
    || '  where u.empresa_id::text = $1 '
    || '    and upper(translate(regexp_replace(btrim(u.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '        = upper(translate(regexp_replace(btrim(t.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ')';
  execute v_sql using v_emp;

  v_sql :=
    'insert into public.inventory(empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo) '
    || 'select '
    || case when v_inv_emp_is_uuid then '$1::uuid' else '$1' end
    || ', it.nome, coalesce(it.unidade, ''un''), coalesce(it.unidade_medida, ''un''), coalesce(it.fator_conversao,1), coalesce(it.preco_custo,0), coalesce(it.estoque_minimo,0), coalesce(it.tipo_inventario,''consumiveis''), coalesce(it.area,''Geral''), coalesce(it.categoria,''Geral''), coalesce(it.eh_consumivel,true), coalesce(it.ativo,true) '
    || 'from public.inventory_template it '
    || 'where not exists ('
    || '  select 1 from public.inventory i '
    || '  where i.empresa_id::text = $1 '
    || '    and upper(translate(regexp_replace(btrim(i.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '        = upper(translate(regexp_replace(btrim(it.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ')';
  execute v_sql using v_emp;

  if v_has_mi_emp then
    execute 'delete from public.model_items where empresa_id::text = $1' using v_emp;
  else
    execute
      'delete from public.model_items mi using public.usage_models um ' ||
      'where um.id::text = mi.model_id::text and um.empresa_id::text = $1'
    using v_emp;
  end if;

  v_sql :=
    'insert into public.model_items(model_id, inventory_id, quantidade_sugerida'
    || case when v_has_mi_emp then ', empresa_id' else '' end
    || ') '
    || 'with tpl as ( '
    || '  select t.id::text as tid, umt.nome_modelo as model_name, it.nome as item_name, t.quantidade_sugerida '
    || '  from public.model_items_template t '
    || '  join public.usage_models_template umt on ('
    || '       btrim(umt.id::text) = btrim(t.model_id::text) '
    || '    or upper(translate(regexp_replace(btrim(umt.nome_modelo), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '       = upper(translate(regexp_replace(btrim(t.model_id::text), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '  ) '
    || '  join public.inventory_template it on ('
    || '       btrim(it.id::text) = btrim(t.inventory_id::text) '
    || '    or upper(translate(regexp_replace(btrim(it.nome), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '       = upper(translate(regexp_replace(btrim(t.inventory_id::text), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '  ) '
    || '), src as ( '
    || '  select tpl.tid, um.id as model_id_new, inv.id as inventory_id_new, coalesce(tpl.quantidade_sugerida, 1) as quantidade_sugerida '
    || '  from tpl '
    || '  join lateral ( '
    || '    select u.id '
    || '    from public.usage_models u '
    || '    where u.empresa_id::text = $1 '
    || '      and upper(translate(regexp_replace(btrim(u.nome_modelo), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '          = upper(translate(regexp_replace(btrim(tpl.model_name), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '    order by u.id '
    || '    limit 1 '
    || '  ) um on true '
    || '  join lateral ( '
    || '    select i.id '
    || '    from public.inventory i '
    || '    where i.empresa_id::text = $1 '
    || '      and upper(translate(regexp_replace(btrim(i.nome), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '          = upper(translate(regexp_replace(btrim(tpl.item_name), ''[[:space:]]+'', '' '', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '    order by i.id '
    || '    limit 1 '
    || '  ) inv on true '
    || '), src_dedup as ( '
    || '  select distinct on (s.model_id_new::text, s.inventory_id_new::text) s.model_id_new, s.inventory_id_new, s.quantidade_sugerida, s.tid '
    || '  from src s '
    || '  order by s.model_id_new::text, s.inventory_id_new::text, s.tid '
    || ') '
    || 'select '
    || case when v_mi_model_is_uuid then 's.model_id_new' else 's.model_id_new::text' end
    || ', '
    || case when v_mi_inv_is_uuid then 's.inventory_id_new' else 's.inventory_id_new::text' end
    || ', s.quantidade_sugerida'
    || case when v_has_mi_emp then case when v_emp_is_uuid then ', $1::uuid' else ', $1' end else '' end
    || ' from src_dedup s';
  execute v_sql using v_emp;

  select count(*) into v_expected
  from public.model_items_template;

  select count(*) into v_actual
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_emp;

  if v_actual <> v_expected then
    raise exception 'Falha no resync forçado (%): esperado %, obtido %', v_emp, v_expected, v_actual;
  end if;
end
$$;

notify pgrst, 'reload schema';
