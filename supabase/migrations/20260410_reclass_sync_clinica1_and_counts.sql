do $$
declare
  v_emp text;
  v_tpl_prot text;
  v_tpl_dent text;
  v_live_prot text;
  v_live_dent text;
  v_tpl_prot_count int := 0;
  v_tpl_dent_count int := 0;
  v_upd_inv int := 0;
  v_upd_mi int := 0;
  v_mi_model_is_uuid boolean := false;
  v_sql text;
begin
  select (udt_name = 'uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';

  select id::text into v_tpl_prot
  from public.usage_models_template
  where lower(translate(btrim(nome_modelo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%protese%'
  order by id::text
  limit 1;

  select id::text into v_tpl_dent
  from public.usage_models_template
  where lower(translate(btrim(nome_modelo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%dent%'
  order by id::text
  limit 1;

  update public.inventory_template
  set area = 'Prótese',
      categoria = 'Prótese'
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso tipo iv%'
     or lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso especial%';

  if v_tpl_prot is not null and v_tpl_dent is not null then
    select count(*) into v_tpl_prot_count
    from public.model_items_template
    where model_id::text = v_tpl_prot;

    select count(*) into v_tpl_dent_count
    from public.model_items_template
    where model_id::text = v_tpl_dent;
  end if;

  select id::text into v_emp
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like 'clinica 1%'
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp is not null then
    update public.inventory
    set area = 'Prótese',
        categoria = 'Prótese'
    where empresa_id::text = v_emp
      and (
        lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso tipo iv%'
        or lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso especial%'
      );
    get diagnostics v_upd_inv = row_count;

    select id::text into v_live_prot
    from public.usage_models
    where empresa_id::text = v_emp
      and lower(translate(btrim(nome_modelo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%protese%'
    order by id::text
    limit 1;

    select id::text into v_live_dent
    from public.usage_models
    where empresa_id::text = v_emp
      and lower(translate(btrim(nome_modelo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%dent%'
    order by id::text
    limit 1;

    if v_live_prot is not null and v_live_dent is not null then
      v_sql :=
        'update public.model_items mi ' ||
        'set model_id = ' || case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end || ' ' ||
        'from public.inventory iv ' ||
        'where mi.model_id::text = $2 ' ||
        '  and iv.id::text = mi.inventory_id::text ' ||
        '  and iv.empresa_id::text = $3 ' ||
        '  and ( ' ||
        '    lower(translate(btrim(iv.nome), ''áàâãäéèêëíìîïóòôõöúùûüç'', ''aaaaaeeeeiiiiooooouuuuc'')) like ''%gesso tipo iv%'' ' ||
        '    or lower(translate(btrim(iv.nome), ''áàâãäéèêëíìîïóòôõöúùûüç'', ''aaaaaeeeeiiiiooooouuuuc'')) like ''%gesso especial%'' ' ||
        '  ) ' ||
        '  and not exists ( ' ||
        '    select 1 from public.model_items x ' ||
        '    where x.model_id::text = $1 and x.inventory_id::text = mi.inventory_id::text ' ||
        '  )';
      execute v_sql using v_live_prot, v_live_dent, v_emp;
      get diagnostics v_upd_mi = row_count;
    end if;
  end if;

  raise notice 'Reclassificação concluída. template_protese_count=%, template_dentistica_count=%, clinica1_inventory_updated=%, clinica1_model_items_moved=%',
    v_tpl_prot_count, v_tpl_dent_count, v_upd_inv, v_upd_mi;
end
$$;

notify pgrst, 'reload schema';
