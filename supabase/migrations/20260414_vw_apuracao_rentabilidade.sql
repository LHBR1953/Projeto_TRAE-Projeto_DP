create or replace view public.vw_apuracao_rentabilidade as
with biosseg_inventory as (
  select distinct
    um.empresa_id::text as empresa_id,
    mi.inventory_id::text as inventory_id
  from public.usage_models um
  join public.model_items mi
    on mi.model_id::text = um.id::text
  where lower(coalesce(um.nome_modelo, '')) like '%biosseg%'
),
costs as (
  select
    l.empresa_id::text as empresa_id,
    coalesce(nullif(btrim(l.orcamento_item_id::text), ''), nullif(btrim(l.atendimento_id::text), '')) as orcamento_item_id,
    sum(
      case
        when upper(coalesce(l.tipo, '')) in ('SAIDA', 'USO')
             and exists (
               select 1
               from biosseg_inventory bi
               where bi.empresa_id = l.empresa_id::text
                 and bi.inventory_id = l.inventory_id::text
             )
          then abs(coalesce(l.quantidade, 0)) * coalesce(i.preco_custo, 0)
        else 0
      end
    )::numeric as custo_bio,
    sum(
      case
        when upper(coalesce(l.tipo, '')) in ('SAIDA', 'USO')
             and not exists (
               select 1
               from biosseg_inventory bi
               where bi.empresa_id = l.empresa_id::text
                 and bi.inventory_id = l.inventory_id::text
             )
          then abs(coalesce(l.quantidade, 0)) * coalesce(i.preco_custo, 0)
        else 0
      end
    )::numeric as custo_material
  from public.inventory_logs l
  left join public.inventory i
    on i.id::text = l.inventory_id::text
  where upper(coalesce(l.tipo, '')) in ('SAIDA', 'USO')
  group by l.empresa_id::text, coalesce(nullif(btrim(l.orcamento_item_id::text), ''), nullif(btrim(l.atendimento_id::text), ''))
),
comissoes as (
  select
    c.empresa_id::text as empresa_id,
    c.item_id::text as orcamento_item_id,
    sum(coalesce(c.valor_comissao, 0))::numeric as valor_comissao
  from public.financeiro_comissoes c
  group by c.empresa_id::text, c.item_id::text
)
select
  oi.empresa_id::text as empresa_id,
  oi.id::text as orcamento_item_id,
  coalesce(
    nullif(
      btrim(
        concat_ws(
          ' - ',
          nullif(btrim(coalesce(to_jsonb(p)->>'numero_prontuario', '')), ''),
          nullif(btrim(coalesce(to_jsonb(p)->>'nome', '')), '')
        )
      ),
      ''
    ),
    nullif(btrim(coalesce(to_jsonb(p)->>'nome', '')), ''),
    '-'
  ) || ' • ' ||
  coalesce(
    to_char(
      coalesce(
        (nullif(to_jsonb(oi)->>'updated_at', ''))::timestamptz,
        (nullif(to_jsonb(oi)->>'created_at', ''))::timestamptz,
        now()
      ),
      'DD/MM/YYYY'
    ),
    '-'
  ) as atendimento,
  coalesce(
    nullif(btrim(coalesce(to_jsonb(s)->>'codigo_servico', '')), ''),
    nullif(btrim(coalesce(to_jsonb(s)->>'seqid', '')), ''),
    '-'
  ) as codigo_servico,
  coalesce(
    nullif(btrim(coalesce(to_jsonb(oi)->>'descricao', '')), ''),
    nullif(btrim(coalesce(to_jsonb(s)->>'descricao', '')), ''),
    '-'
  ) as procedimento,
  coalesce(
    nullif(btrim(coalesce(to_jsonb(oi)->>'subdivisao', '')), ''),
    nullif(btrim(coalesce(to_jsonb(s)->>'subdivisao', '')), ''),
    'Sem Subdivisão'
  ) as subdivisao,
  (
    coalesce((nullif(to_jsonb(oi)->>'valor', ''))::numeric, 0)
    * greatest(coalesce((nullif(to_jsonb(oi)->>'qtde', ''))::numeric, 1), 1)
  )::numeric(18,2) as valor_bruto_a,
  coalesce(cm.valor_comissao, 0)::numeric(18,2) as comissao_c,
  coalesce((nullif(to_jsonb(oi)->>'valor_protetico', ''))::numeric, 0)::numeric(18,2) as custo_protetico_b,
  coalesce(cs.custo_material, 0)::numeric(18,2) as custo_material,
  coalesce(cs.custo_bio, 0)::numeric(18,2) as custo_bio,
  (coalesce(cs.custo_material, 0) + coalesce(cs.custo_bio, 0))::numeric(18,2) as custo_mat_bio_d,
  (
    (
      coalesce((nullif(to_jsonb(oi)->>'valor', ''))::numeric, 0)
      * greatest(coalesce((nullif(to_jsonb(oi)->>'qtde', ''))::numeric, 1), 1)
    )
    - coalesce(cm.valor_comissao, 0)
    - coalesce((nullif(to_jsonb(oi)->>'valor_protetico', ''))::numeric, 0)
    - coalesce(cs.custo_material, 0)
    - coalesce(cs.custo_bio, 0)
  )::numeric(18,2) as lucro_real,
  case
    when (
      coalesce((nullif(to_jsonb(oi)->>'valor', ''))::numeric, 0)
      * greatest(coalesce((nullif(to_jsonb(oi)->>'qtde', ''))::numeric, 1), 1)
    ) > 0
      then (
        (
          (
            coalesce((nullif(to_jsonb(oi)->>'valor', ''))::numeric, 0)
            * greatest(coalesce((nullif(to_jsonb(oi)->>'qtde', ''))::numeric, 1), 1)
          )
          - coalesce(cm.valor_comissao, 0)
          - coalesce((nullif(to_jsonb(oi)->>'valor_protetico', ''))::numeric, 0)
          - coalesce(cs.custo_material, 0)
          - coalesce(cs.custo_bio, 0)
        )
        / (
          coalesce((nullif(to_jsonb(oi)->>'valor', ''))::numeric, 0)
          * greatest(coalesce((nullif(to_jsonb(oi)->>'qtde', ''))::numeric, 1), 1)
        )
      ) * 100
    else 0
  end::numeric(8,2) as margem_percentual
from public.orcamento_itens oi
left join public.orcamentos o
  on o.id::text = oi.orcamento_id::text
left join public.pacientes p
  on p.id::text = coalesce(
    nullif(btrim(coalesce(to_jsonb(o)->>'paciente_id', '')), ''),
    nullif(btrim(coalesce(to_jsonb(o)->>'pacienteid', '')), ''),
    nullif(btrim(coalesce(to_jsonb(o)->>'pacienteId', '')), '')
  )
left join public.servicos s
  on s.id::text = coalesce(
    nullif(btrim(coalesce(to_jsonb(oi)->>'servico_id', '')), ''),
    nullif(btrim(coalesce(to_jsonb(oi)->>'servicoId', '')), '')
  )
left join comissoes cm
  on cm.empresa_id = oi.empresa_id::text
 and cm.orcamento_item_id = oi.id::text
left join costs cs
  on cs.empresa_id = oi.empresa_id::text
 and cs.orcamento_item_id = oi.id::text;

create index if not exists idx_fin_comissoes_emp_item
  on public.financeiro_comissoes (empresa_id, item_id);

notify pgrst, 'reload schema';
