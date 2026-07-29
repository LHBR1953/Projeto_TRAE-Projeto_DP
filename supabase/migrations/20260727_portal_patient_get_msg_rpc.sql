create or replace function public.get_portal_mensagens_paciente(
  p_empresa_id text,
  p_paciente_id text
)
returns setof public.portal_mensagens
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_empresa_id is null or trim(p_empresa_id) = '' or p_paciente_id is null or trim(p_paciente_id) = '' then
    return;
  end if;

  return query
  select *
  from public.portal_mensagens
  where empresa_id = p_empresa_id
    and paciente_id = p_paciente_id
  order by created_at asc;
end;
$$;

revoke all on function public.get_portal_mensagens_paciente(text, text) from public;
grant execute on function public.get_portal_mensagens_paciente(text, text) to anon, authenticated;
