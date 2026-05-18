do $$
declare
  v_emp text;
  v_items_count int := 0;
  v_gesso_ok int := 0;
begin
  select id::text into v_emp
  from public.empresas
  where lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like 'clinica 1%'
  order by created_at desc nulls last, id desc
  limit 1;

  if v_emp is null then
    raise exception 'Clínica 1 não encontrada.';
  end if;

  update public.inventory
  set area = 'Prótese',
      categoria = 'Prótese'
  where empresa_id::text = v_emp
    and (
      lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso tipo iv%'
      or lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso especial%'
    );

  select count(*) into v_gesso_ok
  from public.inventory
  where empresa_id::text = v_emp
    and categoria = 'Prótese'
    and area = 'Prótese'
    and (
      lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso tipo iv%'
      or lower(translate(btrim(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) like '%gesso especial%'
    );

  if v_gesso_ok = 0 then
    raise exception 'Sincronia da Clínica 1 falhou: gessos não estão classificados como Prótese.';
  end if;

  select count(*) into v_items_count
  from (
    select distinct model_id::text, inventory_id::text
    from public.model_items_template
  ) x;

  if v_items_count <> 42 then
    raise exception 'Marco Zero abortado: esperado 42 itens distintos em model_items_template, obtido %', v_items_count;
  end if;
end
$$;

create table if not exists public.template_marco_zero_usage_models_20260410 (
  id text primary key,
  nome_modelo text not null,
  include_biosseguranca boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.template_marco_zero_inventory_20260410 (
  id text primary key,
  nome text not null,
  codigo_barras text,
  unidade text,
  unidade_medida text,
  fator_conversao numeric,
  preco_custo numeric,
  estoque_minimo numeric,
  eh_consumivel boolean,
  ativo boolean,
  tipo_inventario text,
  area text,
  categoria text,
  created_at timestamptz not null default now()
);

create table if not exists public.template_marco_zero_model_items_20260410 (
  model_id text not null,
  inventory_id text not null,
  quantidade_sugerida numeric not null default 1,
  created_at timestamptz not null default now(),
  primary key (model_id, inventory_id)
);

delete from public.template_marco_zero_model_items_20260410;
delete from public.template_marco_zero_inventory_20260410;
delete from public.template_marco_zero_usage_models_20260410;

insert into public.template_marco_zero_usage_models_20260410(id, nome_modelo, include_biosseguranca)
select distinct
  um.id::text,
  um.nome_modelo,
  coalesce(um.include_biosseguranca, true)
from public.usage_models_template um
join public.model_items_template mi on mi.model_id::text = um.id::text;

insert into public.template_marco_zero_inventory_20260410(
  id, nome, codigo_barras, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, eh_consumivel, ativo, tipo_inventario, area, categoria
)
select distinct
  it.id::text,
  it.nome,
  it.codigo_barras,
  it.unidade,
  it.unidade_medida,
  it.fator_conversao,
  it.preco_custo,
  it.estoque_minimo,
  it.eh_consumivel,
  it.ativo,
  it.tipo_inventario,
  it.area,
  it.categoria
from public.inventory_template it
join public.model_items_template mi on mi.inventory_id::text = it.id::text;

insert into public.template_marco_zero_model_items_20260410(model_id, inventory_id, quantidade_sugerida)
select
  mi.model_id::text,
  mi.inventory_id::text,
  max(coalesce(mi.quantidade_sugerida, 1))
from public.model_items_template mi
group by mi.model_id::text, mi.inventory_id::text;

create or replace function public.rpc_restore_templates_from_marco_zero_20260410()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  delete from public.model_items_template;
  delete from public.inventory_template;
  delete from public.usage_models_template;

  insert into public.usage_models_template(id, nome_modelo, include_biosseguranca)
  select id, nome_modelo, include_biosseguranca
  from public.template_marco_zero_usage_models_20260410;

  insert into public.inventory_template(
    id, nome, codigo_barras, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, eh_consumivel, ativo, tipo_inventario, area, categoria
  )
  select
    id, nome, codigo_barras, unidade, unidade_medida, coalesce(fator_conversao,1), preco_custo, coalesce(estoque_minimo,0), coalesce(eh_consumivel,true), coalesce(ativo,true), tipo_inventario, area, categoria
  from public.template_marco_zero_inventory_20260410;

  insert into public.model_items_template(model_id, inventory_id, quantidade_sugerida)
  select model_id, inventory_id, coalesce(quantidade_sugerida,1)
  from public.template_marco_zero_model_items_20260410;

  select count(*) into v_count
  from public.model_items_template;

  return json_build_object('ok', true, 'restored_model_items_template', v_count);
end
$$;

notify pgrst, 'reload schema';
