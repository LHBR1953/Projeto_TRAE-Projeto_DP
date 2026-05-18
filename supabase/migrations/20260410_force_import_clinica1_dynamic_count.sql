do $$
declare
  v_emp text;
  v_tpl_count int := 0;
  v_dst_count int := 0;
begin
  select id::text into v_emp
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like 'clinica 1%'
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp is null then
    raise exception 'Clínica 1 não encontrada para importação forçada.';
  end if;

  perform public.rpc_import_default_templates(v_emp);

  select count(*) into v_tpl_count
  from public.model_items_template;

  select count(*) into v_dst_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_emp;

  if v_dst_count <> v_tpl_count then
    raise exception 'Falha pós-importação Clínica 1: tpl_count=%, dst_count=%', v_tpl_count, v_dst_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
