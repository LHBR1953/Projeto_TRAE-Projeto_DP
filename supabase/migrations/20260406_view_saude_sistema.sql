create or replace view public.view_saude_sistema as
with
kit_counts as (
  select
    um.id as model_id,
    um.nome_modelo,
    count(mi.id) as itens_no_kit
  from public.usage_models_template um
  left join public.model_items_template mi
    on mi.model_id::text = um.id::text
  group by um.id, um.nome_modelo
),
financeiro_invalid as (
  select
    count(*) as invalido
  from public.financeiro_transacoes ft
  left join public.empresas e
    on e.id::text = ft.empresa_id::text
  where ft.empresa_id is null
     or e.id is null
),
agenda_pairs_24h as (
  select
    a1.empresa_id::text as empresa_id,
    a1.profissional_id::text as profissional_id,
    count(*) as conflitos
  from public.agenda_agendamentos a1
  join public.agenda_agendamentos a2
    on a1.empresa_id = a2.empresa_id
   and a1.profissional_id = a2.profissional_id
   and a1.id < a2.id
   and tstzrange(a1.inicio, a1.fim, '[)') && tstzrange(a2.inicio, a2.fim, '[)')
  where coalesce(a1.status,'') <> 'CANCELADO'
    and coalesce(a2.status,'') <> 'CANCELADO'
    and (
      a1.inicio >= (now() - interval '24 hours')
      or a1.fim >= (now() - interval '24 hours')
      or a2.inicio >= (now() - interval '24 hours')
      or a2.fim >= (now() - interval '24 hours')
    )
  group by a1.empresa_id::text, a1.profissional_id::text
),
empresas_status as (
  select
    sum(case when upper(coalesce(assinatura_status, '')) = 'ATIVO' then 1 else 0 end) as ativas,
    sum(case when upper(coalesce(assinatura_status, '')) = 'TRIAL' then 1 else 0 end) as trial,
    sum(
      case
        when upper(coalesce(assinatura_status, '')) in ('ATIVO','TRIAL') then 0
        when data_vencimento is not null and data_vencimento < current_date then 1
        else 0
      end
    ) as vencidas,
    count(*) as total
  from public.empresas
)
select
  'DNA'::text as categoria,
  kc.nome_modelo as item,
  kc.itens_no_kit::int as valor,
  jsonb_build_object('model_id', kc.model_id) as detalhe,
  case when kc.itens_no_kit < 3 then 'ALERTA' else 'OK' end as status
from kit_counts kc

union all
select
  'Financeiro'::text as categoria,
  'transacoes_empresa_invalida'::text as item,
  fi.invalido::int as valor,
  null::jsonb as detalhe,
  case when fi.invalido > 0 then 'ALERTA' else 'OK' end as status
from financeiro_invalid fi

union all
select
  'Agenda'::text as categoria,
  ap.profissional_id as item,
  ap.conflitos::int as valor,
  jsonb_build_object('empresa_id', ap.empresa_id) as detalhe,
  case when ap.conflitos > 0 then 'ALERTA' else 'OK' end as status
from agenda_pairs_24h ap

union all
select
  'Empresas'::text as categoria,
  'ATIVO'::text as item,
  es.ativas::int as valor,
  jsonb_build_object('total', es.total::int) as detalhe,
  'OK'::text as status
from empresas_status es

union all
select
  'Empresas'::text as categoria,
  'TRIAL'::text as item,
  es.trial::int as valor,
  jsonb_build_object('total', es.total::int) as detalhe,
  'OK'::text as status
from empresas_status es

union all
select
  'Empresas'::text as categoria,
  'VENCIDA'::text as item,
  es.vencidas::int as valor,
  jsonb_build_object('total', es.total::int) as detalhe,
  case when es.vencidas > 0 then 'ALERTA' else 'OK' end as status
from empresas_status es;

notify pgrst, 'reload schema';
