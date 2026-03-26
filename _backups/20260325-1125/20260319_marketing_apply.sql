begin;

create extension if not exists pgcrypto;

create table if not exists public.marketing_smtp_config (
  empresa_id text primary key references public.empresas(id) on delete cascade,
  host text not null,
  port integer not null,
  username text,
  password text,
  from_email text,
  from_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campanhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete cascade,
  nome text not null,
  assunto text not null,
  corpo text not null,
  rodape text,
  ativo boolean not null default false,
  target_min_meses integer not null default 0,
  target_max_meses integer,
  dias_reenvio integer not null default 0,
  limite_dia integer not null default 50,
  janela_conversao_dias integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_envios (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas(id) on delete cascade,
  campanha_id uuid references public.marketing_campanhas(id) on delete set null,
  paciente_id bigint,
  paciente_nome text,
  paciente_email text,
  status text not null,
  erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.marketing_smtp_config enable row level security;
alter table public.marketing_campanhas enable row level security;
alter table public.marketing_envios enable row level security;

select public.occ_ensure_policy('marketing_campanhas','occ_v1_select','select','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''marketing'',''select'') or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('marketing_campanhas','occ_v1_insert','insert','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('marketing_campanhas','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''marketing'',''update'') or public.occ_is_super_admin()','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('marketing_campanhas','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''marketing'',''delete'') or public.occ_is_super_admin()', null);

select public.occ_ensure_policy('marketing_envios','occ_v1_select','select','public.is_admin_of_empresa(empresa_id) or public.occ_has_perm(empresa_id,''marketing'',''select'') or public.occ_is_super_admin()', null);
select public.occ_ensure_policy('marketing_envios','occ_v1_insert','insert','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('marketing_envios','occ_v1_update','update','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()');
select public.occ_ensure_policy('marketing_envios','occ_v1_delete','delete','public.is_admin_of_empresa(empresa_id) or public.occ_is_super_admin()', null);

create or replace function public.rpc_marketing_get_smtp_config(p_empresa_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r public.marketing_smtp_config%rowtype;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  select * into r
  from public.marketing_smtp_config
  where empresa_id = p_empresa_id;

  if not found then
    return jsonb_build_object(
      'empresa_id', p_empresa_id,
      'enabled', false,
      'host', null,
      'port', null,
      'username', null,
      'from_email', null,
      'from_name', null,
      'has_password', false
    );
  end if;

  return jsonb_build_object(
    'empresa_id', r.empresa_id,
    'enabled', r.enabled,
    'host', r.host,
    'port', r.port,
    'username', r.username,
    'from_email', r.from_email,
    'from_name', r.from_name,
    'has_password', (r.password is not null and btrim(r.password) <> '')
  );
end;
$$;

grant execute on function public.rpc_marketing_get_smtp_config(text) to authenticated;

create or replace function public.rpc_marketing_set_smtp_config(
  p_empresa_id text,
  p_enabled boolean,
  p_host text,
  p_port integer,
  p_username text,
  p_password text,
  p_from_email text,
  p_from_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_password text;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.occ_is_super_admin()) then
    raise exception 'Acesso negado.';
  end if;

  select password into v_password
  from public.marketing_smtp_config
  where empresa_id = p_empresa_id;

  if p_password is not null and btrim(p_password) <> '' then
    v_password := p_password;
  end if;

  insert into public.marketing_smtp_config(
    empresa_id, enabled, host, port, username, password, from_email, from_name, updated_at
  )
  values (
    p_empresa_id,
    coalesce(p_enabled, true),
    coalesce(p_host, ''),
    coalesce(p_port, 587),
    p_username,
    v_password,
    p_from_email,
    p_from_name,
    now()
  )
  on conflict (empresa_id) do update set
    enabled = excluded.enabled,
    host = excluded.host,
    port = excluded.port,
    username = excluded.username,
    password = excluded.password,
    from_email = excluded.from_email,
    from_name = excluded.from_name,
    updated_at = now();

  return public.rpc_marketing_get_smtp_config(p_empresa_id);
end;
$$;

grant execute on function public.rpc_marketing_set_smtp_config(text, boolean, text, integer, text, text, text, text) to authenticated;

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
  )
  select *
  from base
  where meses_sem_pagamento >= coalesce(p_min_meses, 0)
    and (p_max_meses is null or meses_sem_pagamento <= p_max_meses)
  order by meses_sem_pagamento desc, ultimo_pagamento_em nulls last, nome asc
  limit coalesce(p_limit, 500)
  offset coalesce(p_offset, 0);
$$;

grant execute on function public.rpc_marketing_fidelidade(text, integer, integer, integer, integer) to authenticated;

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
  )
  select count(*)
  from base
  where meses_sem_pagamento >= coalesce(p_min_meses, 0)
    and (p_max_meses is null or meses_sem_pagamento <= p_max_meses);
$$;

grant execute on function public.rpc_marketing_fidelidade_count(text, integer, integer) to authenticated;

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

grant execute on function public.rpc_marketing_fidelidade_kpis(text) to authenticated;

commit;
