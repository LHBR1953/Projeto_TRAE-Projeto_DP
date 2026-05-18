create extension if not exists pgcrypto;

do $$
declare
  v_um_id_is_uuid boolean := false;
  v_mi_id_is_uuid boolean := false;
  v_mi_id_has_default boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;

  v_biosseg text;
  v_dent text;
  v_endo text;
  v_exo text;
  v_perio text;
  v_radio text;
  v_prot text;
  v_orto text;
  v_impl text;
  v_hof text;
  v_diag text;
  v_sql text;
  v_inv_id_is_uuid boolean := false;
  v_inv_id text;
  v_inv_id_expr text;
begin
  if to_regclass('public.servicos_template') is null
     or to_regclass('public.usage_models_template') is null
     or to_regclass('public.model_items_template') is null
     or to_regclass('public.service_mapping_template') is null then
    raise exception 'Tabelas de template ausentes para consolidação de famílias.';
  end if;

  select (udt_name = 'uuid')
    into v_um_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='usage_models_template' and column_name='id';
  select (udt_name = 'uuid'), (column_default is not null and lower(btrim(column_default)) not like 'null%')
    into v_mi_id_is_uuid, v_mi_id_has_default
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='id';
  select (udt_name = 'uuid')
    into v_mi_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='model_id';
  select (udt_name = 'uuid')
    into v_mi_inv_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='inventory_id';
  select (udt_name = 'uuid')
    into v_inv_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='inventory_template' and column_name='id';
  v_inv_id_expr := case when v_inv_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end;

  select id::text into v_biosseg
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Biossegurança')
  order by created_at asc
  limit 1;
  if v_biosseg is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Biossegurança', true)
      returning id::text into v_biosseg;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Biossegurança', true)
      returning id::text into v_biosseg;
    end if;
  end if;

  select id::text into v_dent
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Dentística')
  order by created_at asc
  limit 1;
  if v_dent is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Dentística', true)
      returning id::text into v_dent;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Dentística', true)
      returning id::text into v_dent;
    end if;
  end if;

  select id::text into v_endo
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Endodontia')
  order by created_at asc
  limit 1;
  if v_endo is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Endodontia', true)
      returning id::text into v_endo;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Endodontia', true)
      returning id::text into v_endo;
    end if;
  end if;

  select id::text into v_exo
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Exodontia')
  order by created_at asc
  limit 1;
  if v_exo is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Exodontia', true)
      returning id::text into v_exo;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Exodontia', true)
      returning id::text into v_exo;
    end if;
  end if;

  select id::text into v_perio
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Periodontia')
  order by created_at asc
  limit 1;
  if v_perio is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Periodontia', true)
      returning id::text into v_perio;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Periodontia', true)
      returning id::text into v_perio;
    end if;
  end if;

  select id::text into v_radio
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Radiologia')
  order by created_at asc
  limit 1;
  if v_radio is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Radiologia', true)
      returning id::text into v_radio;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Radiologia', true)
      returning id::text into v_radio;
    end if;
  end if;

  select id::text into v_prot
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Prótese')
  order by created_at asc
  limit 1;
  if v_prot is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Prótese', true)
      returning id::text into v_prot;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Prótese', true)
      returning id::text into v_prot;
    end if;
  end if;

  select id::text into v_orto
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Ortodontia')
  order by created_at asc
  limit 1;
  if v_orto is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Ortodontia', true)
      returning id::text into v_orto;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Ortodontia', true)
      returning id::text into v_orto;
    end if;
  end if;

  select id::text into v_impl
  from public.usage_models_template
  where upper(btrim(nome_modelo)) in (upper('Kit Implantodontia'), upper('Kit Implante'))
  order by created_at asc
  limit 1;
  if v_impl is not null then
    update public.usage_models_template
    set nome_modelo = 'Kit Implantodontia'
    where id::text = v_impl
      and upper(btrim(nome_modelo)) <> upper('Kit Implantodontia');
  end if;
  if v_impl is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Implantodontia', true)
      returning id::text into v_impl;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Implantodontia', true)
      returning id::text into v_impl;
    end if;
  end if;

  select id::text into v_hof
  from public.usage_models_template
  where upper(btrim(nome_modelo)) in (upper('Kit Harmonização Facial'), upper('Kit HOF'))
  order by created_at asc
  limit 1;
  if v_hof is not null then
    update public.usage_models_template
    set nome_modelo = 'Kit Harmonização Facial'
    where id::text = v_hof
      and upper(btrim(nome_modelo)) <> upper('Kit Harmonização Facial');
  end if;
  if v_hof is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Harmonização Facial', true)
      returning id::text into v_hof;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Harmonização Facial', true)
      returning id::text into v_hof;
    end if;
  end if;

  select id::text into v_diag
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Diagnóstico')
  order by created_at asc
  limit 1;
  if v_diag is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Diagnóstico', true)
      returning id::text into v_diag;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Diagnóstico', true)
      returning id::text into v_diag;
    end if;
  end if;

  create temporary table tmp_old_map(service_id text, old_model_id text) on commit drop;
  insert into tmp_old_map(service_id, old_model_id)
  select service_id::text, model_id::text
  from public.service_mapping_template;

  create temporary table tmp_family_service(service_id text primary key, family_model_id text not null, old_model_id text) on commit drop;
  insert into tmp_family_service(service_id, family_model_id, old_model_id)
  select
    s.id::text as service_id,
    case
      when lower(coalesce(s.descricao,'')) like '%radiograf%' or lower(coalesce(s.descricao,'')) like '%raio%' or lower(coalesce(s.subdivisao,'')) like '%imagem%' then v_radio
      when lower(coalesce(s.descricao,'')) like '%implan%' or lower(coalesce(s.subdivisao,'')) like '%implan%' then v_impl
      when lower(coalesce(s.descricao,'')) like '%orto%' or lower(coalesce(s.subdivisao,'')) like '%orto%' then v_orto
      when lower(coalesce(s.descricao,'')) like '%prót%' or lower(coalesce(s.descricao,'')) like '%prot%' or lower(coalesce(s.subdivisao,'')) like '%prót%' or lower(coalesce(s.subdivisao,'')) like '%prot%' then v_prot
      when lower(coalesce(s.descricao,'')) like '%endo%' or lower(coalesce(s.descricao,'')) like '%canal%' or lower(coalesce(s.subdivisao,'')) like '%endo%' then v_endo
      when lower(coalesce(s.descricao,'')) like '%perio%' or lower(coalesce(s.descricao,'')) like '%rasp%' or lower(coalesce(s.subdivisao,'')) like '%perio%' then v_perio
      when lower(coalesce(s.descricao,'')) like '%exodont%' or lower(coalesce(s.descricao,'')) like '%extra%' or lower(coalesce(s.subdivisao,'')) like '%cirurg%' then v_exo
      when lower(coalesce(s.descricao,'')) like '%hof%' or lower(coalesce(s.descricao,'')) like '%harmon%' or lower(coalesce(s.descricao,'')) like '%botox%' or lower(coalesce(s.descricao,'')) like '%preench%' then v_hof
      when lower(coalesce(s.descricao,'')) like '%avalia%' or lower(coalesce(s.descricao,'')) like '%consulta%' or lower(coalesce(s.subdivisao,'')) like '%avalia%' then v_diag
      else v_dent
    end as family_model_id,
    om.old_model_id
  from public.servicos_template s
  left join tmp_old_map om on om.service_id = s.id::text;

  delete from public.model_items_template
  where model_id::text in (v_biosseg, v_dent, v_endo, v_exo, v_perio, v_radio, v_prot, v_orto, v_impl, v_hof, v_diag);

  if v_mi_id_has_default then
    v_sql := format(
      'insert into public.model_items_template(model_id, inventory_id, quantidade_sugerida)
       select %s, %s, max(mi.quantidade_sugerida)
       from tmp_family_service fs
       join public.model_items_template mi on mi.model_id::text = fs.old_model_id
       where fs.old_model_id is not null
       group by %s, %s',
      case when v_mi_model_is_uuid then 'fs.family_model_id::uuid' else 'fs.family_model_id::text' end,
      case when v_mi_inv_is_uuid then 'mi.inventory_id' else 'mi.inventory_id::text' end,
      case when v_mi_model_is_uuid then 'fs.family_model_id::uuid' else 'fs.family_model_id::text' end,
      case when v_mi_inv_is_uuid then 'mi.inventory_id' else 'mi.inventory_id::text' end
    );
    execute v_sql;
  else
    v_sql := format(
      'insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
       select %s, %s, %s, max(mi.quantidade_sugerida)
       from tmp_family_service fs
       join public.model_items_template mi on mi.model_id::text = fs.old_model_id
       where fs.old_model_id is not null
       group by %s, %s',
      case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end,
      case when v_mi_model_is_uuid then 'fs.family_model_id::uuid' else 'fs.family_model_id::text' end,
      case when v_mi_inv_is_uuid then 'mi.inventory_id' else 'mi.inventory_id::text' end,
      case when v_mi_model_is_uuid then 'fs.family_model_id::uuid' else 'fs.family_model_id::text' end,
      case when v_mi_inv_is_uuid then 'mi.inventory_id' else 'mi.inventory_id::text' end
    );
    execute v_sql;
  end if;

  delete from public.service_mapping_template;
  insert into public.service_mapping_template(service_id, model_id)
  select fs.service_id, fs.family_model_id
  from tmp_family_service fs
  on conflict (service_id, model_id) do nothing;

  delete from public.model_items_template
  where model_id::text not in (v_biosseg, v_dent, v_endo, v_exo, v_perio, v_radio, v_prot, v_orto, v_impl, v_hof, v_diag);

  if not exists (select 1 from public.model_items_template where model_id::text = v_dent) then
    select id::text into v_inv_id from public.inventory_template where lower(nome) like '%resina%' order by length(nome) limit 1;
    if v_inv_id is null then
      v_sql := format(
        'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
         values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
         returning id::text',
        v_inv_id_expr,
        'INSUMO DENTÍSTICA (UN)', 'un', 'un',
        'consumiveis', 'Dentística', 'Dentística'
      );
      execute v_sql into v_inv_id;
    end if;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) select %s, %s, 1',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end) else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end) end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_dent, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_endo) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO ENDODONTIA (UN)', 'un', 'un',
      'consumiveis', 'Endodontia', 'Endodontia'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_endo, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_exo) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO EXODONTIA (UN)', 'un', 'un',
      'consumiveis', 'Exodontia', 'Exodontia'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_exo, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_perio) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO PERIODONTIA (UN)', 'un', 'un',
      'consumiveis', 'Periodontia', 'Periodontia'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_perio, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_prot) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO PRÓTESE (UN)', 'un', 'un',
      'consumiveis', 'Prótese', 'Prótese'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_prot, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_orto) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO ORTODONTIA (UN)', 'un', 'un',
      'consumiveis', 'Ortodontia', 'Ortodontia'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_orto, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_impl) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO IMPLANTE (UN)', 'un', 'un',
      'consumiveis', 'Implante', 'Implante'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_impl, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_hof) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'INSUMO HOF (UN)', 'un', 'un',
      'consumiveis', 'HOF', 'HOF'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_hof, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_radio) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, true, true)
       returning id::text',
      v_inv_id_expr,
      'FILME RADIOGRAFIA (UN)', 'un', 'un',
      'consumiveis', 'Raio-X', 'Raio-X'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_radio, v_inv_id;
  end if;

  if not exists (select 1 from public.model_items_template where model_id::text = v_diag) then
    v_sql := format(
      'insert into public.inventory_template(id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
       values (%s, %L, %L, %L, 1, 0, 0, %L, %L, %L, false, true)
       returning id::text',
      v_inv_id_expr,
      'KIT EXAME CLÍNICO (UN)', 'un', 'un',
      'instrumentais', 'Diagnóstico', 'Diagnóstico'
    );
    execute v_sql into v_inv_id;
    execute format(
      'insert into public.model_items_template(%smodel_id, inventory_id, quantidade_sugerida) ' ||
      'select %s, %s, 1 ' ||
      'where not exists (select 1 from public.model_items_template mi where mi.model_id::text = $1 and mi.inventory_id::text = $2)',
      case when v_mi_id_has_default then '' else 'id, ' end,
      case when v_mi_id_has_default
        then (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
        else (case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || (case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end)
      end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    ) using v_diag, v_inv_id;
  end if;

  delete from public.usage_models_template
  where id::text not in (v_biosseg, v_dent, v_endo, v_exo, v_perio, v_radio, v_prot, v_orto, v_impl, v_hof, v_diag);
end $$;

notify pgrst, 'reload schema';
