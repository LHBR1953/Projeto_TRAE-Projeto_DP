create or replace function public.get_paciente_agendamentos(p_paciente_id bigint)
returns setof public.agenda_agendamentos
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null then
    return;
  end if;

  return query
  select ag.*
  from public.agenda_agendamentos ag
  where ag.paciente_id = p_paciente_id
  order by ag.inicio desc nulls last
  limit 50;
end;
$$;

revoke all on function public.get_paciente_agendamentos(bigint) from public;
grant execute on function public.get_paciente_agendamentos(bigint) to anon, authenticated;

create or replace function public.get_paciente_orcamentos(p_paciente_id text)
returns setof public.orcamentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id text := trim(coalesce(p_paciente_id, ''));
begin
  if v_paciente_id = '' then
    return;
  end if;

  return query
  select o.*
  from public.orcamentos o
  where trim(coalesce(o.pacienteid, '')) = v_paciente_id
  order by o.created_at desc nulls last, o.seqid desc nulls last
  limit 5;
end;
$$;

revoke all on function public.get_paciente_orcamentos(text) from public;
grant execute on function public.get_paciente_orcamentos(text) to anon, authenticated;

create or replace function public.get_paciente_financeiro(p_paciente_id bigint)
returns setof public.financeiro_transacoes
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null then
    return;
  end if;

  return query
  select ft.*
  from public.financeiro_transacoes ft
  where ft.paciente_id = p_paciente_id
  order by ft.data_transacao desc nulls last, ft.seqid desc nulls last
  limit 10;
end;
$$;

revoke all on function public.get_paciente_financeiro(bigint) from public;
grant execute on function public.get_paciente_financeiro(bigint) to anon, authenticated;
