do $$
declare
  v_diag text;
  v_bios text;
  v_prot text;
  v_exo text;
  v_inv_benzo text;
  v_emp_clinica1 text;
  v_expected int := 0;
  v_actual int := 0;
  v_mi_id_has_default boolean := false;
  v_mi_id_is_uuid boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_inv_id_is_uuid boolean := false;
  v_sql text;
begin
  if to_regclass('public.usage_models_template') is null
     or to_regclass('public.model_items_template') is null
     or to_regclass('public.inventory_template') is null then
    raise exception 'Tabelas de template ausentes para curadoria dos kits.';
  end if;

  select exists(
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='model_items_template' and column_name='id'
      and coalesce(column_default,'') ilike '%gen_random_uuid%'
  ) into v_mi_id_has_default;

  select (udt_name = 'uuid') into v_mi_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='id';

  select (udt_name = 'uuid') into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='model_id';

  select (udt_name = 'uuid') into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='inventory_id';

  select (udt_name = 'uuid') into v_inv_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='inventory_template' and column_name='id';

  select id::text into v_diag from public.usage_models_template where lower(btrim(nome_modelo)) = lower('Kit Diagnóstico') limit 1;
  select id::text into v_bios from public.usage_models_template where lower(btrim(nome_modelo)) = lower('Kit Biossegurança') limit 1;
  select id::text into v_prot from public.usage_models_template where lower(btrim(nome_modelo)) = lower('Kit Prótese') limit 1;
  select id::text into v_exo from public.usage_models_template where lower(btrim(nome_modelo)) = lower('Kit Exodontia') limit 1;

  if v_diag is null or v_bios is null or v_prot is null or v_exo is null then
    raise exception 'Modelos necessários não encontrados (Diagnóstico/Biossegurança/Prótese/Exodontia).';
  end if;

  delete from public.model_items_template mi
  using public.inventory_template it
  where mi.model_id::text <> v_bios
    and it.id::text = mi.inventory_id::text
    and (
      lower(it.nome) like '%touca%'
      or lower(it.nome) like '%sugador%'
    );

  delete from public.model_items_template mi
  using public.inventory_template it
  where mi.model_id::text = v_diag
    and it.id::text = mi.inventory_id::text
    and lower(it.nome) like '%gaze%'
    and not (
      lower(it.nome) like '%gaze est%'
      and (lower(it.nome) like '%pct 10%' or lower(it.nome) like '%pct. 10%' or lower(it.nome) like '%pacote 10%')
    );

  delete from public.model_items_template a
  using public.model_items_template b, public.inventory_template ia, public.inventory_template ib
  where a.model_id::text = v_diag
    and b.model_id::text = v_diag
    and a.id::text > b.id::text
    and ia.id::text = a.inventory_id::text
    and ib.id::text = b.inventory_id::text
    and lower(ia.nome) like '%gaze est%'
    and lower(ib.nome) like '%gaze est%';

  if exists (select 1 from public.inventory_template where lower(nome) like '%espelho cl%') then
    insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
    select
      case when v_mi_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      case when v_mi_model_is_uuid then v_diag::uuid else v_diag::text end,
      case when v_mi_inv_is_uuid then it.id::uuid else it.id::text end,
      1
    from public.inventory_template it
    where lower(it.nome) like '%espelho cl%'
      and not exists (
        select 1 from public.model_items_template mi
        where mi.model_id::text = v_diag and mi.inventory_id::text = it.id::text
      )
    limit 1;
  end if;

  if exists (select 1 from public.inventory_template where lower(nome) like '%pin%c% cl%') then
    insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
    select
      case when v_mi_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      case when v_mi_model_is_uuid then v_diag::uuid else v_diag::text end,
      case when v_mi_inv_is_uuid then it.id::uuid else it.id::text end,
      1
    from public.inventory_template it
    where lower(it.nome) like '%pin%c% cl%'
      and not exists (
        select 1 from public.model_items_template mi
        where mi.model_id::text = v_diag and mi.inventory_id::text = it.id::text
      )
    limit 1;
  end if;

  if exists (select 1 from public.inventory_template where lower(nome) like '%sonda explor%') then
    insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
    select
      case when v_mi_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      case when v_mi_model_is_uuid then v_diag::uuid else v_diag::text end,
      case when v_mi_inv_is_uuid then it.id::uuid else it.id::text end,
      1
    from public.inventory_template it
    where lower(it.nome) like '%sonda explor%'
      and not exists (
        select 1 from public.model_items_template mi
        where mi.model_id::text = v_diag and mi.inventory_id::text = it.id::text
      )
    limit 1;
  end if;

  update public.model_items_template mi
  set quantidade_sugerida = 0.05
  from public.inventory_template it
  where mi.model_id::text = v_prot
    and it.id::text = mi.inventory_id::text
    and lower(coalesce(it.unidade, '')) = 'kg'
    and (
      lower(it.nome) like '%alginat%'
      or lower(it.nome) like '%gesso%'
    );

  delete from public.model_items_template mi
  using public.inventory_template it
  where mi.model_id::text = v_prot
    and it.id::text = mi.inventory_id::text
    and lower(it.nome) like 'insumo pr%';

  select id::text into v_inv_benzo
  from public.inventory_template
  where lower(nome) like '%benzocain%'
     or (lower(nome) like '%anestes%' and lower(nome) like '%topic%')
  order by case when lower(nome) like '%benzocain%' then 0 else 1 end, length(nome)
  limit 1;

  if v_inv_benzo is null then
    if v_inv_id_is_uuid then
      insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
      values (
        gen_random_uuid(),
        'Anestésico Tópico Benzocaína',
        'fr',
        'g',
        12,
        0,
        0,
        'consumiveis',
        'Exodontia',
        'Exodontia',
        true,
        true
      )
      returning id::text into v_inv_benzo;
    else
      insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
      values (
        gen_random_uuid()::text,
        'Anestésico Tópico Benzocaína',
        'fr',
        'g',
        12,
        0,
        0,
        'consumiveis',
        'Exodontia',
        'Exodontia',
        true,
        true
      )
      returning id::text into v_inv_benzo;
    end if;
  end if;

  v_sql := format(
    'insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida) ' ||
    'select %s, %s, %s, 0.10 ' ||
    'where not exists ( ' ||
    '  select 1 from public.model_items_template mi ' ||
    '  where mi.model_id::text = $1 and mi.inventory_id::text = $2 ' ||
    ')',
    case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end,
    case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end,
    case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
  );
  execute v_sql using v_exo, v_inv_benzo;

  delete from public.model_items_template a
  using public.model_items_template b, public.inventory_template ia, public.inventory_template ib
  where a.model_id::text = v_exo
    and b.model_id::text = v_exo
    and a.id::text > b.id::text
    and ia.id::text = a.inventory_id::text
    and ib.id::text = b.inventory_id::text
    and lower(ia.nome) like '%agulha%'
    and lower(ib.nome) like '%agulha%';

  delete from public.model_items_template mi
  using public.inventory_template it
  where mi.model_id::text = v_exo
    and it.id::text = mi.inventory_id::text
    and lower(it.nome) like 'insumo exodontia%';

  v_sql := 'update public.model_items_template mi '
        || 'set model_id = ' || (case when v_mi_model_is_uuid then 'fix.new_model_id::uuid' else 'fix.new_model_id::text' end)
        || ', inventory_id = ' || (case when v_mi_inv_is_uuid then 'fix.new_inventory_id::uuid' else 'fix.new_inventory_id::text' end)
        || ' from ('
        || '   select t.id::text as row_id, um.id::text as new_model_id, iv.id::text as new_inventory_id '
        || '   from public.model_items_template t '
        || '   join lateral ('
        || '     select u.id '
        || '     from public.usage_models_template u '
        || '     where u.id::text = btrim(t.model_id::text) '
        || '        or (lower(t.model_id::text) like ''%biosseg%'' and lower(u.nome_modelo) like ''%biosseg%'') '
        || '        or (lower(t.model_id::text) like ''%dent%'' and lower(u.nome_modelo) like ''%dent%'') '
        || '        or (lower(t.model_id::text) like ''%endo%'' and lower(u.nome_modelo) like ''%endo%'') '
        || '        or (lower(t.model_id::text) like ''%exo%'' and lower(u.nome_modelo) like ''%exo%'') '
        || '        or (lower(t.model_id::text) like ''%perio%'' and lower(u.nome_modelo) like ''%perio%'') '
        || '        or (lower(t.model_id::text) like ''%radio%'' and lower(u.nome_modelo) like ''%radio%'') '
        || '        or (lower(t.model_id::text) like ''%prot%'' and (lower(u.nome_modelo) like ''%prot%'' or lower(u.nome_modelo) like ''%prót%'')) '
        || '        or (lower(t.model_id::text) like ''%orto%'' and lower(u.nome_modelo) like ''%orto%'') '
        || '        or (lower(t.model_id::text) like ''%impl%'' and lower(u.nome_modelo) like ''%impl%'') '
        || '        or ((lower(t.model_id::text) like ''%hof%'' or lower(t.model_id::text) like ''%harmon%'') and (lower(u.nome_modelo) like ''%hof%'' or lower(u.nome_modelo) like ''%harmon%'')) '
        || '        or (lower(t.model_id::text) like ''%diag%'' and lower(u.nome_modelo) like ''%diag%'') '
        || '     order by case when u.id::text = btrim(t.model_id::text) then 0 else 1 end, u.id '
        || '     limit 1'
        || '   ) um on true '
        || '   join lateral ('
        || '     select i.id '
        || '     from public.inventory_template i '
        || '     where i.id::text = btrim(t.inventory_id::text) '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_001'' and lower(i.nome) like ''%luva%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_002'' and (lower(i.nome) like ''%mascara%'' or lower(i.nome) like ''%máscara%'')) '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_003'' and lower(i.nome) like ''%touca%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_004'' and lower(i.nome) like ''%gaze%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_005'' and lower(i.nome) like ''%alcool%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_006'' and lower(i.nome) like ''%anestes%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_007'' and lower(i.nome) like ''%algod%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_008'' and lower(i.nome) like ''%sugador%'') '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_009'' and (lower(i.nome) like ''%babador%'' or lower(i.nome) like ''%guardanapo%'')) '
        || '        or (lower(t.inventory_id::text) = ''tpl_inv_010'' and lower(i.nome) like ''%grau%'') '
        || '     order by case when i.id::text = btrim(t.inventory_id::text) then 0 else 1 end, i.id '
        || '     limit 1'
        || '   ) iv on true '
        || ' ) fix '
        || ' where fix.row_id = mi.id::text '
        || '   and (mi.model_id::text <> fix.new_model_id or mi.inventory_id::text <> fix.new_inventory_id)';
  execute v_sql;

  delete from public.model_items_template a
  using public.model_items_template b
  where a.id::text > b.id::text
    and a.model_id::text = b.model_id::text
    and a.inventory_id::text = b.inventory_id::text;

  delete from public.model_items_template a
  using public.model_items_template b, public.inventory_template ia, public.inventory_template ib
  where a.id::text > b.id::text
    and a.model_id::text = b.model_id::text
    and ia.id::text = a.inventory_id::text
    and ib.id::text = b.inventory_id::text
    and upper(translate(regexp_replace(btrim(ia.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
        = upper(translate(regexp_replace(btrim(ib.nome), '[^[:alnum:]]+', '', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'));

  delete from public.model_items_template t
  where not exists (select 1 from public.usage_models_template u where u.id::text = t.model_id::text)
     or not exists (select 1 from public.inventory_template i where i.id::text = t.inventory_id::text);

  select id::text into v_emp_clinica1
  from public.empresas
  where lower(btrim(nome)) = lower('Clinica 1')
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp_clinica1 is not null then
    perform public.rpc_import_default_templates(v_emp_clinica1);

    select count(*) into v_expected
    from (
      select distinct model_id::text, inventory_id::text
      from public.model_items_template
    ) x;

    select count(*) into v_actual
    from public.model_items mi
    join public.usage_models um on um.id::text = mi.model_id::text
    where um.empresa_id::text = v_emp_clinica1;

    if v_actual <> v_expected then
      raise exception 'Falha na sincronização pós-curadoria (Clinica 1): esperado %, obtido %', v_expected, v_actual;
    end if;
  end if;

  select id::text into v_emp_clinica1
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) = lower(translate('Dentistas Piraquá', 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'))
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp_clinica1 is not null then
    perform public.rpc_import_default_templates(v_emp_clinica1);
  end if;
end
$$;

notify pgrst, 'reload schema';
