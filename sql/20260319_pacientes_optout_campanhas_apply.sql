begin;

alter table public.pacientes
  add column if not exists nao_receber_campanhas boolean not null default false;

update public.pacientes
set nao_receber_campanhas = false
where nao_receber_campanhas is null;

create index if not exists pacientes_empresa_optout_idx
  on public.pacientes(empresa_id, nao_receber_campanhas);

create or replace function public.rpc_marketing_fidelidade(
  p_empresa_id text,
  p_min_meses integer default 0,
  p_max_meses integer default null,
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  paciente_id bigint,
  nome text,
  email text,
  ultimo_pagamento_em timestamptz,
  meses_sem_pagamento integer,
  qtd_pagamentos bigint,
  total_pago numeric
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with agg as (
    select
      ft.paciente_id::bigint as paciente_id,
      max(ft.data_transacao) as ultimo_pagamento_em,
      count(*) as qtd_pagamentos,
      sum(case when ft.tipo = 'CREDITO' then ft.valor else (ft.valor * -1) end) as total_pago
    from public.financeiro_transacoes ft
    where ft.empresa_id = p_empresa_id
      and ft.categoria = 'PAGAMENTO'
    group by ft.paciente_id
  ),
  base as (
    select
      p.seqid::bigint as paciente_id,
      p.nome,
      p.email,
      a.ultimo_pagamento_em,
      case
        when a.ultimo_pagamento_em is null then 999
        else ((date_part('year', age(now(), a.ultimo_pagamento_em))::int * 12) + date_part('month', age(now(), a.ultimo_pagamento_em))::int)
      end as meses_sem_pagamento,
      coalesce(a.qtd_pagamentos, 0) as qtd_pagamentos,
      coalesce(a.total_pago, 0) as total_pago
    from public.pacientes p
    left join agg a on a.paciente_id = p.seqid::bigint
    where p.empresa_id = p_empresa_id
      and coalesce(p.nao_receber_campanhas, false) = false
  )
  select *
  from base
  where meses_sem_pagamento >= coalesce(p_min_meses, 0)
    and (p_max_meses is null or meses_sem_pagamento <= p_max_meses)
  order by meses_sem_pagamento desc, ultimo_pagamento_em nulls last, nome asc
  limit coalesce(p_limit, 500)
  offset coalesce(p_offset, 0);
$$;

create or replace function public.rpc_marketing_fidelidade_count(
  p_empresa_id text,
  p_min_meses integer default 0,
  p_max_meses integer default null
)
returns bigint
language sql
stable
security definer
set search_path = public, auth
as $$
  with agg as (
    select
      ft.paciente_id::bigint as paciente_id,
      max(ft.data_transacao) as ultimo_pagamento_em
    from public.financeiro_transacoes ft
    where ft.empresa_id = p_empresa_id
      and ft.categoria = 'PAGAMENTO'
    group by ft.paciente_id
  ),
  base as (
    select
      p.seqid::bigint as paciente_id,
      case
        when a.ultimo_pagamento_em is null then 999
        else ((date_part('year', age(now(), a.ultimo_pagamento_em))::int * 12) + date_part('month', age(now(), a.ultimo_pagamento_em))::int)
      end as meses_sem_pagamento
    from public.pacientes p
    left join agg a on a.paciente_id = p.seqid::bigint
    where p.empresa_id = p_empresa_id
      and coalesce(p.nao_receber_campanhas, false) = false
  )
  select count(*)
  from base
  where meses_sem_pagamento >= coalesce(p_min_meses, 0)
    and (p_max_meses is null or meses_sem_pagamento <= p_max_meses);
$$;

create or replace function public.rpc_marketing_fidelidade_kpis(p_empresa_id text)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  with agg as (
    select
      ft.paciente_id::bigint as paciente_id,
      max(ft.data_transacao) as ultimo_pagamento_em
    from public.financeiro_transacoes ft
    where ft.empresa_id = p_empresa_id
      and ft.categoria = 'PAGAMENTO'
    group by ft.paciente_id
  ),
  base as (
    select
      p.seqid::bigint as paciente_id,
      case
        when a.ultimo_pagamento_em is null then 999
        else ((date_part('year', age(now(), a.ultimo_pagamento_em))::int * 12) + date_part('month', age(now(), a.ultimo_pagamento_em))::int)
      end as meses_sem_pagamento
    from public.pacientes p
    left join agg a on a.paciente_id = p.seqid::bigint
    where p.empresa_id = p_empresa_id
      and coalesce(p.nao_receber_campanhas, false) = false
  )
  select jsonb_build_object(
    'ativos', sum(case when meses_sem_pagamento between 0 and 6 then 1 else 0 end),
    'm7_8', sum(case when meses_sem_pagamento between 7 and 8 then 1 else 0 end),
    'm9_11', sum(case when meses_sem_pagamento between 9 and 11 then 1 else 0 end),
    'm12_17', sum(case when meses_sem_pagamento between 12 and 17 then 1 else 0 end),
    'm18_plus', sum(case when meses_sem_pagamento >= 18 then 1 else 0 end)
  )
  from base;
$$;

notify pgrst, 'reload schema';

commit;

