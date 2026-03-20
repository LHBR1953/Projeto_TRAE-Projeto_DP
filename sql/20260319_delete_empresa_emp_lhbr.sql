begin;

do $$
declare
  v_target text := 'emp_lhbr';
  v_keep text := 'emp_occ';
  v_cnt bigint;
  r record;
  v_left_tables text;
begin
  if not exists (select 1 from public.empresas where id = v_target) then
    raise exception 'Empresa % não existe.', v_target;
  end if;

  if not exists (select 1 from public.empresas where id = v_keep) then
    raise exception 'Empresa % (keep) não existe.', v_keep;
  end if;

  if not exists (
    select 1
    from public.usuario_empresas ue
    join auth.users u on u.id = ue.usuario_id
    where ue.empresa_id = v_keep
      and u.email = 'lhbr@lhbr.com.br'
      and ue.perfil = 'admin'
  ) then
    raise exception 'Superadmin lhbr@lhbr.com.br não está como admin em %.', v_keep;
  end if;

  create temporary table if not exists occ_emp_delete_scan (
    phase text not null,
    table_name text not null,
    row_count bigint not null
  ) on commit drop;

  delete from occ_emp_delete_scan;

  for r in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'empresa_id'
      and c.table_name <> 'empresas'
      and to_regclass('public.' || c.table_name) is not null
    order by c.table_name
  loop
    execute format('select count(*) from public.%I where empresa_id = $1', r.table_name) into v_cnt using v_target;
    if coalesce(v_cnt, 0) > 0 then
      insert into occ_emp_delete_scan(phase, table_name, row_count) values ('before', r.table_name, v_cnt);
    end if;
  end loop;

  select string_agg(table_name || '=' || row_count::text, ', ' order by table_name)
  into v_left_tables
  from occ_emp_delete_scan
  where phase = 'before';
  raise notice 'Empresa %: registros antes do delete: %', v_target, coalesce(v_left_tables, '(nenhum)');

  if to_regclass('public.orcamento_itens') is not null then
    execute 'delete from public.orcamento_itens where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.orcamento_pagamentos') is not null then
    execute 'delete from public.orcamento_pagamentos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.orcamento_cancelados') is not null then
    execute 'delete from public.orcamento_cancelados where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.financeiro_comissoes') is not null then
    execute 'delete from public.financeiro_comissoes where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.financeiro_transacoes') is not null then
    execute 'delete from public.financeiro_transacoes where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.agenda_agendamentos') is not null then
    execute 'delete from public.agenda_agendamentos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.agenda_disponibilidade') is not null then
    execute 'delete from public.agenda_disponibilidade where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.paciente_documentos') is not null then
    execute 'delete from public.paciente_documentos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.paciente_evolucao') is not null then
    execute 'delete from public.paciente_evolucao where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.ordens_proteticas_anexos') is not null then
    execute 'delete from public.ordens_proteticas_anexos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.ordens_proteticas_eventos') is not null then
    execute 'delete from public.ordens_proteticas_eventos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.ordens_proteticas') is not null then
    execute 'delete from public.ordens_proteticas where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.laboratorios_proteticos') is not null then
    execute 'delete from public.laboratorios_proteticos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.orcamentos') is not null then
    execute 'delete from public.orcamentos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.pacientes') is not null then
    execute 'delete from public.pacientes where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.profissionais') is not null then
    execute 'delete from public.profissionais where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.especialidade_subdivisoes') is not null then
    execute 'delete from public.especialidade_subdivisoes where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.especialidades') is not null then
    execute 'delete from public.especialidades where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  if to_regclass('public.servicos') is not null then
    execute 'delete from public.servicos where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  execute 'delete from public.usuario_empresas where empresa_id = $1' using v_target;
  get diagnostics v_cnt = row_count;

  execute 'delete from public.empresas where id = $1' using v_target;
  get diagnostics v_cnt = row_count;

  if to_regclass('public.occ_audit_log') is not null then
    execute 'delete from public.occ_audit_log where empresa_id = $1' using v_target;
    get diagnostics v_cnt = row_count;
  end if;

  delete from occ_emp_delete_scan;
  for r in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'empresa_id'
      and c.table_name <> 'empresas'
      and to_regclass('public.' || c.table_name) is not null
    order by c.table_name
  loop
    execute format('select count(*) from public.%I where empresa_id = $1', r.table_name) into v_cnt using v_target;
    if coalesce(v_cnt, 0) > 0 then
      insert into occ_emp_delete_scan(phase, table_name, row_count) values ('after', r.table_name, v_cnt);
    end if;
  end loop;

  if exists (select 1 from occ_emp_delete_scan where phase = 'after') then
    select string_agg(table_name || '=' || row_count::text, ', ' order by table_name)
    into v_left_tables
    from occ_emp_delete_scan
    where phase = 'after';
    raise exception 'Não foi possível remover 100%% da empresa %. Restaram registros em: %', v_target, v_left_tables;
  end if;
end $$;

commit;

