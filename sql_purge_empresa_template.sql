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
end $$;

commit;
