create extension if not exists pgcrypto;

do $$
declare
  r record;
  v_old_model_id text;
  v_new_model_id text;
  v_include boolean;
  v_serv_rx text;
  v_serv_rest text;
  v_inv_filme text;
  v_inv_resina text;
  v_inv_acido text;
begin
  if to_regclass('public.servicos_template') is null
     or to_regclass('public.usage_models_template') is null
     or to_regclass('public.model_items_template') is null
     or to_regclass('public.service_mapping_template') is null
     or to_regclass('public.inventory_template') is null then
    raise exception 'Tabelas de template ausentes para padronização de modelos por serviço.';
  end if;

  select id::text into v_serv_rx
  from public.servicos_template
  where lower(descricao) like '%radiograf%'
     or lower(descricao) like '%raio%'
  order by descricao asc
  limit 1;

  select id::text into v_serv_rest
  from public.servicos_template
  where lower(descricao) like '%restaur%'
  order by descricao asc
  limit 1;

  select id::text into v_inv_filme
  from public.inventory_template
  where lower(nome) like '%filme%'
  order by length(nome)
  limit 1;
  if v_inv_filme is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      gen_random_uuid()::text, 'FILME RADIOGRAFIA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Raio-X', 'Raio-X', true, true
    ) returning id::text into v_inv_filme;
  end if;

  select id::text into v_inv_resina
  from public.inventory_template
  where lower(nome) like '%resina%'
  order by length(nome)
  limit 1;
  if v_inv_resina is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      gen_random_uuid()::text, 'RESINA COMPOSTA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Dentística', 'Restauração', true, true
    ) returning id::text into v_inv_resina;
  end if;

  select id::text into v_inv_acido
  from public.inventory_template
  where lower(nome) like '%ácido%' or lower(nome) like '%acido%'
  order by length(nome)
  limit 1;
  if v_inv_acido is null then
    insert into public.inventory_template(
      id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo
    ) values (
      gen_random_uuid()::text, 'ÁCIDO CONDICIONANTE (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Dentística', 'Restauração', true, true
    ) returning id::text into v_inv_acido;
  end if;

  for r in
    select s.id::text as service_id, s.descricao
    from public.servicos_template s
    where s.descricao is not null and btrim(s.descricao) <> ''
    order by s.descricao
  loop
    select sm.model_id::text
      into v_old_model_id
    from public.service_mapping_template sm
    where sm.service_id::text = r.service_id
    order by sm.created_at asc
    limit 1;

    if v_old_model_id is null then
      continue;
    end if;

    select um.include_biosseguranca
      into v_include
    from public.usage_models_template um
    where um.id::text = v_old_model_id
    limit 1;
    if v_include is null then v_include := true; end if;

    v_new_model_id := 'tpl_mod_srv_' || r.service_id;

    insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
    values (
      v_new_model_id,
      left('Kit ' || btrim(r.descricao), 200),
      v_include
    )
    on conflict (id) do update
      set nome_modelo = excluded.nome_modelo,
          include_biosseguranca = excluded.include_biosseguranca;

    delete from public.model_items_template where model_id::text = v_new_model_id;
    insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
    select gen_random_uuid()::text, v_new_model_id, mi.inventory_id::text, mi.quantidade_sugerida
    from public.model_items_template mi
    where mi.model_id::text = v_old_model_id;

    delete from public.service_mapping_template where service_id::text = r.service_id;
    insert into public.service_mapping_template(service_id, model_id)
    values (r.service_id, v_new_model_id)
    on conflict (service_id, model_id) do nothing;
  end loop;

  if v_serv_rx is not null then
    v_new_model_id := 'tpl_mod_srv_' || v_serv_rx;
    update public.model_items_template
       set quantidade_sugerida = 1
     where model_id::text = v_new_model_id
       and inventory_id::text = v_inv_filme;
    if not found then
      insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
      values (gen_random_uuid()::text, v_new_model_id, v_inv_filme, 1);
    end if;
  end if;

  if v_serv_rest is not null then
    v_new_model_id := 'tpl_mod_srv_' || v_serv_rest;
    update public.model_items_template
       set quantidade_sugerida = 1
     where model_id::text = v_new_model_id
       and inventory_id::text = v_inv_resina;
    if not found then
      insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
      values (gen_random_uuid()::text, v_new_model_id, v_inv_resina, 1);
    end if;

    update public.model_items_template
       set quantidade_sugerida = 1
     where model_id::text = v_new_model_id
       and inventory_id::text = v_inv_acido;
    if not found then
      insert into public.model_items_template(id, model_id, inventory_id, quantidade_sugerida)
      values (gen_random_uuid()::text, v_new_model_id, v_inv_acido, 1);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
