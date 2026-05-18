do $$
declare
  t text;
  tbls text[] := array[
    'inventory_template',
    'servicos_template',
    'usage_models_template',
    'model_items_template',
    'service_mapping_template'
  ];
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('revoke insert, update, delete on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to anon, authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
