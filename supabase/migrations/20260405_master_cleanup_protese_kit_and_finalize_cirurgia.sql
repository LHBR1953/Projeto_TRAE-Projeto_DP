create extension if not exists pgcrypto;

do $$
declare
  v_emp text := 'emp_a279673a1b';
  v_kit_protese_id uuid;
  v_kit_cirurgia_id uuid;
  v_um_has_include_biosseg boolean := false;
  v_emp_models_is_uuid boolean := false;
  v_emp_inv_is_uuid boolean := false;
  v_emp_expr_models text;
  v_emp_expr_inv text;
  v_inv_has_tipo boolean := false;
  v_inv_has_area boolean := false;
  v_inv_has_cat boolean := false;
begin
  if not exists (select 1 from public.empresas where id::text = v_emp) then
    raise exception 'Empresa mestre % não encontrada em empresas.', v_emp;
  end if;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='usage_models' and column_name='include_biosseguranca')
    into v_um_has_include_biosseg;
  select (c.udt_name = 'uuid')
    into v_emp_models_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'empresa_id';
  select (c.udt_name = 'uuid')
    into v_emp_inv_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'empresa_id';
  v_emp_expr_models := case when v_emp_models_is_uuid then '$1::uuid' else '$1' end;
  v_emp_expr_inv := case when v_emp_inv_is_uuid then '$1::uuid' else '$1' end;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='tipo_inventario')
    into v_inv_has_tipo;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='area')
    into v_inv_has_area;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='categoria')
    into v_inv_has_cat;

  select id
    into v_kit_protese_id
  from public.usage_models
  where empresa_id::text = v_emp
    and lower(btrim(nome_modelo)) = lower('Kit Prótese Dentária')
  limit 1;

  if v_kit_protese_id is not null then
    if to_regclass('public.service_mapping') is not null then
      delete from public.service_mapping where model_id = v_kit_protese_id;
    end if;
    delete from public.model_items where model_id = v_kit_protese_id;
    delete from public.usage_models where id = v_kit_protese_id;
  end if;

  if v_inv_has_tipo then
    update public.inventory
       set tipo_inventario = 'Consumo'
     where empresa_id::text = v_emp
       and (tipo_inventario is null or btrim(tipo_inventario) = '');
  end if;

  select id
    into v_kit_cirurgia_id
  from public.usage_models
  where empresa_id::text = v_emp
    and lower(btrim(nome_modelo)) = lower('Kit Cirurgia Bucomaxilofacial')
  limit 1;

  if v_kit_cirurgia_id is null then
    if v_um_has_include_biosseg then
      execute
        'insert into public.usage_models(empresa_id, nome_modelo, include_biosseguranca) '
        || 'values (' || v_emp_expr_models || ', ''Kit Cirurgia Bucomaxilofacial'', true) '
        || 'returning id'
      into v_kit_cirurgia_id
      using v_emp;
    else
      execute
        'insert into public.usage_models(empresa_id, nome_modelo) '
        || 'values (' || v_emp_expr_models || ', ''Kit Cirurgia Bucomaxilofacial'') '
        || 'returning id'
      into v_kit_cirurgia_id
      using v_emp;
    end if;
  end if;

  execute
    'insert into public.inventory(empresa_id, nome, unidade, estoque_atual, estoque_minimo) '
    || 'select ' || v_emp_expr_inv || ', x.nome, x.unidade, 0, 0 '
    || 'from (values '
    || '(''Anestésico Articaína 4% (cx 50)'', ''cx''),'
    || '(''Anestésico Mepivacaína 2% (cx 50)'', ''cx''),'
    || '(''Agulha Curta (cx 100)'', ''cx''),'
    || '(''Agulha Longa (cx 100)'', ''cx''),'
    || '(''Lâmina de Bisturi 15 (cx 100)'', ''cx''),'
    || '(''Lâmina de Bisturi 15C (cx 100)'', ''cx''),'
    || '(''Lâmina de Bisturi 12 (cx 100)'', ''cx''),'
    || '(''Cabo de Bisturi Nº3 (un)'', ''un''),'
    || '(''Sutura Nylon 4-0 (un)'', ''un''),'
    || '(''Sutura Seda 4-0 (un)'', ''un''),'
    || '(''Hemostático (esponja gelatinosa) (un)'', ''un''),'
    || '(''Campo Estéril (un)'', ''un''),'
    || '(''Gaze Estéril (pct 10)'', ''pct'')'
    || ') as x(nome, unidade) '
    || 'where not exists ('
    || '  select 1 from public.inventory i '
    || '  where i.empresa_id::text = $1 '
    || '    and lower(btrim(i.nome)) = lower(btrim(x.nome))'
    || ')'
  using v_emp;

  if v_inv_has_tipo then
    update public.inventory
       set tipo_inventario = 'Cirurgia'
     where empresa_id::text = v_emp
       and lower(btrim(nome)) in (
         lower('Anestésico Articaína 4% (cx 50)'),
         lower('Anestésico Mepivacaína 2% (cx 50)'),
         lower('Agulha Curta (cx 100)'),
         lower('Agulha Longa (cx 100)'),
         lower('Lâmina de Bisturi 15 (cx 100)'),
         lower('Lâmina de Bisturi 15C (cx 100)'),
         lower('Lâmina de Bisturi 12 (cx 100)'),
         lower('Cabo de Bisturi Nº3 (un)'),
         lower('Sutura Nylon 4-0 (un)'),
         lower('Sutura Seda 4-0 (un)'),
         lower('Hemostático (esponja gelatinosa) (un)'),
         lower('Campo Estéril (un)'),
         lower('Gaze Estéril (pct 10)')
       );
  end if;
  if v_inv_has_area then
    update public.inventory
       set area = 'Cirurgia'
     where empresa_id::text = v_emp
       and lower(btrim(nome)) in (
         lower('Anestésico Articaína 4% (cx 50)'),
         lower('Anestésico Mepivacaína 2% (cx 50)'),
         lower('Agulha Curta (cx 100)'),
         lower('Agulha Longa (cx 100)'),
         lower('Lâmina de Bisturi 15 (cx 100)'),
         lower('Lâmina de Bisturi 15C (cx 100)'),
         lower('Lâmina de Bisturi 12 (cx 100)'),
         lower('Cabo de Bisturi Nº3 (un)'),
         lower('Sutura Nylon 4-0 (un)'),
         lower('Sutura Seda 4-0 (un)'),
         lower('Hemostático (esponja gelatinosa) (un)'),
         lower('Campo Estéril (un)'),
         lower('Gaze Estéril (pct 10)')
       );
  end if;
  if v_inv_has_cat then
    update public.inventory
       set categoria = 'Cirurgia Bucomaxilofacial'
     where empresa_id::text = v_emp
       and lower(btrim(nome)) in (
         lower('Anestésico Articaína 4% (cx 50)'),
         lower('Anestésico Mepivacaína 2% (cx 50)'),
         lower('Agulha Curta (cx 100)'),
         lower('Agulha Longa (cx 100)'),
         lower('Lâmina de Bisturi 15 (cx 100)'),
         lower('Lâmina de Bisturi 15C (cx 100)'),
         lower('Lâmina de Bisturi 12 (cx 100)'),
         lower('Cabo de Bisturi Nº3 (un)'),
         lower('Sutura Nylon 4-0 (un)'),
         lower('Sutura Seda 4-0 (un)'),
         lower('Hemostático (esponja gelatinosa) (un)'),
         lower('Campo Estéril (un)'),
         lower('Gaze Estéril (pct 10)')
       );
  end if;

  delete from public.model_items
  where model_id = v_kit_cirurgia_id
    and inventory_id in (
      select id
      from public.inventory i
      where i.empresa_id::text = v_emp
        and lower(btrim(i.nome)) in (
          lower('Anestésico Articaína 4% (cx 50)'),
          lower('Anestésico Mepivacaína 2% (cx 50)'),
          lower('Agulha Curta (cx 100)'),
          lower('Agulha Longa (cx 100)'),
          lower('Lâmina de Bisturi 15 (cx 100)'),
          lower('Lâmina de Bisturi 15C (cx 100)'),
          lower('Lâmina de Bisturi 12 (cx 100)'),
          lower('Cabo de Bisturi Nº3 (un)'),
          lower('Sutura Nylon 4-0 (un)'),
          lower('Sutura Seda 4-0 (un)'),
          lower('Hemostático (esponja gelatinosa) (un)'),
          lower('Campo Estéril (un)'),
          lower('Gaze Estéril (pct 10)')
        )
    );

  insert into public.model_items(model_id, inventory_id, quantidade_sugerida)
  select v_kit_cirurgia_id, i.id, x.qtd
  from public.inventory i
  join (values
    ('Anestésico Articaína 4% (cx 50)', 1::numeric),
    ('Anestésico Mepivacaína 2% (cx 50)', 1::numeric),
    ('Agulha Curta (cx 100)', 1::numeric),
    ('Agulha Longa (cx 100)', 1::numeric),
    ('Lâmina de Bisturi 15 (cx 100)', 1::numeric),
    ('Lâmina de Bisturi 15C (cx 100)', 1::numeric),
    ('Lâmina de Bisturi 12 (cx 100)', 1::numeric),
    ('Sutura Nylon 4-0 (un)', 1::numeric),
    ('Sutura Seda 4-0 (un)', 1::numeric),
    ('Hemostático (esponja gelatinosa) (un)', 1::numeric),
    ('Campo Estéril (un)', 1::numeric),
    ('Gaze Estéril (pct 10)', 2::numeric)
  ) as x(nome, qtd)
    on lower(btrim(x.nome)) = lower(btrim(i.nome))
  where i.empresa_id::text = v_emp
    and not exists (
      select 1 from public.model_items mi
      where mi.model_id = v_kit_cirurgia_id
        and mi.inventory_id = i.id
    );
end $$;

notify pgrst, 'reload schema';
