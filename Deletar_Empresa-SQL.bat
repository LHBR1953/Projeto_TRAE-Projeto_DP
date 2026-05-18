begin;

-- Desativa FK/triggers apenas nesta transação
set local session_replication_role = replica;

do $$
declare
  v_empresa_id text := 'emp_d094a34ae3'; -- << TROQUE AQUI >>
  r record;
begin
  if trim(coalesce(v_empresa_id, '')) = '' then
    raise exception 'empresa_id inválido';
  end if;

  -- 1) Apaga em TODAS as tabelas BASE TABLE com empresa_id/id_empresa (exceto empresas)
  for r in
    select t.table_name,
           case
             when exists (
               select 1
               from information_schema.columns c2
               where c2.table_schema='public'
                 and c2.table_name=t.table_name
                 and c2.column_name='empresa_id'
             ) then 'empresa_id'
             else 'id_empresa'
           end as company_col
    from information_schema.tables t
    where t.table_schema='public'
      and t.table_type='BASE TABLE'
      and t.table_name <> 'empresas'
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema='public'
          and c.table_name=t.table_name
          and c.column_name in ('empresa_id','id_empresa')
      )
    order by t.table_name
  loop
    execute format(
      'delete from public.%I where %I::text = $1',
      r.table_name, r.company_col
    ) using v_empresa_id;
  end loop;

  -- 2) Segurança extra: tabelas que podem ter referência sem empresa_id
  if to_regclass('public.inventory_logs') is not null then
    execute '
      delete from public.inventory_logs
      where coalesce(empresa_id::text, '''') = $1
         or coalesce(atendimento_id::text, '''') in (
           select id::text from public.agenda_agendamentos where empresa_id::text = $1
         )
    ' using v_empresa_id;
  end if;

  if to_regclass('public.model_items') is not null and to_regclass('public.usage_models') is not null then
    execute '
      delete from public.model_items
      where model_id::text in (
        select id::text from public.usage_models where empresa_id::text = $1
      )
    ' using v_empresa_id;
  end if;

  if to_regclass('public.service_mapping') is not null and to_regclass('public.servicos') is not null then
    -- sem assumir empresa_id em service_mapping
    execute '
      delete from public.service_mapping
      where service_id::text in (
        select id::text from public.servicos where empresa_id::text = $1
      )
    ' using v_empresa_id;
  end if;

  -- 3) Remove empresa
  delete from public.empresas where id::text = v_empresa_id;
end
$$;

commit;