do $$
declare
  v_src_emp text := 'emp_3cae3a6512';
  v_emp_clinica1 text;
  v_tpl_target int := 45;
  v_src_count int := 0;
  v_tpl_count int := 0;
  v_expected_mapped int := 0;
  v_dst_count int := 0;
  v_diag text;
  v_prot text;
  v_keep_gaze text;
  v_mi_id_is_uuid boolean := false;
  v_mi_id_has_default boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_sql text;
  v_expr_id text;
  v_expr_model text;
  v_expr_inv text;
begin
  select (udt_name = 'uuid'),
         (column_default is not null and lower(coalesce(column_default, '')) like '%gen_random_uuid%')
  into v_mi_id_is_uuid, v_mi_id_has_default
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='id';

  select (udt_name = 'uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='model_id';

  select (udt_name = 'uuid') into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='inventory_id';

  select count(*) into v_src_count
  from (
    select distinct su.nome_modelo, si.nome
    from public.model_items smi
    join public.usage_models su on su.id::text = smi.model_id::text
    join public.inventory si on si.id::text = smi.inventory_id::text
    where su.empresa_id::text = v_src_emp
  ) x;

  if v_src_count < v_tpl_target then
    raise exception 'Fonte % insuficiente para restauração do template. Itens distintos na fonte: %', v_src_emp, v_src_count;
  end if;

  delete from public.model_items_template;

  v_expr_id := case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end;
  v_expr_model := case when v_mi_model_is_uuid then 'umt.id::uuid' else 'umt.id::text' end;
  v_expr_inv := case when v_mi_inv_is_uuid then 'it.id::uuid' else 'it.id::text' end;

  if v_mi_id_has_default then
    v_sql := format(
      'insert into public.model_items_template(model_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, max(coalesce(smi.quantidade_sugerida, 1)) ' ||
      'from public.model_items smi ' ||
      'join public.usage_models su on su.id::text = smi.model_id::text and su.empresa_id::text = $1 ' ||
      'join public.inventory si on si.id::text = smi.inventory_id::text ' ||
      'join public.usage_models_template umt ' ||
      '  on upper(translate(regexp_replace(btrim(umt.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      '     = upper(translate(regexp_replace(btrim(su.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      'join public.inventory_template it ' ||
      '  on upper(translate(regexp_replace(btrim(it.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      '     = upper(translate(regexp_replace(btrim(si.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      'group by umt.id, it.id',
      v_expr_model, v_expr_inv
    );
  else
    v_sql := format(
      'insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, %s, max(coalesce(smi.quantidade_sugerida, 1)) ' ||
      'from public.model_items smi ' ||
      'join public.usage_models su on su.id::text = smi.model_id::text and su.empresa_id::text = $1 ' ||
      'join public.inventory si on si.id::text = smi.inventory_id::text ' ||
      'join public.usage_models_template umt ' ||
      '  on upper(translate(regexp_replace(btrim(umt.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      '     = upper(translate(regexp_replace(btrim(su.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      'join public.inventory_template it ' ||
      '  on upper(translate(regexp_replace(btrim(it.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      '     = upper(translate(regexp_replace(btrim(si.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) ' ||
      'group by umt.id, it.id',
      v_expr_id, v_expr_model, v_expr_inv
    );
  end if;
  execute v_sql using v_src_emp;

  select count(*) into v_tpl_count from public.model_items_template;
  if v_tpl_count < v_tpl_target then
    raise exception 'Restauração incompleta do template: esperado pelo menos %, obtido %', v_tpl_target, v_tpl_count;
  end if;

  select id::text into v_diag
  from public.usage_models_template
  where lower(btrim(nome_modelo)) = lower('Kit Diagnóstico')
  limit 1;

  select id::text into v_prot
  from public.usage_models_template
  where lower(btrim(nome_modelo)) = lower('Kit Prótese')
  limit 1;

  if v_diag is null or v_prot is null then
    raise exception 'Modelos Kit Diagnóstico/Kit Prótese não encontrados para curadoria.';
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

  update public.model_items_template mi
  set quantidade_sugerida = 0.05
  from public.inventory_template it
  where mi.model_id::text = v_prot
    and it.id::text = mi.inventory_id::text
    and (
      lower(it.nome) like '%alginat%'
      or lower(it.nome) like '%gesso tipo iv%'
      or lower(it.nome) like '%gesso especial%'
    );

  delete from public.model_items_template a
  using public.model_items_template b
  where a.id::text > b.id::text
    and a.model_id::text = b.model_id::text
    and a.inventory_id::text = b.inventory_id::text;

  delete from public.model_items_template t
  where not exists (select 1 from public.usage_models_template u where u.id::text = t.model_id::text)
     or not exists (select 1 from public.inventory_template i where i.id::text = t.inventory_id::text);

  select id::text into v_emp_clinica1
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like 'clinica 1%'
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp_clinica1 is null then
    raise exception 'Clínica 1 não encontrada para validação.';
  end if;

  perform public.rpc_import_default_templates(v_emp_clinica1);
  perform public.rpc_resync_stock_from_templates(v_emp_clinica1);

  select count(*) into v_tpl_count from public.model_items_template;
  select count(*) into v_expected_mapped
  from (
    select distinct um.id::text, iv.id::text
    from public.model_items_template t
    join public.usage_models_template umt on umt.id::text = t.model_id::text
    join public.inventory_template it on it.id::text = t.inventory_id::text
    join public.usage_models um
      on um.empresa_id::text = v_emp_clinica1
     and upper(translate(regexp_replace(btrim(um.nome_modelo), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(umt.nome_modelo), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
    join public.inventory iv
      on iv.empresa_id::text = v_emp_clinica1
     and upper(translate(regexp_replace(btrim(iv.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
         = upper(translate(regexp_replace(btrim(it.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
  ) x;
  select count(*) into v_dst_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_emp_clinica1;

  if v_dst_count <> v_tpl_count and v_dst_count <> v_expected_mapped then
    raise exception 'Falha pós-restauração/curadoria: tpl_count=%, expected_mapped=%, dst_count=%', v_tpl_count, v_expected_mapped, v_dst_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
