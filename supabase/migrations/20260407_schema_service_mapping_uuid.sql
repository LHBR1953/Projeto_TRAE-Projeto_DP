do $$
declare
  v_serv_id_uuid boolean := false;
  v_model_id_uuid boolean := false;
  v_map_serv_uuid boolean := false;
  v_map_model_uuid boolean := false;
begin
  if to_regclass('public.servicos') is null or to_regclass('public.usage_models') is null or to_regclass('public.service_mapping') is null then
    raise exception 'Tabelas servicos/usage_models/service_mapping ausentes para padronização de tipos.';
  end if;

  select (c.udt_name = 'uuid')
    into v_serv_id_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'servicos' and c.column_name = 'id';

  select (c.udt_name = 'uuid')
    into v_model_id_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'usage_models' and c.column_name = 'id';

  select (c.udt_name = 'uuid')
    into v_map_serv_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'service_id';

  select (c.udt_name = 'uuid')
    into v_map_model_uuid
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'service_mapping' and c.column_name = 'model_id';

  if v_serv_id_uuid and not v_map_serv_uuid then
    alter table public.service_mapping
      alter column service_id type uuid using service_id::uuid;
  end if;

  if v_model_id_uuid and not v_map_model_uuid then
    alter table public.service_mapping
      alter column model_id type uuid using model_id::uuid;
  end if;
end $$;

notify pgrst, 'reload schema';
