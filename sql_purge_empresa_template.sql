begin;

do $$
declare
  v_empresa_id text := 'emp_EXEMPLO';
  v_confirm text := 'DELETE emp_EXEMPLO';
  v_tbl text;
  v_tables text[] := array[
    'occ_audit_log',
    'auditoria_log',
    'marketing_envios',
    'marketing_campanhas',
    'marketing_smtp_config',
    'inventory_logs',
    'inventory',
    'usage_models',
    'ordens_proteticas_anexos',
    'ordens_proteticas_eventos',
    'ordens_proteticas_custodia_eventos',
    'ordens_proteticas_custodia_tokens',
    'protese_contas_pagas',
    'protese_contas_pagar',
    'ordens_proteticas',
    'laboratorios_proteticos',
    'financeiro_comissoes',
    'financeiro_transacoes',
    'orcamento_pagamentos',
    'orcamento_itens',
    'orcamento_cancelados',
    'orcamentos',
    'paciente_documentos',
    'paciente_evolucao',
    'profissional_usuarios',
    'agenda_agendamentos',
    'agenda_disponibilidade',
    'pacientes',
    'servicos',
    'especialidade_subdivisoes',
    'profissionais',
    'especialidades',
    'usuario_empresas'
  ];
  r record;
  pass int;
  rowcount bigint;
  progress boolean;
  v_left text;
begin
  if v_confirm <> ('DELETE ' || v_empresa_id) then
    raise exception 'Confirmação inválida. Ajuste v_empresa_id e v_confirm.';
  end if;

  if v_empresa_id is null or length(trim(v_empresa_id)) = 0 then
    raise exception 'empresa_id inválido.';
  end if;

  if v_empresa_id in ('emp_master') then
    raise exception 'Operação bloqueada para empresa_id reservado.';
  end if;

  if to_regclass('public.service_mapping') is not null then
    execute '
      delete from public.service_mapping sm
      where exists (
        select 1
        from public.servicos s
        where s.id = sm.service_id
          and s.empresa_id = $1
      )
      or exists (
        select 1
        from public.usage_models um
        where um.id = sm.model_id
          and um.empresa_id = $1
      )
    ' using v_empresa_id;
  end if;

  if to_regclass('public.model_items') is not null then
    execute '
      delete from public.model_items mi
      where exists (
        select 1
        from public.usage_models um
        where um.id = mi.model_id
          and um.empresa_id = $1
      )
      or exists (
        select 1
        from public.inventory i
        where i.id = mi.inventory_id
          and i.empresa_id = $1
      )
    ' using v_empresa_id;
  end if;

  foreach v_tbl in array v_tables loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('delete from public.%I where empresa_id = %L', v_tbl, v_empresa_id);
    end if;
  end loop;

  for pass in 1..6 loop
    progress := false;
    for r in
      select distinct table_name
      from information_schema.columns
      where table_schema = 'public'
        and column_name = 'empresa_id'
        and table_name <> 'empresas'
    loop
      begin
        if to_regclass('public.' || r.table_name) is null then
          continue;
        end if;
        execute format('delete from public.%I where empresa_id = %L', r.table_name, v_empresa_id);
        get diagnostics rowcount = row_count;
        if rowcount > 0 then
          progress := true;
        end if;
      exception
        when foreign_key_violation then
          null;
      end;
    end loop;
    exit when not progress;
  end loop;

  execute format('delete from public.empresas where id = %L', v_empresa_id);

  v_left := null;
  for r in
    select distinct table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'empresa_id'
      and table_name <> 'empresas'
    order by table_name
  loop
    if to_regclass('public.' || r.table_name) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I where empresa_id = %L', r.table_name, v_empresa_id) into rowcount;
    if coalesce(rowcount, 0) > 0 then
      v_left := coalesce(v_left || ', ', '') || r.table_name || ':' || rowcount::text;
    end if;
  end loop;

  if v_left is not null then
    raise exception 'Limpeza incompleta. Restaram registros em: %', v_left;
  end if;
end $$;

commit;
