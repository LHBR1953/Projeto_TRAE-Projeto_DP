create extension if not exists pgcrypto;

do $$
declare
  v_model_id text;
  v_luva_id text;
  v_mascara_id text;
  v_sugador_id text;
  v_touca_id text;
  v_babador_id text;
  v_um_id_is_uuid boolean := false;
  v_inv_id_is_uuid boolean := false;
  v_mi_id_is_uuid boolean := false;
  v_mi_id_has_default boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;
  v_sql text;
begin
  if to_regclass('public.usage_models_template') is null or to_regclass('public.model_items_template') is null or to_regclass('public.inventory_template') is null then
    raise exception 'Tabelas de template ausentes para preencher Kit Biossegurança.';
  end if;

  select (udt_name = 'uuid')
    into v_um_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='usage_models_template' and column_name='id';
  select (udt_name = 'uuid')
    into v_inv_id_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='inventory_template' and column_name='id';
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

  select id::text
    into v_model_id
  from public.usage_models_template
  where lower(btrim(nome_modelo)) like '%biossegur%'
  order by case when lower(btrim(nome_modelo)) = lower('kit biossegurança') then 0 else 1 end
  limit 1;

  if v_model_id is null then
    insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
    values (case when v_um_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end, 'Kit Biossegurança', true)
    returning id::text into v_model_id;
  end if;

  select id::text into v_luva_id
  from public.inventory_template
  where lower(nome) like '%luva%'
  order by
    case when lower(nome) like '%estéril%' or lower(nome) like '%esteril%' then 0 else 1 end,
    case when lower(nome) like '%par%' then 0 else 1 end,
    length(nome)
  limit 1;

  select id::text into v_mascara_id
  from public.inventory_template
  where lower(nome) like '%máscara%' or lower(nome) like '%mascara%'
  order by length(nome)
  limit 1;

  select id::text into v_sugador_id
  from public.inventory_template
  where lower(nome) like '%sugador%'
  order by length(nome)
  limit 1;

  select id::text into v_touca_id
  from public.inventory_template
  where lower(nome) like '%touca%'
  order by length(nome)
  limit 1;

  select id::text into v_babador_id
  from public.inventory_template
  where lower(nome) like '%babador%' or lower(nome) like '%guardanapo%'
  order by length(nome)
  limit 1;

  if v_luva_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'LUVA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Biossegurança', 'Biossegurança', true, true
    ) returning id::text into v_luva_id;
  end if;
  if v_mascara_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'MÁSCARA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Biossegurança', 'Biossegurança', true, true
    ) returning id::text into v_mascara_id;
  end if;
  if v_sugador_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'SUGADOR (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Biossegurança', 'Biossegurança', true, true
    ) returning id::text into v_sugador_id;
  end if;
  if v_touca_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'TOUCA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Biossegurança', 'Biossegurança', true, true
    ) returning id::text into v_touca_id;
  end if;
  if v_babador_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'BABADOR (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Biossegurança', 'Biossegurança', true, true
    ) returning id::text into v_babador_id;
  end if;

  if v_mi_id_has_default then
    v_sql := format(
      'insert into public.model_items_template(model_id, inventory_id, quantidade_sugerida)
       select %s, %s, $3
       where not exists (
         select 1 from public.model_items_template mi
         where mi.model_id::text = $1
           and mi.inventory_id::text = $2
       )',
      case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    );
  else
    v_sql := format(
      'insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
       select %s, %s, %s, $3
       where not exists (
         select 1 from public.model_items_template mi
         where mi.model_id::text = $1
           and mi.inventory_id::text = $2
       )',
      case when v_mi_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end,
      case when v_mi_model_is_uuid then '$1::uuid' else '$1::text' end,
      case when v_mi_inv_is_uuid then '$2::uuid' else '$2::text' end
    );
  end if;

  execute v_sql using v_model_id, v_luva_id, 2;
  execute v_sql using v_model_id, v_mascara_id, 1;
  execute v_sql using v_model_id, v_sugador_id, 1;
  execute v_sql using v_model_id, v_touca_id, 1;
  execute v_sql using v_model_id, v_babador_id, 1;
end $$;

notify pgrst, 'reload schema';
