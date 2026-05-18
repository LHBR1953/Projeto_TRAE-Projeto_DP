create extension if not exists pgcrypto;

alter table if exists public.inventory
  add column if not exists tipo_inventario text;

alter table if exists public.inventory
  add column if not exists area text;

alter table if exists public.inventory
  add column if not exists categoria text;

do $$
declare
  v_emp text := 'emp_a279673a1b';
  v_service_tbl text;
  v_emp_inv_is_uuid boolean := false;
  v_emp_models_is_uuid boolean := false;
  v_emp_serv_is_uuid boolean := false;
  v_models_id_is_uuid boolean := true;
  v_serv_id_is_uuid boolean := true;
  v_emp_expr_inv text;
  v_emp_expr_models text;
  v_emp_expr_serv text;
  v_kit_id uuid;
  v_max_seq int := 0;
  v_cnt int := 0;
  v_inv_cols text;
  v_inv_sel text;
  v_inv_has_unidade_medida boolean := false;
  v_inv_has_fator_conversao boolean := false;
  v_inv_has_preco_custo boolean := false;
  v_inv_has_estoque_atual boolean := false;
  v_inv_has_estoque_minimo boolean := false;
  v_inv_has_saldo_atual boolean := false;
  v_inv_has_eh_consumivel boolean := false;
  v_inv_has_ativo boolean := false;
  v_inv_has_tipo_inventario boolean := false;
  v_inv_has_area boolean := false;
  v_inv_has_categoria boolean := false;
  v_mi_has_emp boolean := false;
  v_mi_emp_is_uuid boolean := false;
  v_sm_has_emp boolean := false;
  v_sm_emp_is_uuid boolean := false;
  v_um_has_include_biosseg boolean := false;
  v_srv_has_seqid boolean := false;
  v_srv_has_descricao boolean := false;
  v_srv_has_valor boolean := false;
  v_srv_has_ie boolean := false;
  v_srv_has_tipo_calculo boolean := false;
  v_srv_has_exige_elemento boolean := false;
  v_srv_has_subdivisao boolean := false;
  v_srv_has_origem boolean := false;
  v_srv_cols text;
  v_srv_sel text;
