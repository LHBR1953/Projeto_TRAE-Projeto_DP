do $$
declare
  v_src text := 'emp_3cae3a6512';
  v_dst text := 'emp_231ac8f35f';
  v_mi_has_emp boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_mi_emp_is_uuid boolean := false;
  v_um_emp_is_uuid boolean := false;
  v_inv_emp_is_uuid boolean := false;
  v_um_has_include boolean := false;
  v_src_count int := 0;
  v_dst_count int := 0;
  v_sql text;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='model_items' and column_name='empresa_id'
  ) into v_mi_has_emp;
  select (udt_name='uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';
  select (udt_name='uuid') into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='inventory_id';
  select (udt_name='uuid') into v_mi_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='empresa_id';
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

  v_sql :=
    'insert into public.usage_models(empresa_id, nome_modelo'
    || case when v_um_has_include then ', include_biosseguranca' else '' end
    || ') '
    || 'select '
    || case when v_um_emp_is_uuid then '$1::uuid' else '$1' end
    || ', su.nome_modelo'
    || case when v_um_has_include then ', coalesce(su.include_biosseguranca, true)' else '' end
    || ' from public.usage_models su '
    || 'where su.empresa_id::text = $2 '
    || '  and not exists ('
    || '    select 1 from public.usage_models du '
    || '    where du.empresa_id::text = $1 '
    || '      and upper(translate(regexp_replace(btrim(du.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '          = upper(translate(regexp_replace(btrim(su.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '  )';
  execute v_sql using v_dst, v_src;

  v_sql :=
    'insert into public.inventory(empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo) '
    || 'select '
    || case when v_inv_emp_is_uuid then '$1::uuid' else '$1' end
    || ', si.nome, coalesce(si.unidade, ''un''), coalesce(si.unidade_medida, ''un''), coalesce(si.fator_conversao, 1), coalesce(si.preco_custo, 0), coalesce(si.estoque_minimo, 0), coalesce(si.tipo_inventario, ''consumiveis''), coalesce(si.area, ''Geral''), coalesce(si.categoria, ''Geral''), coalesce(si.eh_consumivel, true), coalesce(si.ativo, true) '
    || 'from public.inventory si '
    || 'join public.model_items smi on smi.inventory_id::text = si.id::text '
    || 'join public.usage_models sumd on sumd.id::text = smi.model_id::text and sumd.empresa_id::text = $2 '
    || 'where si.empresa_id::text = $2 '
    || '  and not exists ('
    || '    select 1 from public.inventory di '
    || '    where di.empresa_id::text = $1 '
    || '      and upper(translate(regexp_replace(btrim(di.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '          = upper(translate(regexp_replace(btrim(si.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '  )';
  execute v_sql using v_dst, v_src;

  if v_mi_has_emp then
    execute 'delete from public.model_items where empresa_id::text = $1' using v_dst;
  else
    execute
      'delete from public.model_items mi using public.usage_models um ' ||
      'where um.id::text = mi.model_id::text and um.empresa_id::text = $1'
    using v_dst;
  end if;

  v_sql :=
    'insert into public.model_items(model_id, inventory_id, quantidade_sugerida'
    || case when v_mi_has_emp then ', empresa_id' else '' end
    || ') '
    || 'select distinct on (du.id::text, di.id::text) '
    || case when v_mi_model_is_uuid then 'du.id::uuid' else 'du.id::text' end
    || ', '
    || case when v_mi_inv_is_uuid then 'di.id::uuid' else 'di.id::text' end
    || ', coalesce(smi.quantidade_sugerida, 1)'
    || case when v_mi_has_emp then case when v_mi_emp_is_uuid then ', $1::uuid' else ', $1' end else '' end
    || ' from public.model_items smi '
    || ' join public.usage_models su on su.id::text = smi.model_id::text and su.empresa_id::text = $2 '
    || ' join public.inventory si on si.id::text = smi.inventory_id::text and si.empresa_id::text = $2 '
    || ' join public.usage_models du on du.empresa_id::text = $1 '
    || '   and upper(translate(regexp_replace(btrim(du.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '       = upper(translate(regexp_replace(btrim(su.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ' join public.inventory di on di.empresa_id::text = $1 '
    || '   and upper(translate(regexp_replace(btrim(di.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || '       = upper(translate(regexp_replace(btrim(si.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
    || ' order by du.id::text, di.id::text, smi.id::text';
  execute v_sql using v_dst, v_src;

  select count(*) into v_src_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_src;

  select count(*) into v_dst_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_dst;

  if v_dst_count <> v_src_count then
    raise exception 'Clone de kits inconsistente: origem %, destino %', v_src_count, v_dst_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
