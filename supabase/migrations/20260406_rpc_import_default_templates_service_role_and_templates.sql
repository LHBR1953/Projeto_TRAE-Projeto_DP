create or replace function rpc_import_default_templates(p_empresa_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := trim(coalesce(p_empresa_id, ''));
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_sql_admin boolean := false;
  v_tpl_serv text;
  v_tpl_inv text;
  v_tpl_models text;
  v_tpl_model_items text;
  v_tpl_map text;
  v_cols text;
  v_sel text;
  v_sql text;
  v_has_emp boolean;
  v_has_serv_origem boolean;
  v_serv_has_codigo boolean;
  v_tpl_serv_has_codigo boolean;
  v_id_is_uuid boolean;
  v_emp_is_uuid boolean;
  v_model_id_is_uuid boolean;
  v_inventory_id_is_uuid boolean;
  v_service_id_is_uuid boolean;
  v_tpl_models_has_include boolean := false;
  v_missing_models int := 0;
  v_missing_inventory int := 0;
  v_missing_servicos int := 0;
  v_missing_model_items_for_mapping int := 0;
  v_serv_count int := 0;
  v_inv_count int := 0;
  v_models_count int := 0;
  v_model_items_count int := 0;
  v_map_count int := 0;
  v_src_serv_count int := 0;
  v_src_inv_count int := 0;
  v_src_models_count int := 0;
  v_src_mi_count int := 0;
  v_src_map_count int := 0;
  v_src_map_distinct int := 0;
  v_src_map_join_count int := 0;
  v_dbg_tmp_serv int := 0;
  v_dbg_tmp_model int := 0;
  v_dbg_tmp_inv int := 0;
  v_post_models int := 0;
  v_post_map int := 0;
  v_post_mi int := 0;
  v_rpc_version text := '20260407-03';
  v_use_map_fallback boolean := false;
  v_tpl_serv_has_subdivisao boolean := false;
  v_expected_mi int := 0;
  v_actual_mi int := 0;
  v_missing_mi_models text;
  v_desc_expr text;
  v_sub_expr text;
  v_tpl_biosseg text;
  v_tpl_dent text;
  v_tpl_endo text;
  v_tpl_exo text;
  v_tpl_perio text;
  v_tpl_radio text;
  v_tpl_prot text;
  v_tpl_orto text;
  v_tpl_impl text;
  v_tpl_hof text;
  v_tpl_diag text;
  v_spec_src text;
  v_tpl_sub_has_especialidade_id boolean := false;
  v_tpl_sub_has_especialidade_seqid boolean := false;
  v_tpl_spec_has_seqid boolean := false;
begin
  if v_emp = '' then
    raise exception 'empresa_id inválido.';
  end if;

  v_is_sql_admin := (current_user in ('postgres', 'supabase_admin'));

  if v_uid is null and v_role <> 'service_role' and not v_is_sql_admin then
    raise exception 'Usuário não autenticado.';
  end if;

  if v_uid is not null and not v_is_sql_admin then
    if not exists (
      select 1
      from public.usuario_empresas ue
      where ue.usuario_id = v_uid
        and ue.empresa_id = v_emp
    ) then
      raise exception 'Sem permissão para importar nesta empresa.';
    end if;
  end if;

  if to_regclass('public.empresas') is not null then
    if not exists (
      select 1
      from public.empresas e
      where e.id::text = v_emp
    ) then
      raise exception 'empresa_id não existe na tabela empresas: %', v_emp;
    end if;
  end if;

  v_tpl_serv := case
    when to_regclass('public.servicos_template') is not null then 'servicos_template'
    else null
  end;
  v_tpl_inv := case
    when to_regclass('public.inventory_template') is not null then 'inventory_template'
    when to_regclass('public.inventario_template') is not null then 'inventario_template'
    else null
  end;
  v_tpl_models := case
    when to_regclass('public.usage_models_template') is not null then 'usage_models_template'
    when to_regclass('public.modelo_uso_template') is not null then 'modelo_uso_template'
    else null
  end;
  v_tpl_model_items := case
    when to_regclass('public.model_items_template') is not null then 'model_items_template'
    else null
  end;
  v_tpl_map := case
    when to_regclass('public.service_mapping_template') is not null then 'service_mapping_template'
    else null
  end;

  if v_tpl_serv is null or v_tpl_inv is null or v_tpl_models is null or v_tpl_model_items is null or v_tpl_map is null then
    raise exception 'Tabelas de template ausentes para importação.';
  end if;

  delete from public.occ_empresa_imports
  where empresa_id = v_emp
    and kind = 'default_templates_v1';

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'servicos'
      and column_name = 'empresa_id'
  ) into v_has_emp;
  if v_has_emp then
    execute
      'delete from public.service_mapping sm ' ||
      'using public.servicos s ' ||
      'where sm.service_id::text = s.id::text ' ||
      '  and s.empresa_id::text = $1'
    using v_emp;

    execute
      'delete from public.servicos ' ||
      'where empresa_id::text = $1'
    using v_emp;
  end if;

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usage_models'
      and column_name = 'empresa_id'
  ) into v_has_emp;
  if v_has_emp then
    execute
      'delete from public.service_mapping sm ' ||
      'using public.usage_models um ' ||
      'where sm.model_id::text = um.id::text ' ||
      '  and um.empresa_id::text = $1'
    using v_emp;

    execute
      'delete from public.model_items mi ' ||
      'using public.usage_models um ' ||
      'where mi.model_id::text = um.id::text ' ||
      '  and um.empresa_id::text = $1'
    using v_emp;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'model_items'
        and column_name = 'empresa_id'
    ) then
      execute
        'delete from public.model_items ' ||
        'where empresa_id::text = $1'
      using v_emp;
    end if;

    execute
      'delete from public.usage_models ' ||
      'where empresa_id::text = $1'
    using v_emp;
  end if;

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_tpl_models
      and column_name = 'include_biosseguranca'
  ) into v_tpl_models_has_include;

  if to_regclass('public.especialidades_template') is not null
     and to_regclass('public.especialidade_subdivisoes_template') is not null
     and to_regclass('public.especialidades') is not null
     and to_regclass('public.especialidade_subdivisoes') is not null
  then
    declare
      v_spec_record record;
      v_spec_id_use text;
      v_spec_id_is_uuid boolean := false;
      v_spec_emp_is_uuid boolean := false;
      v_sub_id_is_uuid boolean := false;
      v_sub_emp_is_uuid boolean := false;
      v_sub_especialidade_id_is_uuid boolean := false;
      v_tpl_has_seqid boolean := false;
      v_tpl_sub_has_seqid boolean := false;
    begin
    if to_regclass('public.servicos') is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='servicos' and column_name='empresa_id')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='servicos' and column_name='especialidadeid')
    then
      execute 'update public.servicos set especialidadeid = null where empresa_id::text = $1' using v_emp;
    end if;
    if to_regclass('public.servicos') is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='servicos' and column_name='empresa_id')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='servicos' and column_name='subdivisao_id')
    then
      execute 'update public.servicos set subdivisao_id = null where empresa_id::text = $1' using v_emp;
    end if;
    if to_regclass('public.profissionais') is not null
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='profissionais' and column_name='empresa_id')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='profissionais' and column_name='especialidadeid')
    then
      execute 'update public.profissionais set especialidadeid = null where empresa_id::text = $1' using v_emp;
    end if;

    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='especialidade_subdivisoes' and column_name='empresa_id') then
      execute 'delete from public.especialidade_subdivisoes where empresa_id::text = $1' using v_emp;
    end if;
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='especialidades' and column_name='empresa_id') then
      execute 'delete from public.especialidades where empresa_id::text = $1' using v_emp;
    end if;

    select (c.udt_name = 'uuid')
      into v_spec_id_is_uuid
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'especialidades' and c.column_name = 'id';
    select (c.udt_name = 'uuid')
      into v_spec_emp_is_uuid
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'especialidades' and c.column_name = 'empresa_id';

    select (c.udt_name = 'uuid')
      into v_sub_id_is_uuid
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'especialidade_subdivisoes' and c.column_name = 'id';
    select (c.udt_name = 'uuid')
      into v_sub_emp_is_uuid
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'especialidade_subdivisoes' and c.column_name = 'empresa_id';
    select (c.udt_name = 'uuid')
      into v_sub_especialidade_id_is_uuid
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'especialidade_subdivisoes' and c.column_name = 'especialidade_id';

    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='especialidades_template' and column_name='seqid'
    ) into v_tpl_has_seqid;
    select exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='especialidade_subdivisoes_template' and column_name='especialidade_seqid'
    ) into v_tpl_sub_has_seqid;

    if not v_tpl_has_seqid then
      raise exception 'Templates inconsistentes: especialidades_template deve ter seqid';
    end if;
    if not v_tpl_sub_has_seqid then
      raise exception 'Templates inconsistentes: especialidade_subdivisoes_template deve ter especialidade_seqid';
    end if;

    for v_spec_record in
      select t.id::text as id_txt, t.seqid::int as seqid, t.nome
      from public.especialidades_template t
      order by t.seqid asc nulls last, t.nome asc
    loop
      v_spec_id_use := v_spec_record.id_txt;
      if exists (
        select 1
        from public.especialidades e
        where e.id::text = v_spec_record.id_txt
          and e.empresa_id::text <> v_emp
      ) then
        v_spec_id_use := substr(md5(v_emp || '|esp|' || v_spec_record.id_txt), 1, 8)
                      || '-' || substr(md5(v_emp || '|esp|' || v_spec_record.id_txt), 9, 4)
                      || '-' || substr(md5(v_emp || '|esp|' || v_spec_record.id_txt), 13, 4)
                      || '-' || substr(md5(v_emp || '|esp|' || v_spec_record.id_txt), 17, 4)
                      || '-' || substr(md5(v_emp || '|esp|' || v_spec_record.id_txt), 21, 12);
        if exists (select 1 from public.especialidades e2 where e2.id::text = v_spec_id_use) then
          v_spec_id_use := gen_random_uuid()::text;
        end if;
      end if;

      v_sql :=
        'insert into public.especialidades (id, seqid, empresa_id, nome) values ('
        || (case when v_spec_id_is_uuid then '$1::uuid' else '$1' end)
        || ', $2, '
        || (case when v_spec_emp_is_uuid then '$3::uuid' else '$3' end)
        || ', $4) '
        || 'on conflict (id) do update set seqid = excluded.seqid, nome = excluded.nome, empresa_id = excluded.empresa_id';
      execute v_sql using v_spec_id_use, v_spec_record.seqid, v_emp, v_spec_record.nome;

      v_sql :=
        'insert into public.especialidade_subdivisoes (id, especialidade_id, empresa_id, nome) '
        || 'select '
        || (case when v_sub_id_is_uuid then 'gen_random_uuid()' else 'gen_random_uuid()::text' end)
        || ', '
        || (case when v_sub_especialidade_id_is_uuid then '$1::uuid' else '$1' end)
        || ', '
        || (case when v_sub_emp_is_uuid then '$2::uuid' else '$2' end)
        || ', ($3::text || ''.'' || row_number() over (order by st.nome) || '' - '' || st.nome) '
        || 'from public.especialidade_subdivisoes_template st '
        || 'where st.especialidade_seqid::text = $3::text';
      execute v_sql using v_spec_id_use, v_emp, v_spec_record.seqid;
    end loop;
    end;
  end if;

  create temporary table tmp_serv_map(old_id text primary key, new_id uuid not null) on commit drop;
  create temporary table tmp_inv_map(old_id text primary key, new_id uuid not null) on commit drop;
  create temporary table tmp_model_map(old_id text primary key, new_id uuid not null) on commit drop;

  execute format('insert into tmp_serv_map(old_id,new_id) select id::text, gen_random_uuid() from public.%I', v_tpl_serv);
  execute format(
    'insert into tmp_inv_map(old_id,new_id) ' ||
    'select t.id::text, coalesce(x.id, gen_random_uuid()) ' ||
    'from public.%I t ' ||
    'left join lateral ( ' ||
    '  select i.id ' ||
    '  from public.inventory i ' ||
    '  where i.empresa_id::text = $1 ' ||
    '    and upper(regexp_replace(btrim(i.nome), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '        = upper(regexp_replace(btrim(t.nome), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '  order by i.id ' ||
    '  limit 1 ' ||
    ') x on true',
    v_tpl_inv
  ) using v_emp;
  execute format(
    'insert into tmp_model_map(old_id,new_id) ' ||
    'select t.id::text, coalesce(x.id, gen_random_uuid()) ' ||
    'from public.%I t ' ||
    'left join lateral ( ' ||
    '  select u.id ' ||
    '  from public.usage_models u ' ||
    '  where u.empresa_id::text = $1 ' ||
    '    and upper(regexp_replace(btrim(u.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '        = upper(regexp_replace(btrim(t.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '  order by u.id ' ||
    '  limit 1 ' ||
    ') x on true',
    v_tpl_models
  ) using v_emp;

  execute format(
    'select count(*) from public.%I mi left join public.%I um on btrim(um.id::text) = btrim(mi.model_id::text) where um.id is null',
    v_tpl_model_items,
    v_tpl_models
  ) into v_missing_models;
  execute format(
    'select count(*) from public.%I mi left join public.%I it on btrim(it.id::text) = btrim(mi.inventory_id::text) where it.id is null',
    v_tpl_model_items,
    v_tpl_inv
  ) into v_missing_inventory;
  execute format(
    'select count(*) from public.%I sm left join public.%I s on s.id::text = sm.service_id::text where s.id is null',
    v_tpl_map,
    v_tpl_serv
  ) into v_missing_servicos;
  if v_tpl_models_has_include then
    execute format(
      'select count(*) from (' ||
      '  select sm.model_id::text mid' ||
      '  from public.%I sm' ||
      '  join public.%I um on um.id::text = sm.model_id::text' ||
      '  left join public.%I mi on mi.model_id::text = sm.model_id::text' ||
      '  group by sm.model_id, um.include_biosseguranca' ||
      '  having count(mi.*)=0 and coalesce(um.include_biosseguranca, true)=false' ||
      ') x',
      v_tpl_map,
      v_tpl_models,
      v_tpl_model_items
    ) into v_missing_model_items_for_mapping;
  else
    execute format(
      'select count(*) from (select sm.model_id::text mid from public.%I sm left join public.%I mi on mi.model_id::text = sm.model_id::text group by sm.model_id having count(mi.*)=0) x',
      v_tpl_map,
      v_tpl_model_items
    ) into v_missing_model_items_for_mapping;
  end if;

  if v_missing_models > 0 or v_missing_servicos > 0 or v_missing_model_items_for_mapping > 0 then
    raise exception 'Templates inconsistentes: model_items_template sem model_id=%; service_mapping_template sem service_id=%; modelos_sem_itens_em_mapping=%; model_items_sem_inventory_ignorado=%',
      v_missing_models, v_missing_servicos, v_missing_model_items_for_mapping, v_missing_inventory;
  end if;

  execute format('select count(*) from public.%I', v_tpl_serv) into v_src_serv_count;
  execute format('select count(*) from public.%I', v_tpl_inv) into v_src_inv_count;
  execute format('select count(*) from public.%I', v_tpl_models) into v_src_models_count;
  execute format('select count(*) from public.%I', v_tpl_model_items) into v_src_mi_count;
  execute format('select count(*) from public.%I', v_tpl_map) into v_src_map_count;
  execute format('select count(*) from (select distinct service_id::text, model_id::text from public.%I) x', v_tpl_map) into v_src_map_distinct;
  execute format(
    'select count(*) from public.%I t ' ||
    'join tmp_serv_map sm on sm.old_id = t.service_id::text ' ||
    'join tmp_model_map mm on mm.old_id = t.model_id::text',
    v_tpl_map
  ) into v_src_map_join_count;
  select count(*) into v_dbg_tmp_serv from tmp_serv_map;
  select count(*) into v_dbg_tmp_inv from tmp_inv_map;
  select count(*) into v_dbg_tmp_model from tmp_model_map;

  select exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_tpl_serv
      and column_name = 'subdivisao'
  ) into v_tpl_serv_has_subdivisao;

  v_use_map_fallback := (v_src_map_join_count = 0);
  if v_use_map_fallback then
    v_src_map_distinct := v_src_serv_count;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos' and column_name = 'codigo_servico'
  ) into v_serv_has_codigo;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_tpl_serv and column_name = 'codigo_servico'
  ) into v_tpl_serv_has_codigo;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos' and column_name = 'empresa_id'
  ) into v_has_emp;
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'servicos' and column_name = 'origem'
  ) into v_has_serv_origem;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'servicos' and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'servicos' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_serv
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'servicos'
    and c.column_name not in ('id','empresa_id','origem','created_at','updated_at','codigo_servico','especialidadeid','subdivisao_id');

  v_sql := 'insert into public.servicos(id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when v_has_serv_origem then ', origem' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') '
        || 'select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when v_has_serv_origem then ', ''template''' else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || v_sel else '' end)
        || ' '
        || format('from public.%I t join tmp_serv_map m on m.old_id = t.id::text', v_tpl_serv);
  execute v_sql using v_emp;
  get diagnostics v_serv_count = row_count;
  if v_serv_count <> v_src_serv_count then
    raise exception 'Importação incompleta: servicos (% vs %)', v_serv_count, v_src_serv_count;
  end if;

  if v_serv_has_codigo then
    if v_tpl_serv_has_codigo then
      execute
        'with base as ('
        || '  select '
        || '    t.id::text as old_id,'
        || '    t.descricao,'
        || '    row_number() over(order by t.descricao) as rn,'
        || '    count(*) over() as total,'
        || '    nullif(btrim(t.codigo_servico), '''') as tpl_code'
        || format('  from public.%I t', v_tpl_serv)
        || '), src as ('
        || '  select '
        || '    old_id,'
        || '    coalesce('
        || '      tpl_code,'
        || '      lpad(rn::text, greatest(2, length(total::text)), ''0'')'
        || '    ) as code'
        || '  from base'
        || ')'
        || ' update public.servicos s'
        || ' set codigo_servico = src.code'
        || ' from src join tmp_serv_map m on m.old_id = src.old_id'
        || ' where s.id::text = m.new_id::text'
        || '   and (s.codigo_servico is null or btrim(s.codigo_servico) = '''')';
    else
      execute
        'with base as ('
        || '  select '
        || '    t.id::text as old_id,'
        || '    t.descricao,'
        || '    row_number() over(order by t.descricao) as rn,'
        || '    count(*) over() as total'
        || format('  from public.%I t', v_tpl_serv)
        || '), src as ('
        || '  select '
        || '    old_id,'
        || '    lpad(rn::text, greatest(2, length(total::text)), ''0'') as code'
        || '  from base'
        || ')'
        || ' update public.servicos s'
        || ' set codigo_servico = src.code'
        || ' from src join tmp_serv_map m on m.old_id = src.old_id'
        || ' where s.id::text = m.new_id::text'
        || '   and (s.codigo_servico is null or btrim(s.codigo_servico) = '''')';
    end if;
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'inventory' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_inv
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'inventory'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','estoque_atual','estoque_minimo','saldo_atual');

  v_sql := 'insert into public.inventory(id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') '
        || 'with src as ('
        || format(
          '  select t.*, ' ||
          '         upper(regexp_replace(btrim(t.nome), ''[[:space:]]+'', '' '', ''g'')) as nome_norm, ' ||
          '         row_number() over(partition by upper(regexp_replace(btrim(t.nome), ''[[:space:]]+'', '' '', ''g'')) order by t.id) as rn ' ||
          '  from public.%I t',
          v_tpl_inv
        )
        || ') '
        || 'select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
        || ' '
        || 'from src s '
        || 'join tmp_inv_map m on m.old_id = s.id::text '
        || 'where s.rn = 1 '
        || '  and not exists ( '
        || '    select 1 '
        || '    from public.inventory e '
        || '    where e.empresa_id::text = $1 '
        || '      and upper(regexp_replace(btrim(e.nome), ''[[:space:]]+'', '' '', ''g'')) = s.nome_norm '
        || '  )';
  execute v_sql using v_emp;
  get diagnostics v_inv_count = row_count;

  execute format(
    'update tmp_inv_map m ' ||
    'set new_id = x.id ' ||
    'from public.%I t ' ||
    'join lateral ( ' ||
    '  select i.id ' ||
    '  from public.inventory i ' ||
    '  where i.empresa_id::text = $1 ' ||
    '    and upper(regexp_replace(btrim(i.nome), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '        = upper(regexp_replace(btrim(t.nome), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '  order by i.id ' ||
    '  limit 1 ' ||
    ') x on true ' ||
    'where m.old_id = t.id::text',
    v_tpl_inv
  ) using v_emp;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usage_models' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_models
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'usage_models'
    and c.column_name not in ('id','empresa_id','created_at','updated_at');

  v_sql := 'insert into public.usage_models(id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') '
        || 'with src as ('
        || format(
          '  select t.*, ' ||
          '         upper(regexp_replace(btrim(t.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) as nome_norm, ' ||
          '         row_number() over(partition by upper(regexp_replace(btrim(t.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) order by t.id) as rn ' ||
          '  from public.%I t',
          v_tpl_models
        )
        || ') '
        || 'select '
        || (case when v_id_is_uuid then 'm.new_id' else 'm.new_id::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
        || ' '
        || 'from src s '
        || 'join tmp_model_map m on m.old_id = s.id::text '
        || 'where s.rn = 1 '
        || '  and not exists ( '
        || '    select 1 '
        || '    from public.usage_models e '
        || '    where e.empresa_id::text = $1 '
        || '      and upper(regexp_replace(btrim(e.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) = s.nome_norm '
        || '  )';
  execute v_sql using v_emp;
  get diagnostics v_models_count = row_count;

  execute format(
    'update tmp_model_map m ' ||
    'set new_id = x.id ' ||
    'from public.%I t ' ||
    'join lateral ( ' ||
    '  select u.id ' ||
    '  from public.usage_models u ' ||
    '  where u.empresa_id::text = $1 ' ||
    '    and upper(regexp_replace(btrim(u.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '        = upper(regexp_replace(btrim(t.nome_modelo), ''[[:space:]]+'', '' '', ''g'')) ' ||
    '  order by u.id ' ||
    '  limit 1 ' ||
    ') x on true ' ||
    'where m.old_id = t.id::text',
    v_tpl_models
  ) using v_emp;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'model_items' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_model_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'model_id';
  select (c.udt_name = 'uuid')
    into v_inventory_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'inventory_id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'model_items' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_model_items
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'model_items'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','model_id','inventory_id');

  v_sql := 'insert into public.model_items(model_id, inventory_id'
        || (case when v_has_emp then ', empresa_id' else '' end)
        || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
        || ') '
        || 'with src_map as ('
        || format(
          '  select t.*, umd.id as model_id_new, invd.id as inventory_id_new ' ||
          '  from public.%I t ' ||
          '  join tmp_model_map mm on btrim(mm.old_id) = btrim(t.model_id::text) ' ||
          '  join tmp_inv_map im on btrim(im.old_id) = btrim(t.inventory_id::text) ' ||
          '  join public.usage_models umd on umd.id::text = mm.new_id::text and umd.empresa_id::text = $1 ' ||
          '  join public.inventory invd on invd.id::text = im.new_id::text and invd.empresa_id::text = $1',
          v_tpl_model_items
        )
        || '), src_dedup as ('
        || '  select s.*, row_number() over(partition by s.model_id_new::text, s.inventory_id_new::text order by s.id::text) as rn '
        || '  from src_map s '
        || '  where s.model_id_new is not null and s.inventory_id_new is not null '
        || ') '
        || 'select '
        || (case when v_model_id_is_uuid then 's.model_id_new' else 's.model_id_new::text' end)
        || ', '
        || (case when v_inventory_id_is_uuid then 's.inventory_id_new' else 's.inventory_id_new::text' end)
        || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
        || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
        || ' '
        || 'from src_dedup s '
        || 'where s.rn = 1 '
        || '  and not exists ( '
        || '    select 1 '
        || '    from public.model_items mi '
        || '    where mi.model_id::text = s.model_id_new::text '
        || '      and mi.inventory_id::text = s.inventory_id_new::text '
        || (case when v_has_emp then '      and mi.empresa_id::text = $1 ' else '' end)
        || '  )';
  execute v_sql using v_emp;
  get diagnostics v_model_items_count = row_count;

  if v_model_items_count < v_src_mi_count then
    v_sql := 'insert into public.model_items(model_id, inventory_id'
          || (case when v_has_emp then ', empresa_id' else '' end)
          || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
          || ') '
          || 'with tpl as ('
          || format(
            '  select t.*, umt.nome_modelo as model_name, it.nome as item_name ' ||
            '  from public.%I t ' ||
            '  left join public.%I umt on ( ' ||
            '       btrim(umt.id::text) = btrim(t.model_id::text) ' ||
            '    or (lower(t.model_id::text) like ''%%biosseg%%'' and lower(umt.nome_modelo) like ''%%biosseg%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%dent%%'' and lower(umt.nome_modelo) like ''%%dent%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%endo%%'' and lower(umt.nome_modelo) like ''%%endo%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%exo%%'' and lower(umt.nome_modelo) like ''%%exo%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%perio%%'' and lower(umt.nome_modelo) like ''%%perio%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%radio%%'' and lower(umt.nome_modelo) like ''%%radio%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%prot%%'' and lower(umt.nome_modelo) like ''%%prót%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%orto%%'' and lower(umt.nome_modelo) like ''%%orto%%'') ' ||
            '    or (lower(t.model_id::text) like ''%%impl%%'' and lower(umt.nome_modelo) like ''%%impl%%'') ' ||
            '    or ((lower(t.model_id::text) like ''%%hof%%'' or lower(t.model_id::text) like ''%%harmon%%'') and (lower(umt.nome_modelo) like ''%%hof%%'' or lower(umt.nome_modelo) like ''%%harmon%%'')) ' ||
            '    or (lower(t.model_id::text) like ''%%diag%%'' and lower(umt.nome_modelo) like ''%%diag%%'') ' ||
            '  ) ' ||
            '  left join public.%I it on ( ' ||
            '       btrim(it.id::text) = btrim(t.inventory_id::text) ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_001'' and lower(it.nome) like ''%%luva%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_002'' and (lower(it.nome) like ''%%mascara%%'' or lower(it.nome) like ''%%máscara%%'')) ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_003'' and lower(it.nome) like ''%%touca%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_004'' and lower(it.nome) like ''%%gaze%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_005'' and lower(it.nome) like ''%%alcool%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_006'' and lower(it.nome) like ''%%anestes%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_007'' and lower(it.nome) like ''%%algod%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_008'' and lower(it.nome) like ''%%sugador%%'') ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_009'' and (lower(it.nome) like ''%%babador%%'' or lower(it.nome) like ''%%guardanapo%%'')) ' ||
            '    or (lower(t.inventory_id::text) = ''tpl_inv_010'' and lower(it.nome) like ''%%grau%%'') ' ||
            '  )',
            v_tpl_model_items,
            v_tpl_models,
            v_tpl_inv
          )
          || '), src_name as ('
          || '  select tpl.*, umd.id as model_id_new, invd.id as inventory_id_new '
          || '  from tpl '
          || '  join lateral ( '
          || '    select u.id '
          || '    from public.usage_models u '
          || '    where u.empresa_id::text = $1 '
          || '      and ('
          || '        u.id::text = (select mm.new_id::text from tmp_model_map mm where btrim(mm.old_id) = btrim(tpl.model_id::text) limit 1) '
          || '        or upper(translate(regexp_replace(btrim(u.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           = upper(translate(regexp_replace(btrim(coalesce(tpl.model_name, tpl.model_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '        or upper(translate(regexp_replace(btrim(u.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           like ''%'' || upper(translate(regexp_replace(btrim(coalesce(tpl.model_name, tpl.model_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) || ''%'' '
          || '      ) '
          || '    order by case '
          || '      when u.id::text = (select mm.new_id::text from tmp_model_map mm where btrim(mm.old_id) = btrim(tpl.model_id::text) limit 1) then 0 '
          || '      when upper(translate(regexp_replace(btrim(u.nome_modelo), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           = upper(translate(regexp_replace(btrim(coalesce(tpl.model_name, tpl.model_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) then 1 '
          || '      else 2 end, u.id '
          || '    limit 1 '
          || '  ) umd on true '
          || '  join lateral ( '
          || '    select i.id '
          || '    from public.inventory i '
          || '    where i.empresa_id::text = $1 '
          || '      and ('
          || '        i.id::text = (select im.new_id::text from tmp_inv_map im where btrim(im.old_id) = btrim(tpl.inventory_id::text) limit 1) '
          || '        or upper(translate(regexp_replace(btrim(i.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           = upper(translate(regexp_replace(btrim(coalesce(tpl.item_name, tpl.inventory_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '        or upper(translate(regexp_replace(btrim(i.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           like ''%'' || upper(translate(regexp_replace(btrim(coalesce(tpl.item_name, tpl.inventory_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) || ''%'' '
          || '      ) '
          || '    order by case '
          || '      when i.id::text = (select im.new_id::text from tmp_inv_map im where btrim(im.old_id) = btrim(tpl.inventory_id::text) limit 1) then 0 '
          || '      when upper(translate(regexp_replace(btrim(i.nome), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) '
          || '           = upper(translate(regexp_replace(btrim(coalesce(tpl.item_name, tpl.inventory_id::text)), ''[^[:alnum:]]+'', '''', ''g''), ''ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç'', ''AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'')) then 1 '
          || '      else 2 end, i.id '
          || '    limit 1 '
          || '  ) invd on true '
          || '), src_dedup as ('
          || '  select s.*, row_number() over(partition by s.model_id_new::text, s.inventory_id_new::text order by s.id::text) as rn '
          || '  from src_name s '
          || '  where s.model_id_new is not null and s.inventory_id_new is not null '
          || ') '
          || 'select '
          || (case when v_model_id_is_uuid then 's.model_id_new' else 's.model_id_new::text' end)
          || ', '
          || (case when v_inventory_id_is_uuid then 's.inventory_id_new' else 's.inventory_id_new::text' end)
          || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
          || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
          || ' '
          || 'from src_dedup s '
          || 'where s.rn = 1 '
          || '  and not exists ( '
          || '    select 1 '
          || '    from public.model_items mi '
          || '    where mi.model_id::text = s.model_id_new::text '
          || '      and mi.inventory_id::text = s.inventory_id_new::text '
          || (case when v_has_emp then '      and mi.empresa_id::text = $1 ' else '' end)
          || '  )';
    execute v_sql using v_emp;
    get diagnostics v_missing_inventory = row_count;
    v_model_items_count := coalesce(v_model_items_count, 0) + coalesce(v_missing_inventory, 0);
  end if;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_mapping' and column_name = 'empresa_id'
  ) into v_has_emp;
  select (c.udt_name = 'uuid')
    into v_service_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'service_id';
  select (c.udt_name = 'uuid')
    into v_model_id_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'model_id';
  select (c.udt_name = 'uuid')
    into v_emp_is_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'empresa_id';

  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('t.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_cols, v_sel
  from information_schema.columns c
  join information_schema.columns s
    on s.table_schema = 'public'
   and s.table_name = v_tpl_map
   and s.column_name = c.column_name
  where c.table_schema = 'public'
    and c.table_name = 'service_mapping'
    and c.column_name not in ('id','empresa_id','created_at','updated_at','service_id','model_id');

  if v_use_map_fallback then
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Biossegurança') into v_tpl_biosseg;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Dentística') into v_tpl_dent;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Endodontia') into v_tpl_endo;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Exodontia') into v_tpl_exo;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Periodontia') into v_tpl_perio;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Radiologia') into v_tpl_radio;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Prótese') into v_tpl_prot;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Ortodontia') into v_tpl_orto;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Implantodontia') into v_tpl_impl;
    if v_tpl_impl is null then
      execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Implante') into v_tpl_impl;
    end if;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Harmonização Facial') into v_tpl_hof;
    if v_tpl_hof is null then
      execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit HOF') into v_tpl_hof;
    end if;
    execute format('select id::text from public.%I where upper(btrim(nome_modelo)) = upper(%L) limit 1', v_tpl_models, 'Kit Diagnóstico') into v_tpl_diag;

    if v_tpl_biosseg is null
      or v_tpl_dent is null
      or v_tpl_endo is null
      or v_tpl_exo is null
      or v_tpl_perio is null
      or v_tpl_radio is null
      or v_tpl_prot is null
      or v_tpl_orto is null
      or v_tpl_impl is null
      or v_tpl_hof is null
      or v_tpl_diag is null
    then
      raise exception 'Templates inconsistentes: não foi possível localizar todos os 11 kits em %', v_tpl_models;
    end if;

    create temporary table tmp_family_service(service_id text primary key, family_model_id text not null) on commit drop;

    v_desc_expr := 'lower(coalesce(s.descricao, ''''))';
    v_sub_expr := case when v_tpl_serv_has_subdivisao then 'lower(coalesce(s.subdivisao, ''''))' else '''''' end;

    v_sql := format(
      'insert into tmp_family_service(service_id, family_model_id) ' ||
      'select s.id::text, case ' ||
      '  when %1$s like %2$L or %1$s like %3$L or %4$s like %5$L then %6$L ' ||
      '  when %1$s like %7$L or %4$s like %8$L then %9$L ' ||
      '  when %1$s like %10$L or %4$s like %11$L then %12$L ' ||
      '  when %1$s like %13$L or %1$s like %14$L or %4$s like %15$L then %16$L ' ||
      '  when %1$s like %17$L or %1$s like %18$L or %4$s like %19$L then %20$L ' ||
      '  when %1$s like %21$L or %1$s like %22$L or %4$s like %23$L then %24$L ' ||
      '  when %1$s like %25$L or %1$s like %26$L or %1$s like %27$L or %1$s like %28$L then %29$L ' ||
      '  when %1$s like %30$L or %1$s like %31$L or %1$s like %32$L then %33$L ' ||
      '  when %1$s like %34$L or %4$s like %35$L then %36$L ' ||
      '  else %37$L ' ||
      'end ' ||
      'from public.%38$I s',
      v_desc_expr,
      '%radiograf%', '%raio%', v_sub_expr, '%imagem%', v_tpl_radio,
      '%implan%', '%implan%', v_tpl_impl,
      '%orto%', '%orto%', v_tpl_orto,
      '%prót%', '%prot%', '%prót%', v_tpl_prot,
      '%endo%', '%canal%', '%endo%', v_tpl_endo,
      '%perio%', '%rasp%', '%perio%', v_tpl_perio,
      '%exodont%', '%extra%', '%cirurg%', '%cirurg%', v_tpl_exo,
      '%hof%', '%harmon%', '%preench%', v_tpl_hof,
      '%avalia%', '%consulta%', v_tpl_diag,
      v_tpl_dent,
      v_tpl_serv
    );
    execute v_sql;
  end if;

  if v_use_map_fallback then
    v_sql := 'insert into public.service_mapping(service_id, model_id'
          || (case when v_has_emp then ', empresa_id' else '' end)
          || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
          || ') '
          || 'with src as ('
          || format(
            '  select t.*, sm.new_id as service_id_new, mm.new_id as model_id_new, ' ||
            '         row_number() over(partition by sm.new_id, mm.new_id order by t.service_id, t.model_id) as rn ' ||
            '  from public.%I t ' ||
            '  join tmp_serv_map sm on sm.old_id = t.service_id::text ' ||
            '  join tmp_family_service fs on fs.service_id = t.service_id::text ' ||
            '  join tmp_model_map mm on mm.old_id = fs.family_model_id',
            v_tpl_map
          )
          || ') '
          || 'select '
          || (case when v_service_id_is_uuid then 's.service_id_new' else 's.service_id_new::text' end)
          || ', '
          || (case when v_model_id_is_uuid then 's.model_id_new' else 's.model_id_new::text' end)
          || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
          || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
          || ' '
          || 'from src s '
          || 'where s.rn = 1 '
          || '  and not exists ( '
          || '    select 1 '
          || '    from public.service_mapping e '
          || '    where e.service_id::text = s.service_id_new::text '
          || '      and e.model_id::text = s.model_id_new::text '
          || (case when v_has_emp then '      and e.empresa_id::text = $1 ' else '' end)
          || '  )';
  else
    v_sql := 'insert into public.service_mapping(service_id, model_id'
          || (case when v_has_emp then ', empresa_id' else '' end)
          || (case when coalesce(v_cols,'') <> '' then ', ' || v_cols else '' end)
          || ') '
          || 'with src as ('
          || format(
            '  select t.*, sm.new_id as service_id_new, mm.new_id as model_id_new, ' ||
            '         row_number() over(partition by sm.new_id, mm.new_id order by t.service_id, t.model_id) as rn ' ||
            '  from public.%I t ' ||
            '  join tmp_serv_map sm on sm.old_id = t.service_id::text ' ||
            '  join tmp_model_map mm on mm.old_id = t.model_id::text',
            v_tpl_map
          )
          || ') '
          || 'select '
          || (case when v_service_id_is_uuid then 's.service_id_new' else 's.service_id_new::text' end)
          || ', '
          || (case when v_model_id_is_uuid then 's.model_id_new' else 's.model_id_new::text' end)
          || (case when v_has_emp then (case when v_emp_is_uuid then ', $1::uuid' else ', $1' end) else '' end)
          || (case when coalesce(v_sel,'') <> '' then ', ' || replace(v_sel, 't.', 's.') else '' end)
          || ' '
          || 'from src s '
          || 'where s.rn = 1 '
          || '  and not exists ( '
          || '    select 1 '
          || '    from public.service_mapping e '
          || '    where e.service_id::text = s.service_id_new::text '
          || '      and e.model_id::text = s.model_id_new::text '
          || (case when v_has_emp then '      and e.empresa_id::text = $1 ' else '' end)
          || '  )';
  end if;
  execute v_sql using v_emp;
  get diagnostics v_map_count = row_count;

  select count(*) into v_post_models
  from public.usage_models um
  where um.empresa_id::text = v_emp
    and (
      lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit biosseg%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit dent%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit endo%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit exo%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit perio%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit radio%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit prot%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit orto%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit implan%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit harmon%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit hof%'
      or lower(translate(regexp_replace(btrim(um.nome_modelo), '[[:space:]]+', ' ', 'g'), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) like '%kit diag%'
    );

  select count(*) into v_post_map
  from public.service_mapping sm
  join tmp_serv_map tsm on tsm.new_id::text = sm.service_id::text;

  select count(*) into v_post_mi
  from public.model_items mi
  join tmp_model_map tmm on tmm.new_id::text = mi.model_id::text;

  if v_post_models <> 11 then
    raise exception 'Importação inválida [v%]: esperado 11 kits, obtido % (servicos_inserted=%; inv_inserted=%; models_inserted=%; mi_inserted=%; map_inserted=%)',
      v_rpc_version, v_post_models, v_serv_count, v_inv_count, v_models_count, v_model_items_count, v_map_count;
  end if;
  if v_post_map <> v_src_map_distinct then
    raise exception 'Importação inválida [v%]: service_mapping esperado %, obtido % (tpl_total=%; tpl_distinct=%; tpl_join_tmp=%; tmp_serv=%; tmp_model=%; tmp_inv=%; map_inserted=%; servicos_inserted=%; models_inserted=%)',
      v_rpc_version, v_src_map_distinct, v_post_map, v_src_map_count, v_src_map_distinct, v_src_map_join_count, v_dbg_tmp_serv, v_dbg_tmp_model, v_dbg_tmp_inv, v_map_count, v_serv_count, v_models_count;
  end if;

  execute format(
    'select count(*) from ( ' ||
    '  select distinct mm.new_id::text as model_id_new, im.new_id::text as inventory_id_new ' ||
    '  from public.%I t ' ||
    '  join tmp_model_map mm on btrim(mm.old_id) = btrim(t.model_id::text) ' ||
    '  join tmp_inv_map im on btrim(im.old_id) = btrim(t.inventory_id::text) ' ||
    ') x',
    v_tpl_model_items
  ) into v_expected_mi;
  if coalesce(v_expected_mi, 0) = 0 then
    execute format(
      'select count(*) from (select distinct model_id::text, inventory_id::text from public.%I) z',
      v_tpl_model_items
    ) into v_expected_mi;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'model_items'
      and column_name = 'empresa_id'
  ) then
    execute
      'select count(*) from public.model_items where empresa_id::text = $1'
    into v_actual_mi
    using v_emp;
    execute
      'select count(*) ' ||
      'from public.model_items mi ' ||
      'join public.usage_models um on um.id::text = mi.model_id::text ' ||
      'where um.empresa_id::text = $1'
    into v_post_mi
    using v_emp;
    v_actual_mi := greatest(coalesce(v_actual_mi, 0), coalesce(v_post_mi, 0));
  else
    execute
      'select count(*) ' ||
      'from public.model_items mi ' ||
      'join public.usage_models um on um.id::text = mi.model_id::text ' ||
      'where um.empresa_id::text = $1'
    into v_actual_mi
    using v_emp;
  end if;

  if v_expected_mi <> v_actual_mi then
    raise exception 'Falha na integridade da importação: Esperados % itens, mas foram inseridos %. Operação cancelada para evitar kits vazios.', v_expected_mi, v_actual_mi;
  end if;

  insert into public.occ_empresa_imports(empresa_id, kind, imported_by)
  values (v_emp, 'default_templates_v1', v_uid);

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'servicos', v_serv_count,
    'inventory', v_inv_count,
    'usage_models', v_models_count,
    'model_items', v_model_items_count,
    'service_mapping', v_map_count
  );
end;
$$;

notify pgrst, 'reload schema';