begin
  if not exists (select 1 from public.empresas where id::text = v_emp) then
    raise exception 'Empresa mestre % não encontrada em empresas.', v_emp;
  end if;

  v_service_tbl := case
    when to_regclass('public.servicos') is not null then 'servicos'
    when to_regclass('public.services') is not null then 'services'
    else null
  end;
  if v_service_tbl is null then
    raise exception 'Tabela de serviços não encontrada (servicos/services).';
  end if;

  select (c.udt_name = 'uuid')
    into v_emp_inv_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'empresa_id';

  select (c.udt_name = 'uuid')
    into v_emp_models_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'empresa_id';

  select (c.udt_name = 'uuid')
    into v_models_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'id';

  select (c.udt_name = 'uuid')
    into v_emp_serv_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_service_tbl and c.column_name = 'empresa_id';

  select (c.udt_name = 'uuid')
    into v_serv_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_service_tbl and c.column_name = 'id';

  v_emp_expr_inv := case when v_emp_inv_is_uuid then '$1::uuid' else '$1' end;
  v_emp_expr_models := case when v_emp_models_is_uuid then '$1::uuid' else '$1' end;
  v_emp_expr_serv := case when v_emp_serv_is_uuid then '$1::uuid' else '$1' end;

  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='unidade_medida') into v_inv_has_unidade_medida;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='fator_conversao') into v_inv_has_fator_conversao;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='preco_custo') into v_inv_has_preco_custo;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='estoque_atual') into v_inv_has_estoque_atual;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='estoque_minimo') into v_inv_has_estoque_minimo;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='saldo_atual') into v_inv_has_saldo_atual;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='eh_consumivel') into v_inv_has_eh_consumivel;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='ativo') into v_inv_has_ativo;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='tipo_inventario') into v_inv_has_tipo_inventario;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='area') into v_inv_has_area;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='inventory' and column_name='categoria') into v_inv_has_categoria;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='model_items' and column_name='empresa_id') into v_mi_has_emp;
  select (c.udt_name = 'uuid')
    into v_mi_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'empresa_id';
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='service_mapping' and column_name='empresa_id') into v_sm_has_emp;
  select (c.udt_name = 'uuid')
    into v_sm_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'empresa_id';
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='usage_models' and column_name='include_biosseguranca') into v_um_has_include_biosseg;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='seqid') into v_srv_has_seqid;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='descricao') into v_srv_has_descricao;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='valor') into v_srv_has_valor;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='ie') into v_srv_has_ie;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='tipo_calculo') into v_srv_has_tipo_calculo;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='exige_elemento') into v_srv_has_exige_elemento;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='subdivisao') into v_srv_has_subdivisao;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_service_tbl and column_name='origem') into v_srv_has_origem;

  v_inv_cols := 'empresa_id, nome, unidade';
  v_inv_sel := v_emp_expr_inv || ', t.nome, t.unidade';
  if v_inv_has_unidade_medida then
    v_inv_cols := v_inv_cols || ', unidade_medida';
    v_inv_sel := v_inv_sel || ', t.unidade_medida';
  end if;
  if v_inv_has_fator_conversao then
    v_inv_cols := v_inv_cols || ', fator_conversao';
    v_inv_sel := v_inv_sel || ', t.fator_conversao';
  end if;
  if v_inv_has_preco_custo then
    v_inv_cols := v_inv_cols || ', preco_custo';
    v_inv_sel := v_inv_sel || ', null';
  end if;
  if v_inv_has_estoque_atual then
    v_inv_cols := v_inv_cols || ', estoque_atual';
    v_inv_sel := v_inv_sel || ', 0';
  end if;
  if v_inv_has_estoque_minimo then
    v_inv_cols := v_inv_cols || ', estoque_minimo';
    v_inv_sel := v_inv_sel || ', 0';
  end if;
  if v_inv_has_saldo_atual then
    v_inv_cols := v_inv_cols || ', saldo_atual';
    v_inv_sel := v_inv_sel || ', 0';
  end if;
  if v_inv_has_eh_consumivel then
    v_inv_cols := v_inv_cols || ', eh_consumivel';
    v_inv_sel := v_inv_sel || ', true';
  end if;
  if v_inv_has_ativo then
    v_inv_cols := v_inv_cols || ', ativo';
    v_inv_sel := v_inv_sel || ', true';
  end if;
  if v_inv_has_tipo_inventario then
    v_inv_cols := v_inv_cols || ', tipo_inventario';
    v_inv_sel := v_inv_sel || ', ''Cirurgia''';
  end if;
  if v_inv_has_area then
    v_inv_cols := v_inv_cols || ', area';
    v_inv_sel := v_inv_sel || ', ''Cirurgia''';
  end if;
  if v_inv_has_categoria then
    v_inv_cols := v_inv_cols || ', categoria';
    v_inv_sel := v_inv_sel || ', ''Cirurgia Bucomaxilofacial''';
  end if;

  execute
    'insert into public.inventory(' || v_inv_cols || ') '
    || 'select ' || v_inv_sel || ' '
    || 'from (values '
    || '(''Anestésico Lidocaína 2% c/ vasoconstritor (cx 50)'',''cx'',''un'',50),'
    || '(''Anestésico Articaína 4% (cx 50)'',''cx'',''un'',50),'
    || '(''Agulha Curta (cx 100)'',''cx'',''un'',100),'
    || '(''Agulha Longa (cx 100)'',''cx'',''un'',100),'
    || '(''Sutura Nylon 4-0 (un)'',''un'',''un'',1),'
    || '(''Sutura Vicryl 4-0 (un)'',''un'',''un'',1),'
    || '(''Lâmina de Bisturi 15 (cx 100)'',''cx'',''un'',100),'
    || '(''Cabo de Bisturi Nº3 (un)'',''un'',''un'',1),'
    || '(''Hemostático (esponja gelatinosa) (un)'',''un'',''un'',1),'
    || '(''Campo Estéril (un)'',''un'',''un'',1),'
    || '(''Gaze Estéril (pct 10)'',''pct'',''un'',10),'
    || '(''Soro Fisiológico 0,9% (frasco 500ml)'',''un'',''ml'',500),'
    || '(''Clorexidina 0,12% (frasco 300ml)'',''un'',''ml'',300)'
    || ') as t(nome, unidade, unidade_medida, fator_conversao) '
    || 'where not exists ('
    || '  select 1 from public.inventory i '
    || '  where i.empresa_id::text = $1 '
    || '    and lower(btrim(i.nome)) = lower(btrim(t.nome))'
    || ')'
  using v_emp;

  select id
    into v_kit_id
  from public.usage_models
  where empresa_id::text = v_emp
    and lower(btrim(nome_modelo)) = lower('Kit Cirurgia Bucomaxilofacial')
  limit 1;

  if v_kit_id is null then
    execute
      'insert into public.usage_models(id, empresa_id, nome_modelo'
      || (case when v_um_has_include_biosseg then ', include_biosseguranca' else '' end)
      || ') values ('
      || (case when v_models_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end)
      || ', ' || v_emp_expr_models || ', ''Kit Cirurgia Bucomaxilofacial'''
      || (case when v_um_has_include_biosseg then ', true' else '' end)
      || ') returning id'
    into v_kit_id
    using v_emp;
  end if;

  execute
    'delete from public.model_items mi '
    || 'where mi.model_id = $2 '
    || 'and exists ('
    || '  select 1 from public.inventory i '
    || '  where i.id = mi.inventory_id '
    || '    and i.empresa_id::text = $1 '
    || '    and lower(btrim(i.nome)) in ('
    || '      lower(''Anestésico Lidocaína 2% c/ vasoconstritor (cx 50)''),'
    || '      lower(''Anestésico Articaína 4% (cx 50)''),'
    || '      lower(''Agulha Curta (cx 100)''),'
    || '      lower(''Agulha Longa (cx 100)''),'
    || '      lower(''Sutura Nylon 4-0 (un)''),'
    || '      lower(''Sutura Vicryl 4-0 (un)''),'
    || '      lower(''Lâmina de Bisturi 15 (cx 100)''),'
    || '      lower(''Cabo de Bisturi Nº3 (un)''),'
    || '      lower(''Hemostático (esponja gelatinosa) (un)''),'
    || '      lower(''Campo Estéril (un)''),'
    || '      lower(''Gaze Estéril (pct 10)''),'
    || '      lower(''Soro Fisiológico 0,9% (frasco 500ml)''),'
    || '      lower(''Clorexidina 0,12% (frasco 300ml)'')'
    || '    )'
    || ')'
  using v_emp, v_kit_id;

  execute
    'insert into public.model_items(model_id, inventory_id'
    || (case when v_mi_has_emp then ', empresa_id' else '' end)
    || ', quantidade_sugerida) '
    || 'select $2, i.id'
    || (case when v_mi_has_emp then (case when v_mi_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
    || ', x.qtd '
    || 'from public.inventory i '
    || 'join (values '
    || '(''Anestésico Lidocaína 2% c/ vasoconstritor (cx 50)'', 1::numeric),'
    || '(''Agulha Curta (cx 100)'', 1::numeric),'
    || '(''Sutura Nylon 4-0 (un)'', 1::numeric),'
    || '(''Lâmina de Bisturi 15 (cx 100)'', 1::numeric),'
    || '(''Hemostático (esponja gelatinosa) (un)'', 1::numeric),'
    || '(''Campo Estéril (un)'', 1::numeric),'
    || '(''Gaze Estéril (pct 10)'', 2::numeric),'
    || '(''Soro Fisiológico 0,9% (frasco 500ml)'', 50::numeric),'
    || '(''Clorexidina 0,12% (frasco 300ml)'', 10::numeric)'
    || ') as x(nome, qtd) '
    || 'on lower(btrim(x.nome)) = lower(btrim(i.nome)) '
    || 'where i.empresa_id::text = $1 '
    || '  and not exists ('
    || '    select 1 from public.model_items mi '
    || '    where mi.model_id = $2 and mi.inventory_id = i.id'
    || '  )'
  using v_emp, v_kit_id;

  if v_srv_has_seqid then
    execute format('select coalesce(max(seqid), 0) from public.%I where empresa_id::text = $1', v_service_tbl)
      into v_max_seq
      using v_emp;
  else
    v_max_seq := 0;
  end if;

  v_srv_cols := 'id, empresa_id';
  v_srv_sel := (case when v_serv_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end) || ', ' || v_emp_expr_serv;
  if v_srv_has_seqid then
    v_srv_cols := v_srv_cols || ', seqid';
    v_srv_sel := v_srv_sel || ', ($2 + row_number() over (order by x.descricao))::int';
  end if;
  if v_srv_has_descricao then
    v_srv_cols := v_srv_cols || ', descricao';
    v_srv_sel := v_srv_sel || ', x.descricao';
  end if;
  if v_srv_has_valor then
    v_srv_cols := v_srv_cols || ', valor';
    v_srv_sel := v_srv_sel || ', x.valor';
  end if;
  if v_srv_has_ie then
    v_srv_cols := v_srv_cols || ', ie';
    v_srv_sel := v_srv_sel || ', ''S''';
  end if;
  if v_srv_has_tipo_calculo then
    v_srv_cols := v_srv_cols || ', tipo_calculo';
    v_srv_sel := v_srv_sel || ', ''Fixo''';
  end if;
  if v_srv_has_exige_elemento then
    v_srv_cols := v_srv_cols || ', exige_elemento';
    v_srv_sel := v_srv_sel || ', false';
  end if;
  if v_srv_has_subdivisao then
    v_srv_cols := v_srv_cols || ', subdivisao';
    v_srv_sel := v_srv_sel || ', ''Cirurgia''';
  end if;
  if v_srv_has_origem then
    v_srv_cols := v_srv_cols || ', origem';
    v_srv_sel := v_srv_sel || ', ''template''';
  end if;

  execute
    format('insert into public.%I(', v_service_tbl) || v_srv_cols || ') '
    || 'select ' || v_srv_sel || ' '
    || 'from (values '
    || '(''EXODONTIA DE SISO'', 950::numeric),'
    || '(''FRENECTOMIA'', 600::numeric),'
    || '(''CIRURGIA DE IMPLANTE'', 1500::numeric)'
    || ') as x(descricao, valor) '
    || 'where not exists ('
    || format('  select 1 from public.%I s ', v_service_tbl)
    || '  where s.empresa_id::text = $1 '
    || '    and upper(btrim(s.descricao)) = upper(btrim(x.descricao))'
    || ')'
  using v_emp, v_max_seq;

  if to_regclass('public.service_mapping') is not null then
    execute
      'delete from public.service_mapping sm '
      || 'where sm.model_id = $2 '
      || 'and exists ('
      || format('  select 1 from public.%I s ', v_service_tbl)
      || '  where s.id = sm.service_id '
      || '    and s.empresa_id::text = $1 '
      || '    and upper(btrim(s.descricao)) in ('
      || '      upper(''EXODONTIA DE SISO''),'
      || '      upper(''FRENECTOMIA''),'
      || '      upper(''CIRURGIA DE IMPLANTE'')'
      || '    )'
      || ')'
    using v_emp, v_kit_id;

    execute
      'insert into public.service_mapping(service_id, model_id'
      || (case when v_sm_has_emp then ', empresa_id' else '' end)
      || ') '
      || 'select s.id, $2 '
      || (case when v_sm_has_emp then (case when v_sm_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
      || format('from public.%I s ', v_service_tbl)
      || 'where s.empresa_id::text = $1 '
      || '  and upper(btrim(s.descricao)) in ('
      || '    upper(''EXODONTIA DE SISO''),'
      || '    upper(''FRENECTOMIA''),'
      || '    upper(''CIRURGIA DE IMPLANTE'')'
      || '  ) '
      || '  and not exists (select 1 from public.service_mapping sm where sm.service_id = s.id and sm.model_id = $2)'
    using v_emp, v_kit_id;
  end if;

  select count(*) into v_cnt from public.inventory where empresa_id::text = v_emp and (
    lower(nome) like '%anestes%'
    or lower(nome) like '%sut%'
    or lower(nome) like '%bisturi%'
    or lower(nome) like '%hemost%'
    or lower(nome) like '%campo est%'
  );
  raise notice 'Mestre %: itens cirurgia presentes=%', v_emp, v_cnt;
end $$;

notify pgrst, 'reload schema';
