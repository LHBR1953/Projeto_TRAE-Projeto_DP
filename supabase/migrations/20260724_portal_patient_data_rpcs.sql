create or replace function public.get_paciente_agendamentos(p_empresa_id text, p_paciente_id bigint)
returns setof public.agenda_agendamentos
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_empresa_id is null or trim(p_empresa_id) = '' or p_paciente_id is null then
    return;
  end if;

  return query
  select ag.*
  from public.agenda_agendamentos ag
  where ag.empresa_id = p_empresa_id
    and ag.paciente_id = p_paciente_id
  order by ag.inicio desc nulls last
  limit 50;
end;
$$;

revoke all on function public.get_paciente_agendamentos(text, bigint) from public;
grant execute on function public.get_paciente_agendamentos(text, bigint) to anon, authenticated;

create or replace function public.get_paciente_orcamentos(p_empresa_id text, p_paciente_id text)
returns setof public.orcamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id text := trim(coalesce(p_paciente_id, ''));
  v_empresa_id text := trim(coalesce(p_empresa_id, ''));
begin
  if v_empresa_id = '' or v_paciente_id = '' then
    return;
  end if;

  return query
  select o.*
  from public.orcamentos o
  where (
    -- Validação do empresa_id
    trim(coalesce(o.empresa_id::text, '')) = v_empresa_id
  )
  and (
    -- Validação do paciente_id
    trim(coalesce(o.paciente_id::text, '')) = v_paciente_id
  )
  order by o.created_at desc nulls last, o.seqid desc nulls last;
end;
$$;

revoke all on function public.get_paciente_orcamentos(text, text) from public;
grant execute on function public.get_paciente_orcamentos(text, text) to anon, authenticated;

create or replace function public.get_paciente_financeiro(p_empresa_id text, p_paciente_id bigint)
returns setof public.financeiro_transacoes
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_empresa_id is null or trim(p_empresa_id) = '' or p_paciente_id is null then
    return;
  end if;

  return query
  select ft.*
  from public.financeiro_transacoes ft
  where ft.empresa_id = p_empresa_id
    and ft.paciente_id = p_paciente_id
  order by ft.data_transacao desc nulls last, ft.seqid desc nulls last
  limit 100;
end;
$$;

revoke all on function public.get_paciente_financeiro(text, bigint) from public;
grant execute on function public.get_paciente_financeiro(text, bigint) to anon, authenticated;
