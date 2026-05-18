do $$
declare
  v_fn text;
  v_new text;
begin
  select pg_get_functiondef('public.rpc_import_default_templates(text)'::regprocedure) into v_fn;
  if v_fn is null then
    raise exception 'Função rpc_import_default_templates(text) não encontrada';
  end if;

  v_new := v_fn;

  v_new := replace(
    v_new,
    '    execute
      ''delete from public.model_items mi '' ||
      ''using public.usage_models um '' ||
      ''where mi.model_id::text = um.id::text '' ||
      ''  and um.empresa_id::text = $1''
    using v_emp;',
    '    execute
      ''delete from public.model_items mi '' ||
      ''using public.usage_models um '' ||
      ''where mi.model_id::text = um.id::text '' ||
      ''  and um.empresa_id::text = $1''
    using v_emp;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = ''public''
        and table_name = ''model_items''
        and column_name = ''empresa_id''
    ) then
      execute
        ''delete from public.model_items '' ||
        ''where empresa_id::text = $1''
      using v_emp;
    end if;'
  );

  v_new := replace(
    v_new,
    '''  (select count(*) from live) as actual, '' ||',
    '''  (select count(*) from public.model_items mi join public.usage_models um on um.id = mi.model_id where um.empresa_id::text = $1) as actual, '' ||'
  );

  v_new := replace(
    v_new,
    '  if v_expected_mi > 0 and v_actual_mi < v_expected_mi then
    raise exception ''Importação inválida: model_items esperado %, obtido % (faltando modelos: %)'', v_expected_mi, v_actual_mi, coalesce(v_missing_mi_models, '''');
  end if;',
    '  if v_expected_mi > 0 and v_actual_mi <> v_expected_mi then
    raise exception ''Importação inválida (empresa=%): model_items esperado %, obtido % (faltando modelos: %)'', v_emp, v_expected_mi, v_actual_mi, coalesce(v_missing_mi_models, '''');
  end if;'
  );

  if v_new = v_fn then
    raise exception 'Nenhuma alteração aplicada na rpc_import_default_templates';
  end if;

  execute v_new;
end
$$;

notify pgrst, 'reload schema';
