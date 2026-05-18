create extension if not exists pgcrypto;

create table if not exists public.servicos_template (
  id text primary key,
  descricao text not null,
  valor numeric not null default 0,
  ie text,
  tipo_calculo text,
  exige_elemento boolean not null default false,
  subdivisao text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_template (
  id text primary key,
  nome text not null,
  codigo_barras text,
  unidade text not null,
  unidade_medida text not null,
  fator_conversao numeric not null default 1,
  preco_custo numeric,
  estoque_atual numeric not null default 0,
  estoque_minimo numeric not null default 0,
  eh_consumivel boolean not null default true,
  ativo boolean not null default true,
  tipo_inventario text,
  area text,
  categoria text,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_models_template (
  id text primary key,
  nome_modelo text not null,
  include_biosseguranca boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.model_items_template (
  id text primary key,
  model_id text not null,
  inventory_id text not null,
  quantidade_sugerida numeric not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.service_mapping_template (
  service_id text not null,
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (service_id, model_id)
);

insert into public.servicos_template (id, descricao, valor, ie, tipo_calculo, exige_elemento, subdivisao)
values
  ('tpl_srv_001', 'AVALIAÇÃO / CONSULTA', 120, 'S', 'Fixo', false, 'Avaliação/Consulta'),
  ('tpl_srv_002', 'PROFILAXIA (LIMPEZA)', 180, 'S', 'Fixo', false, 'Profilaxia'),
  ('tpl_srv_003', 'RESTAURAÇÃO (RESINA)', 220, 'S', 'Fixo', false, 'Dentística'),
  ('tpl_srv_004', 'EXTRAÇÃO SIMPLES', 280, 'S', 'Fixo', false, 'Cirurgia'),
  ('tpl_srv_005', 'BLOQUEIO / ANESTESIA (TUBETE)', 25, 'S', 'Fixo', false, 'Cirurgia'),
  ('tpl_srv_006', 'RADIOGRAFIA PERIAPICAL', 40, 'S', 'Fixo', false, 'Imagem')
on conflict (id) do nothing;

insert into public.inventory_template (id, nome, unidade, unidade_medida, fator_conversao, preco_custo, estoque_minimo, tipo_inventario, area, categoria)
values
  ('tpl_inv_001', 'LUVA DE PROCEDIMENTO', 'cx', 'un', 100, 0, 10, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_002', 'MÁSCARA DESCARTÁVEL', 'cx', 'un', 50, 0, 10, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_003', 'TOUCA DESCARTÁVEL', 'cx', 'un', 100, 0, 10, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_004', 'GASE ESTÉRIL', 'cx', 'un', 200, 0, 10, 'consumiveis', 'Cirurgia', 'Cirurgia'),
  ('tpl_inv_005', 'ALCOOL 70% (1L)', 'l', 'ml', 1000, 0, 0, 'consumiveis', 'Administrativo', 'Administrativo'),
  ('tpl_inv_006', 'ANESTÉSICO (TUBETE)', 'cx', 'tb', 50, 0, 0, 'consumiveis', 'Cirurgia', 'Cirurgia'),
  ('tpl_inv_007', 'ALGODÃO (ROLETE)', 'cx', 'un', 100, 0, 0, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_008', 'SUGADOR DESCARTÁVEL', 'cx', 'un', 40, 0, 0, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_009', 'GUARDANAPO / BABADOR', 'cx', 'un', 100, 0, 0, 'consumiveis', 'Dentística', 'Dentística'),
  ('tpl_inv_010', 'PAPEL GRAU CIRÚRGICO (ROLO)', 'rl', 'rl', 1, 0, 0, 'consumiveis', 'Cirurgia', 'Cirurgia')
on conflict (id) do nothing;

insert into public.usage_models_template (id, nome_modelo, include_biosseguranca)
values
  ('tpl_mod_biosseg', 'Kit Biossegurança', true),
  ('tpl_mod_consulta', 'Kit Consulta', true),
  ('tpl_mod_profilaxia', 'Kit Profilaxia', true),
  ('tpl_mod_resta', 'Kit Restauração', true),
  ('tpl_mod_cirurgia', 'Kit Cirurgia Simples', true)
on conflict (id) do nothing;

insert into public.model_items_template (id, model_id, inventory_id, quantidade_sugerida)
values
  ('tpl_mi_001', 'tpl_mod_biosseg', 'tpl_inv_001', 1),
  ('tpl_mi_002', 'tpl_mod_biosseg', 'tpl_inv_002', 1),
  ('tpl_mi_003', 'tpl_mod_biosseg', 'tpl_inv_003', 1),
  ('tpl_mi_004', 'tpl_mod_biosseg', 'tpl_inv_008', 1),
  ('tpl_mi_005', 'tpl_mod_biosseg', 'tpl_inv_009', 1),
  ('tpl_mi_006', 'tpl_mod_consulta', 'tpl_inv_007', 2),
  ('tpl_mi_007', 'tpl_mod_consulta', 'tpl_inv_006', 1),
  ('tpl_mi_008', 'tpl_mod_profilaxia', 'tpl_inv_004', 2),
  ('tpl_mi_009', 'tpl_mod_cirurgia', 'tpl_inv_004', 4),
  ('tpl_mi_010', 'tpl_mod_cirurgia', 'tpl_inv_006', 2)
on conflict (id) do nothing;

insert into public.service_mapping_template (service_id, model_id)
values
  ('tpl_srv_001', 'tpl_mod_consulta'),
  ('tpl_srv_002', 'tpl_mod_profilaxia'),
  ('tpl_srv_003', 'tpl_mod_resta'),
  ('tpl_srv_004', 'tpl_mod_cirurgia'),
  ('tpl_srv_005', 'tpl_mod_cirurgia')
on conflict (service_id, model_id) do nothing;

create or replace function public.rpc_templates_healthcheck()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invalid_serv int := 0;
  v_invalid_inv int := 0;
  v_invalid_models int := 0;
  v_invalid_items int := 0;
  v_invalid_map int := 0;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select count(*) into v_invalid_inv
  from public.inventory_template it
  where lower(coalesce(it.unidade,'')) not in ('g','kg','ml','l','un','par','pt','cx','fl','tb','rl')
     or lower(coalesce(it.unidade_medida,'')) not in ('g','kg','ml','l','un','par','pt','cx','fl','tb','rl')
     or it.fator_conversao is null
     or it.fator_conversao <= 0;

  select count(*) into v_invalid_serv
  from public.servicos_template st
  where st.descricao is null or btrim(st.descricao) = '' or st.valor is null or st.valor < 0;

  select count(*) into v_invalid_models
  from public.usage_models_template mt
  where mt.nome_modelo is null or btrim(mt.nome_modelo) = '';

  select count(*) into v_invalid_items
  from public.model_items_template mi
  where not exists (select 1 from public.usage_models_template m where m.id = mi.model_id)
     or not exists (select 1 from public.inventory_template i where i.id = mi.inventory_id);

  select count(*) into v_invalid_map
  from public.service_mapping_template sm
  where not exists (select 1 from public.servicos_template s where s.id = sm.service_id)
     or not exists (select 1 from public.usage_models_template m where m.id = sm.model_id);

  return json_build_object(
    'ok', true,
    'counts', json_build_object(
      'servicos_template', (select count(*) from public.servicos_template),
      'inventory_template', (select count(*) from public.inventory_template),
      'usage_models_template', (select count(*) from public.usage_models_template),
      'model_items_template', (select count(*) from public.model_items_template),
      'service_mapping_template', (select count(*) from public.service_mapping_template)
    ),
    'invalid', json_build_object(
      'servicos_template', v_invalid_serv,
      'inventory_template', v_invalid_inv,
      'usage_models_template', v_invalid_models,
      'model_items_template', v_invalid_items,
      'service_mapping_template', v_invalid_map
    )
  );
end;
$$;

notify pgrst, 'reload schema';
