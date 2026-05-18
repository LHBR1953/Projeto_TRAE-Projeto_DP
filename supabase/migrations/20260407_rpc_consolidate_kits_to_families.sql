create or replace function public.rpc_consolidate_kits_to_families(p_empresa_id text)
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
  v_has_sm_emp boolean := false;
  v_has_mi_emp boolean := false;
  v_map_serv_uuid boolean := false;
  v_map_model_uuid boolean := false;
  v_mi_model_uuid boolean := false;
  v_mi_inv_uuid boolean := false;
  v_has_serv_emp boolean := false;
  v_biosseg uuid;
  v_dent uuid;
  v_endo uuid;
  v_exo uuid;
  v_perio uuid;
  v_radio uuid;
  v_prot uuid;
  v_orto uuid;
  v_impl uuid;
  v_hof uuid;
  v_diag uuid;
  v_ins_models int := 0;
  v_ins_map int := 0;
  v_ins_items int := 0;
  v_del_models int := 0;
  v_rc int := 0;
  v_sql text;
  v_inv_filme uuid;
  v_inv_espelho uuid;
  v_inv_pinca uuid;
  v_inv_sonda uuid;
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
      raise exception 'Sem permissão para esta empresa.';
    end if;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='service_mapping' and column_name='empresa_id'
  ) into v_has_sm_emp;
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='model_items' and column_name='empresa_id'
  ) into v_has_mi_emp;
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='servicos' and column_name='empresa_id'
  ) into v_has_serv_emp;
  select (udt_name = 'uuid')
    into v_map_serv_uuid
  from information_schema.columns
  where table_schema='public' and table_name='service_mapping' and column_name='service_id';
  select (udt_name = 'uuid')
    into v_map_model_uuid
  from information_schema.columns
  where table_schema='public' and table_name='service_mapping' and column_name='model_id';
  select (udt_name = 'uuid')
    into v_mi_model_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='model_id';
  select (udt_name = 'uuid')
    into v_mi_inv_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items' and column_name='inventory_id';

  create temporary table tmp_fam(name text primary key, mid uuid, include_biosseg boolean) on commit drop;
  insert into tmp_fam(name, include_biosseg) values
    ('Kit Biossegurança', true),
    ('Kit Dentística', true),
    ('Kit Endodontia', true),
    ('Kit Exodontia', true),
    ('Kit Periodontia', true),
    ('Kit Radiologia', true),
    ('Kit Prótese', true),
    ('Kit Ortodontia', true),
    ('Kit Implantodontia', true),
    ('Kit Harmonização Facial', true),
    ('Kit Diagnóstico', true);

  update public.usage_models
  set nome_modelo = 'Kit Implantodontia'
  where empresa_id = v_emp
    and upper(btrim(nome_modelo)) = upper('Kit Implante');

  update public.usage_models
  set nome_modelo = 'Kit Harmonização Facial'
  where empresa_id = v_emp
    and upper(btrim(nome_modelo)) = upper('Kit HOF');

  update tmp_fam f
     set mid = u.id
  from public.usage_models u
  where u.empresa_id = v_emp
    and upper(btrim(u.nome_modelo)) = upper(btrim(f.name));

  insert into public.usage_models(id, empresa_id, nome_modelo, include_biosseguranca)
  select gen_random_uuid(), v_emp, f.name, f.include_biosseg
  from tmp_fam f
  where f.mid is null;
  get diagnostics v_ins_models = row_count;

  update tmp_fam f
     set mid = u.id
  from public.usage_models u
  where u.empresa_id = v_emp
    and upper(btrim(u.nome_modelo)) = upper(btrim(f.name));

  select mid into v_biosseg from tmp_fam where name='Kit Biossegurança';
  select mid into v_dent from tmp_fam where name='Kit Dentística';
  select mid into v_endo from tmp_fam where name='Kit Endodontia';
  select mid into v_exo from tmp_fam where name='Kit Exodontia';
  select mid into v_perio from tmp_fam where name='Kit Periodontia';
  select mid into v_radio from tmp_fam where name='Kit Radiologia';
  select mid into v_prot from tmp_fam where name='Kit Prótese';
  select mid into v_orto from tmp_fam where name='Kit Ortodontia';
  select mid into v_impl from tmp_fam where name='Kit Implantodontia';
  select mid into v_hof from tmp_fam where name='Kit Harmonização Facial';
  select mid into v_diag from tmp_fam where name='Kit Diagnóstico';

  create temporary table tmp_service_family(service_id text primary key, family_model_id uuid) on commit drop;
  insert into tmp_service_family(service_id, family_model_id)
  select
    s.id::text,
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
    end
  from public.servicos s
  where s.empresa_id = v_emp;

  create temporary table tmp_prev_map(service_id text primary key, old_model_id text) on commit drop;
  if v_has_sm_emp then
    v_sql := '
      insert into tmp_prev_map(service_id, old_model_id)
      select sm.service_id::text, sm.model_id::text
      from public.service_mapping sm
      join tmp_service_family sf on sf.service_id = sm.service_id::text
      where sm.empresa_id::text = $1
    ';
    execute v_sql using v_emp;
  else
    insert into tmp_prev_map(service_id, old_model_id)
    select sm.service_id::text, sm.model_id::text
    from public.service_mapping sm
    join tmp_service_family sf on sf.service_id = sm.service_id::text;
  end if;

  create temporary table tmp_prev_models(model_id text) on commit drop;
  insert into tmp_prev_models(model_id)
  select distinct old_model_id
  from tmp_prev_map
  where old_model_id is not null and btrim(old_model_id) <> '';

  if v_has_sm_emp then
    delete from public.service_mapping sm
    where sm.empresa_id::text = v_emp;

    v_sql := format(
      'insert into public.service_mapping(service_id, model_id, empresa_id)
       select %s, %s, $1
       from tmp_service_family sf
       on conflict do nothing',
      case when v_map_serv_uuid then 'sf.service_id::uuid' else 'sf.service_id' end,
      case when v_map_model_uuid then 'sf.family_model_id' else 'sf.family_model_id::text' end
    );
    execute v_sql using v_emp;
  else
    delete from public.service_mapping sm
    using tmp_service_family sf
    where sm.service_id::text = sf.service_id;

    v_sql := format(
      'insert into public.service_mapping(service_id, model_id)
       select %s, %s
       from tmp_service_family sf
       on conflict do nothing',
      case when v_map_serv_uuid then 'sf.service_id::uuid' else 'sf.service_id' end,
      case when v_map_model_uuid then 'sf.family_model_id' else 'sf.family_model_id::text' end
    );
    execute v_sql;
  end if;
  get diagnostics v_ins_map = row_count;

  if v_has_sm_emp then
    v_sql := '
      delete from public.model_items mi
      where mi.empresa_id::text = $1
        and mi.model_id::text not in ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        and not exists (
          select 1
          from public.service_mapping sm
          join public.servicos s on s.id = sm.service_id
          where sm.model_id::text = mi.model_id::text
            and sm.empresa_id::text = $1
            and s.empresa_id = $1
        )
    ';
    execute v_sql using v_emp,
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
  else
    v_sql := '
      delete from public.model_items mi
      where mi.model_id::text not in ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        and (
          (select true) is true
        )
        and not exists (
          select 1
          from public.service_mapping sm
          join public.servicos s on s.id = sm.service_id
          where sm.model_id::text = mi.model_id::text
            and s.empresa_id = $12
        )
    ';
    execute v_sql using
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text, v_emp;
  end if;

  if v_has_sm_emp then
    v_sql := '
      delete from public.model_items mi
      where mi.empresa_id::text = $1
        and mi.model_id::text not in ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        and not exists (
          select 1
          from public.service_mapping sm
          where sm.model_id::text = mi.model_id::text
            and sm.empresa_id::text = $1
        )
    ';
    execute v_sql using v_emp,
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
  else
    v_sql := '
      delete from public.model_items mi
      where mi.model_id::text not in ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        and not exists (
          select 1
          from public.service_mapping sm
          where sm.model_id::text = mi.model_id::text
        )
    ';
    execute v_sql using
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
  end if;

  if v_has_sm_emp then
    v_sql := '
      delete from public.usage_models um
      where um.empresa_id = $1
        and um.id::text not in ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        and not exists (
          select 1
          from public.service_mapping sm
          join public.servicos s on s.id = sm.service_id
          where sm.model_id::text = um.id::text
            and sm.empresa_id::text = $1
            and s.empresa_id = $1
        )
    ';
    execute v_sql using v_emp,
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
    get diagnostics v_rc = row_count;
    v_del_models := v_del_models + v_rc;
  else
    v_sql := '
      delete from public.usage_models um
      where um.empresa_id = $12
        and um.id::text not in ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        and not exists (
          select 1
          from public.service_mapping sm
          join public.servicos s on s.id = sm.service_id
          where sm.model_id::text = um.id::text
            and s.empresa_id = $12
        )
    ';
    execute v_sql using
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text, v_emp;
    get diagnostics v_rc = row_count;
    v_del_models := v_del_models + v_rc;
  end if;

  select id into v_inv_filme
  from public.inventory
  where empresa_id = v_emp and lower(nome) like '%filme%'
  order by length(nome)
  limit 1;
  if v_inv_filme is null then
    insert into public.inventory(id, empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
    values (gen_random_uuid(), v_emp, 'FILME RADIOGRAFIA (UN)', 'un', 'un', 1, 0, 0, 'consumiveis', 'Raio-X', 'Raio-X', true, true)
    returning id into v_inv_filme;
  end if;

  select id into v_inv_espelho
  from public.inventory
  where empresa_id = v_emp and lower(nome) like '%espelho%'
  order by length(nome)
  limit 1;
  if v_inv_espelho is null then
    insert into public.inventory(id, empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
    values (gen_random_uuid(), v_emp, 'ESPELHO CLÍNICO (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true)
    returning id into v_inv_espelho;
  end if;

  select id into v_inv_pinca
  from public.inventory
  where empresa_id = v_emp and (lower(nome) like '%pinça%' or lower(nome) like '%pinca%')
  order by length(nome)
  limit 1;
  if v_inv_pinca is null then
    insert into public.inventory(id, empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
    values (gen_random_uuid(), v_emp, 'PINÇA CLÍNICA (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true)
    returning id into v_inv_pinca;
  end if;

  select id into v_inv_sonda
  from public.inventory
  where empresa_id = v_emp and (lower(nome) like '%sonda%' or lower(nome) like '%explor%')
  order by length(nome)
  limit 1;
  if v_inv_sonda is null then
    insert into public.inventory(id, empresa_id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria, eh_consumivel, ativo)
    values (gen_random_uuid(), v_emp, 'SONDA EXPLORADORA (UN)', 'un', 'un', 1, 0, 0, 'instrumentais', 'Diagnóstico', 'Diagnóstico', false, true)
    returning id into v_inv_sonda;
  end if;

  if v_has_mi_emp then
    v_sql := '
      insert into public.model_items(model_id, inventory_id, quantidade_sugerida, empresa_id)
      select $2, $3, 1, $1
      where not exists (select 1 from public.model_items mi where mi.empresa_id::text = $1 and mi.model_id::text = $2::text and mi.inventory_id::text = $3::text)
    ';
    execute v_sql using v_emp, v_radio, v_inv_filme;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;

    execute v_sql using v_emp, v_diag, v_inv_espelho;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
    execute v_sql using v_emp, v_diag, v_inv_pinca;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
    execute v_sql using v_emp, v_diag, v_inv_sonda;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
  else
    v_sql := '
      insert into public.model_items(model_id, inventory_id, quantidade_sugerida)
      select $1, $2, 1
      where not exists (select 1 from public.model_items mi where mi.model_id::text = $1::text and mi.inventory_id::text = $2::text)
    ';
    execute v_sql using v_radio, v_inv_filme;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;

    execute v_sql using v_diag, v_inv_espelho;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
    execute v_sql using v_diag, v_inv_pinca;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
    execute v_sql using v_diag, v_inv_sonda;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;
  end if;

  create temporary table tmp_items_to_merge(family_model_id uuid, inventory_id uuid, qtd numeric) on commit drop;
  if v_has_mi_emp then
    v_sql := '
      insert into tmp_items_to_merge(family_model_id, inventory_id, qtd)
      select
        sf.family_model_id,
        mi.inventory_id,
        max(coalesce(mi.quantidade_sugerida, 1))
      from tmp_service_family sf
      join tmp_prev_map pm on pm.service_id = sf.service_id
      join public.model_items mi on mi.model_id::text = pm.old_model_id
      where pm.old_model_id in (select model_id from tmp_prev_models)
        and mi.empresa_id::text = $1
      group by sf.family_model_id, mi.inventory_id
    ';
    execute v_sql using v_emp;
  else
    insert into tmp_items_to_merge(family_model_id, inventory_id, qtd)
    select
      sf.family_model_id,
      mi.inventory_id,
      max(coalesce(mi.quantidade_sugerida, 1))
    from tmp_service_family sf
    join tmp_prev_map pm on pm.service_id = sf.service_id
    join public.model_items mi on mi.model_id::text = pm.old_model_id
    where pm.old_model_id in (select model_id from tmp_prev_models)
    group by sf.family_model_id, mi.inventory_id;
  end if;

  if v_has_mi_emp then
    v_sql := format(
      'insert into public.model_items(model_id, inventory_id, quantidade_sugerida, empresa_id)
       select %s, %s, t.qtd, $1
       from tmp_items_to_merge t
       where not exists (
         select 1 from public.model_items mi
         where mi.model_id::text = (%s)::text
           and mi.inventory_id::text = (%s)::text
           and mi.empresa_id::text = $1
       )',
      case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
      case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end,
      case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
      case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end
    );
    execute v_sql using v_emp;
  else
    v_sql := format(
      'insert into public.model_items(model_id, inventory_id, quantidade_sugerida)
       select %s, %s, t.qtd
       from tmp_items_to_merge t
       where not exists (
         select 1 from public.model_items mi
         where mi.model_id::text = (%s)::text
           and mi.inventory_id::text = (%s)::text
       )',
      case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
      case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end,
      case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
      case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end
    );
    execute v_sql;
  end if;
  get diagnostics v_ins_items = row_count;

  create temporary table tmp_orphan_models(model_id text primary key, family_model_id uuid) on commit drop;
  if v_has_sm_emp then
    v_sql := $SQL$
      insert into tmp_orphan_models(model_id, family_model_id)
      select
        um.id::text,
        case
          when lower(coalesce(um.nome_modelo,'')) like '%biosseg%' then $2
          when lower(coalesce(um.nome_modelo,'')) like '%radio%' or lower(coalesce(um.nome_modelo,'')) like '%raio%' or lower(coalesce(um.nome_modelo,'')) like '%radiograf%' then $3
          when lower(coalesce(um.nome_modelo,'')) like '%implan%' then $4
          when lower(coalesce(um.nome_modelo,'')) like '%orto%' then $5
          when lower(coalesce(um.nome_modelo,'')) like '%prót%' or lower(coalesce(um.nome_modelo,'')) like '%prot%' then $6
          when lower(coalesce(um.nome_modelo,'')) like '%endo%' or lower(coalesce(um.nome_modelo,'')) like '%canal%' then $7
          when lower(coalesce(um.nome_modelo,'')) like '%perio%' or lower(coalesce(um.nome_modelo,'')) like '%rasp%' then $8
          when lower(coalesce(um.nome_modelo,'')) like '%exodont%' or lower(coalesce(um.nome_modelo,'')) like '%extra%' or lower(coalesce(um.nome_modelo,'')) like '%cirurg%' then $9
          when lower(coalesce(um.nome_modelo,'')) like '%hof%' or lower(coalesce(um.nome_modelo,'')) like '%harmon%' or lower(coalesce(um.nome_modelo,'')) like '%botox%' or lower(coalesce(um.nome_modelo,'')) like '%preench%' then $10
          when lower(coalesce(um.nome_modelo,'')) like '%avalia%' or lower(coalesce(um.nome_modelo,'')) like '%consulta%' or lower(coalesce(um.nome_modelo,'')) like '%diagn%' then $11
          else $12
        end
      from public.usage_models um
      where um.empresa_id = $1
        and um.id::text not in ($2::text,$12::text,$7::text,$9::text,$8::text,$3::text,$6::text,$5::text,$4::text,$10::text,$11::text)
        and not exists (
          select 1
          from public.service_mapping sm
          where sm.model_id::text = um.id::text
            and sm.empresa_id::text = $1
        )
    $SQL$;
    execute v_sql using v_emp, v_biosseg, v_radio, v_impl, v_orto, v_prot, v_endo, v_exo, v_perio, v_hof, v_diag, v_dent;
  else
    v_sql := $SQL$
      insert into tmp_orphan_models(model_id, family_model_id)
      select
        um.id::text,
        case
          when lower(coalesce(um.nome_modelo,'')) like '%biosseg%' then $1
          when lower(coalesce(um.nome_modelo,'')) like '%radio%' or lower(coalesce(um.nome_modelo,'')) like '%raio%' or lower(coalesce(um.nome_modelo,'')) like '%radiograf%' then $2
          when lower(coalesce(um.nome_modelo,'')) like '%implan%' then $3
          when lower(coalesce(um.nome_modelo,'')) like '%orto%' then $4
          when lower(coalesce(um.nome_modelo,'')) like '%prót%' or lower(coalesce(um.nome_modelo,'')) like '%prot%' then $5
          when lower(coalesce(um.nome_modelo,'')) like '%endo%' or lower(coalesce(um.nome_modelo,'')) like '%canal%' then $6
          when lower(coalesce(um.nome_modelo,'')) like '%perio%' or lower(coalesce(um.nome_modelo,'')) like '%rasp%' then $7
          when lower(coalesce(um.nome_modelo,'')) like '%exodont%' or lower(coalesce(um.nome_modelo,'')) like '%extra%' or lower(coalesce(um.nome_modelo,'')) like '%cirurg%' then $8
          when lower(coalesce(um.nome_modelo,'')) like '%hof%' or lower(coalesce(um.nome_modelo,'')) like '%harmon%' or lower(coalesce(um.nome_modelo,'')) like '%botox%' or lower(coalesce(um.nome_modelo,'')) like '%preench%' then $9
          when lower(coalesce(um.nome_modelo,'')) like '%avalia%' or lower(coalesce(um.nome_modelo,'')) like '%consulta%' or lower(coalesce(um.nome_modelo,'')) like '%diagn%' then $10
          else $11
        end
      from public.usage_models um
      where um.empresa_id = $12
        and um.id::text not in ($1::text,$11::text,$6::text,$8::text,$7::text,$2::text,$5::text,$4::text,$3::text,$9::text,$10::text)
        and not exists (
          select 1
          from public.service_mapping sm
          where sm.model_id::text = um.id::text
        )
    $SQL$;
    execute v_sql using v_biosseg, v_radio, v_impl, v_orto, v_prot, v_endo, v_perio, v_exo, v_hof, v_diag, v_dent, v_emp;
  end if;

  if exists (select 1 from tmp_orphan_models) then
    create temporary table tmp_orphan_items(family_model_id uuid, inventory_id uuid, qtd numeric) on commit drop;
    if v_has_mi_emp then
      v_sql := '
        insert into tmp_orphan_items(family_model_id, inventory_id, qtd)
        select
          o.family_model_id,
          mi.inventory_id,
          max(coalesce(mi.quantidade_sugerida, 1))
        from tmp_orphan_models o
        join public.model_items mi on mi.model_id::text = o.model_id
        where mi.empresa_id::text = $1
        group by o.family_model_id, mi.inventory_id
      ';
      execute v_sql using v_emp;
    else
      insert into tmp_orphan_items(family_model_id, inventory_id, qtd)
      select
        o.family_model_id,
        mi.inventory_id,
        max(coalesce(mi.quantidade_sugerida, 1))
      from tmp_orphan_models o
      join public.model_items mi on mi.model_id::text = o.model_id
      group by o.family_model_id, mi.inventory_id;
    end if;

    if v_has_mi_emp then
      v_sql := format(
        'insert into public.model_items(model_id, inventory_id, quantidade_sugerida, empresa_id)
         select %s, %s, t.qtd, $1
         from tmp_orphan_items t
         where not exists (
           select 1
           from public.model_items mi
           where mi.model_id::text = (%s)::text
             and mi.inventory_id::text = (%s)::text
             and mi.empresa_id::text = $1
         )',
        case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
        case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end,
        case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
        case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end
      );
      execute v_sql using v_emp;
    else
      v_sql := format(
        'insert into public.model_items(model_id, inventory_id, quantidade_sugerida)
         select %s, %s, t.qtd
         from tmp_orphan_items t
         where not exists (
           select 1
           from public.model_items mi
           where mi.model_id::text = (%s)::text
             and mi.inventory_id::text = (%s)::text
         )',
        case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
        case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end,
        case when v_mi_model_uuid then 't.family_model_id' else 't.family_model_id::text' end,
        case when v_mi_inv_uuid then 't.inventory_id' else 't.inventory_id::text' end
      );
      execute v_sql;
    end if;
    get diagnostics v_rc = row_count;
    v_ins_items := v_ins_items + v_rc;

    if v_has_mi_emp then
      v_sql := '
        delete from public.model_items mi
        where mi.empresa_id::text = $1
          and mi.model_id::text in (select model_id from tmp_orphan_models)
      ';
      execute v_sql using v_emp;
    else
      delete from public.model_items mi
      where mi.model_id::text in (select model_id from tmp_orphan_models);
    end if;

    v_sql := '
      delete from public.usage_models um
      where um.empresa_id = $1
        and um.id::text in (select model_id from tmp_orphan_models)
    ';
    execute v_sql using v_emp;
    get diagnostics v_rc = row_count;
    v_del_models := v_del_models + v_rc;
  end if;

  if v_has_mi_emp then
    v_sql := '
      delete from public.model_items mi
      where mi.model_id::text in (select model_id from tmp_prev_models)
        and mi.model_id::text not in ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        and mi.empresa_id::text = $1
    ';
    execute v_sql using v_emp,
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
  else
    delete from public.model_items mi
    where mi.model_id::text in (select model_id from tmp_prev_models)
      and mi.model_id::text not in (v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text);
  end if;

  if v_has_sm_emp then
    v_sql := '
      delete from public.usage_models um
      where um.empresa_id = $1
        and um.id::text in (select model_id from tmp_prev_models)
        and um.id::text not in ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        and not exists (
          select 1 from public.service_mapping sm
          where sm.model_id = um.id
            and sm.empresa_id::text = $1
        )
    ';
    execute v_sql using v_emp,
      v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text;
  else
    delete from public.usage_models um
    where um.empresa_id = v_emp
      and um.id::text in (select model_id from tmp_prev_models)
      and um.id::text not in (v_biosseg::text, v_dent::text, v_endo::text, v_exo::text, v_perio::text, v_radio::text, v_prot::text, v_orto::text, v_impl::text, v_hof::text, v_diag::text)
      and not exists (
        select 1 from public.service_mapping sm
        where sm.model_id = um.id
      );
  end if;
  get diagnostics v_del_models = row_count;

  return json_build_object(
    'ok', true,
    'empresa_id', v_emp,
    'inserted_family_models', v_ins_models,
    'inserted_service_mapping', v_ins_map,
    'merged_model_items', v_ins_items,
    'deleted_old_models', v_del_models
  );
end;
$$;

notify pgrst, 'reload schema';
