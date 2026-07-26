create or replace function public.buscar_paciente_portal(p_identificador text)
returns setof public.pacientes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identificador text := lower(trim(coalesce(p_identificador, '')));
  v_cpf_limpo text := regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g');
begin
  if v_identificador = '' then
    return;
  end if;

  return query
  select p.*
  from public.pacientes p
  where (
    length(v_cpf_limpo) = 11
    and regexp_replace(coalesce(nullif(p.cpf, ''), ''), '\D', '', 'g') = v_cpf_limpo
  ) or (
    lower(trim(coalesce(p.email, ''))) = v_identificador
  )
  order by p.seqid desc nulls last
  limit 1;
end;
$$;

revoke all on function public.buscar_paciente_portal(text) from public;
grant execute on function public.buscar_paciente_portal(text) to anon, authenticated;
