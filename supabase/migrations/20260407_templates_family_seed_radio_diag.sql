create extension if not exists pgcrypto;

do $$
declare
  v_um_id_is_uuid boolean := false;
  v_inv_id_is_uuid boolean := false;
  v_mi_id_is_uuid boolean := false;
  v_mi_id_has_default boolean := false;
  v_mi_model_is_uuid boolean := false;
  v_mi_inv_is_uuid boolean := false;

  v_radio_id text;
  v_diag_id text;

  v_filme_id text;
  v_espelho_id text;
  v_pinca_id text;
  v_sonda_id text;

  v_sql text;
begin
  if to_regclass('public.usage_models_template') is null
     or to_regclass('public.model_items_template') is null
     or to_regclass('public.inventory_template') is null then
    raise exception 'Tabelas de template ausentes para seed de kits.';
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

  select id::text into v_radio_id
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Radiologia')
  order by created_at asc
  limit 1;

  if v_radio_id is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Radiologia', true)
      returning id::text into v_radio_id;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Radiologia', true)
      returning id::text into v_radio_id;
    end if;
  end if;

  select id::text into v_diag_id
  from public.usage_models_template
  where upper(btrim(nome_modelo)) = upper('Kit Diagnóstico')
  order by created_at asc
  limit 1;

  if v_diag_id is null then
    if v_um_id_is_uuid then
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid(), 'Kit Diagnóstico', true)
      returning id::text into v_diag_id;
    else
      insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
      values (gen_random_uuid()::text, 'Kit Diagnóstico', true)
      returning id::text into v_diag_id;
    end if;
  end if;

  select id::text into v_filme_id
  from public.inventory_template
  where lower(nome) like '%filme%'
  order by length(nome)
  limit 1;
  if v_filme_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'FILME RADIOGRAFIA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Raio-X', 'Raio-X', true, true
    ) returning id::text into v_filme_id;
  end if;

  select id::text into v_espelho_id
  from public.inventory_template
  where lower(nome) like '%espelho%' and lower(nome) not like '%autoclav%'
  order by length(nome)
  limit 1;
  if v_espelho_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'ESPELHO CLÍNICO (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true
    ) returning id::text into v_espelho_id;
  end if;

  select id::text into v_pinca_id
  from public.inventory_template
  where lower(nome) like '%pinça%' or lower(nome) like '%pinca%'
  order by length(nome)
  limit 1;
  if v_pinca_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'PINÇA CLÍNICA (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true
    ) returning id::text into v_pinca_id;
  end if;

  select id::text into v_sonda_id
  from public.inventory_template
  where lower(nome) like '%sonda%' or lower(nome) like '%explor%'
  order by length(nome)
  limit 1;
  if v_sonda_id is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      case when v_inv_id_is_uuid then gen_random_uuid() else gen_random_uuid()::text end,
      'SONDA EXPLORADORA (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true
    ) returning id::text into v_sonda_id;
  end if;

  if v_mi_id_has_default then
    v_sql := format(
      'insert into public.model_items_template(model_id, inventory_id, quantidade_sugerida)
       select %s, %s, 1
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
       select %s, %s, %s, 1
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

  execute v_sql using v_radio_id, v_filme_id;
  execute v_sql using v_diag_id, v_espelho_id;
  execute v_sql using v_diag_id, v_pinca_id;
  execute v_sql using v_diag_id, v_sonda_id;
end $$;

notify pgrst, 'reload schema';
