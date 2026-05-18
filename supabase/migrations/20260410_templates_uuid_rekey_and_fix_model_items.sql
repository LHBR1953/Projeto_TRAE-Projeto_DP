create extension if not exists pgcrypto;

do $$
declare
  v_usage_id_is_uuid boolean := false;
  v_inventory_id_is_uuid boolean := false;
  v_mi_id_is_uuid boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inventory_is_uuid boolean := false;
  v_sm_model_is_uuid boolean := false;
begin
  select (udt_name = 'uuid') into v_usage_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'usage_models_template' and column_name = 'id';

  select (udt_name = 'uuid') into v_inventory_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'inventory_template' and column_name = 'id';

  select (udt_name = 'uuid') into v_mi_id_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'model_items_template' and column_name = 'id';

  select (udt_name = 'uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'model_items_template' and column_name = 'model_id';

  select (udt_name = 'uuid') into v_mi_inventory_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'model_items_template' and column_name = 'inventory_id';

  select (udt_name = 'uuid') into v_sm_model_is_uuid
  from information_schema.columns
  where table_schema = 'public' and table_name = 'service_mapping_template' and column_name = 'model_id';

  if not v_usage_id_is_uuid or not v_inventory_id_is_uuid or not v_mi_id_is_uuid or not v_mi_model_is_uuid or not v_mi_inventory_is_uuid then
    create temporary table tmp_tpl_usage_map(old_id text primary key, new_id uuid not null) on commit drop;
    create temporary table tmp_tpl_inventory_map(old_id text primary key, new_id uuid not null) on commit drop;
    create temporary table tmp_tpl_mi_map(old_id text primary key, new_id uuid not null) on commit drop;

    insert into tmp_tpl_usage_map(old_id, new_id)
    select id::text,
           case
             when id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then id::text::uuid
             else gen_random_uuid()
           end
    from public.usage_models_template;

    insert into tmp_tpl_inventory_map(old_id, new_id)
    select id::text,
           case
             when id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then id::text::uuid
             else gen_random_uuid()
           end
    from public.inventory_template;

    insert into tmp_tpl_mi_map(old_id, new_id)
    select id::text,
           case
             when id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then id::text::uuid
             else gen_random_uuid()
           end
    from public.model_items_template;

    update public.model_items_template mi
    set model_id = um.new_id::text,
        inventory_id = im.new_id::text,
        id = mm.new_id::text
    from tmp_tpl_usage_map um,
         tmp_tpl_inventory_map im,
         tmp_tpl_mi_map mm
    where btrim(um.old_id) = btrim(mi.model_id::text)
      and btrim(im.old_id) = btrim(mi.inventory_id::text)
      and btrim(mm.old_id) = btrim(mi.id::text);

    update public.service_mapping_template sm
    set model_id = um.new_id::text
    from tmp_tpl_usage_map um
    where btrim(um.old_id) = btrim(sm.model_id::text);

    update public.usage_models_template um
    set id = m.new_id::text
    from tmp_tpl_usage_map m
    where btrim(m.old_id) = btrim(um.id::text);

    update public.inventory_template it
    set id = m.new_id::text
    from tmp_tpl_inventory_map m
    where btrim(m.old_id) = btrim(it.id::text);

    update public.usage_models_template
    set id = btrim(id::text)
    where id::text <> btrim(id::text);

    update public.inventory_template
    set id = btrim(id::text)
    where id::text <> btrim(id::text);

    update public.model_items_template
    set id = btrim(id::text),
        model_id = btrim(model_id::text),
        inventory_id = btrim(inventory_id::text)
    where id::text <> btrim(id::text)
       or model_id::text <> btrim(model_id::text)
       or inventory_id::text <> btrim(inventory_id::text);

    if not v_sm_model_is_uuid then
      update public.service_mapping_template
      set model_id = btrim(model_id::text)
      where model_id::text <> btrim(model_id::text);
    end if;
  end if;
end
$$;

notify pgrst, 'reload schema';

do $$
declare
  v_emp text := 'emp_3cae3a6512';
  v_has_emp boolean := false;
  v_emp_is_uuid boolean := false;
  v_model_id_is_uuid boolean := false;
  v_inventory_id_is_uuid boolean := false;
  v_tpl_count int := 0;
  v_dst_count int := 0;
  v_sql text;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='model_items' and column_name='empresa_id'
  ) into v_has_emp;

  select (udt_name = 'uuid') into v_emp_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='empresa_id';

  select (udt_name = 'uuid') into v_model_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';

  select (udt_name = 'uuid') into v_inventory_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='inventory_id';

  execute
    'delete from public.model_items mi ' ||
    'using public.usage_models um ' ||
    'where um.id::text = mi.model_id::text ' ||
    '  and um.empresa_id::text = $1'
  using v_emp;

  v_sql :=
    'insert into public.model_items(model_id, inventory_id'
    || case when v_has_emp then ', empresa_id' else '' end
    || ') '
    || 'with tpl as ( '
    || '  select t.id::text as tid, umt.nome_modelo as model_name, it.nome as item_name '
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
    || '  select tpl.tid, um.id as model_id_new, inv.id as inventory_id_new '
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
    || '  select distinct on (s.model_id_new::text, s.inventory_id_new::text) s.model_id_new, s.inventory_id_new, s.tid '
    || '  from src s '
    || '  order by s.model_id_new::text, s.inventory_id_new::text, s.tid '
    || ') '
    || 'select '
    || case when v_model_id_is_uuid then 's.model_id_new' else 's.model_id_new::text' end
    || ', '
    || case when v_inventory_id_is_uuid then 's.inventory_id_new' else 's.inventory_id_new::text' end
    || case when v_has_emp then case when v_emp_is_uuid then ', $1::uuid' else ', $1' end else '' end
    || ' from src_dedup s';
  execute v_sql using v_emp;

  select count(*) into v_tpl_count from public.model_items_template;

  select count(*) into v_dst_count
  from public.model_items mi
  join public.usage_models um on um.id::text = mi.model_id::text
  where um.empresa_id::text = v_emp;

  if v_tpl_count > 0 and v_dst_count <> v_tpl_count then
    raise exception 'Repopulação inconsistente de model_items para %: esperado %, obtido %', v_emp, v_tpl_count, v_dst_count;
  end if;
end
$$;
