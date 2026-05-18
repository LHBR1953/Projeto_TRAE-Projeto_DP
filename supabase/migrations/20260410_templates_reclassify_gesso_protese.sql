do $$
declare
  v_model_prot text;
  v_model_is_uuid boolean := false;
  v_updated_inv int := 0;
  v_updated_mi int := 0;
  v_sql text;
begin
  if to_regclass('public.inventory_template') is null
     or to_regclass('public.model_items_template') is null
     or to_regclass('public.usage_models_template') is null then
    raise exception 'Tabelas de template necessárias não encontradas.';
  end if;

  select id::text into v_model_prot
  from public.usage_models_template
  where lower(translate(btrim(nome_modelo), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%protese%'
  order by id::text
  limit 1;

  if v_model_prot is null then
    raise exception 'Kit Prótese não encontrado em usage_models_template.';
  end if;

  select (udt_name = 'uuid') into v_model_is_uuid
  from information_schema.columns
  where table_schema='public' and table_name='model_items_template' and column_name='model_id';

  update public.inventory_template
  set area = 'Prótese',
      categoria = 'Prótese'
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso tipo iv%'
     or lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso especial%';
  get diagnostics v_updated_inv = row_count;

  v_sql :=
    'update public.model_items_template mi ' ||
    'set model_id = ' || case when v_model_is_uuid then '$1::uuid' else '$1::text' end || ' ' ||
    'from public.inventory_template it, public.usage_models_template umt ' ||
    'where it.id::text = mi.inventory_id::text ' ||
    '  and umt.id::text = mi.model_id::text ' ||
    '  and ( ' ||
    '    lower(translate(btrim(it.nome), ''áàâãäéèêëíìîïóòôõöúùûüç'', ''aaaaaeeeeiiiiooooouuuuc'')) like ''%gesso tipo iv%'' ' ||
    '    or lower(translate(btrim(it.nome), ''áàâãäéèêëíìîïóòôõöúùûüç'', ''aaaaaeeeeiiiiooooouuuuc'')) like ''%gesso especial%'' ' ||
    '  ) ' ||
    '  and lower(translate(btrim(umt.nome_modelo), ''áàâãäéèêëíìîïóòôõöúùûüç'', ''aaaaaeeeeiiiiooooouuuuc'')) like ''%dent%'' ';
  execute v_sql using v_model_prot;
  get diagnostics v_updated_mi = row_count;

  if v_updated_inv = 0 and v_updated_mi = 0 then
    raise exception 'Nenhum item de gesso foi reclassificado no template.';
  end if;
end
$$;

notify pgrst, 'reload schema';
