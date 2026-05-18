begin;

do $$
declare
  v_emp text := '';
  v_hint text := 'gemini';
  v_confirm text := 'RESET GEMINI';
  v_table text := '';
begin
  if v_emp = '' then
    v_table := case
      when to_regclass('public.occ_empresas') is not null then 'occ_empresas'
      when to_regclass('public.empresas') is not null then 'empresas'
      else ''
    end;
    if v_table = '' then
      raise exception 'Tabela de empresas não encontrada (empresas/occ_empresas).';
    end if;
    if v_table = 'occ_empresas' then
      execute format(
        'select id::text from public.%I where lower(nome) like %L or lower(identificador) like %L limit 1',
        v_table,
        '%' || lower(v_hint) || '%',
        '%' || lower(v_hint) || '%'
      ) into v_emp;
    else
      execute format(
        'select id::text from public.%I where lower(nome) like %L or lower(identificador) like %L limit 1',
        v_table,
        '%' || lower(v_hint) || '%',
        '%' || lower(v_hint) || '%'
      ) into v_emp;
    end if;
  end if;

  if v_emp is null or btrim(v_emp) = '' then
    raise exception 'Empresa alvo não encontrada. Rode: select id,nome,identificador from public.empresas where lower(nome) like %L or lower(identificador) like %L;',
      '%gemini%', '%gemini%';
  end if;

  if v_confirm not in ('RESET GEMINI', ('RESET ' || v_emp)) then
    raise exception 'Confirmação inválida. Use v_confirm = ''RESET GEMINI'' ou ''RESET %''.', v_emp;
  end if;

  if to_regclass('public.service_mapping') is not null then
    delete from public.service_mapping sm
    where exists (
      select 1 from public.servicos s
      where s.id = sm.service_id
        and s.empresa_id::text = v_emp
    )
    or exists (
      select 1 from public.usage_models um
      where um.id = sm.model_id
        and um.empresa_id::text = v_emp
    );
  end if;

  if to_regclass('public.model_items') is not null then
    delete from public.model_items mi
    where exists (
      select 1 from public.usage_models um
      where um.id = mi.model_id
        and um.empresa_id::text = v_emp
    )
    or exists (
      select 1 from public.inventory i
      where i.id = mi.inventory_id
        and i.empresa_id::text = v_emp
    );
  end if;

  if to_regclass('public.inventory_logs') is not null then
    delete from public.inventory_logs where empresa_id::text = v_emp;
  end if;

  if to_regclass('public.usage_models') is not null then
    delete from public.usage_models where empresa_id::text = v_emp;
  end if;

  if to_regclass('public.inventory') is not null then
    delete from public.inventory where empresa_id::text = v_emp;
  end if;

  if to_regclass('public.servicos') is not null then
    delete from public.servicos where empresa_id::text = v_emp;
  end if;

  if to_regclass('public.occ_empresa_imports') is not null then
    delete from public.occ_empresa_imports where empresa_id::text = v_emp;
  end if;
end $$;

commit;
