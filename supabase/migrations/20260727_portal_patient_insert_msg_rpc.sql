create or replace function public.insert_portal_mensagem_paciente(
  p_empresa_id text,
  p_paciente_id text,
  p_conteudo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_paciente_id is null or trim(p_paciente_id) = '' then
    return;
  end if;
  if p_empresa_id is null or trim(p_empresa_id) = '' then
    return;
  end if;

  insert into public.portal_mensagens (
    empresa_id,
    paciente_id,
    remetente,
    conteudo,
    lida,
    tipo_mensagem
  ) values (
    p_empresa_id,
    p_paciente_id,
    'paciente',
    p_conteudo,
    false,
    'texto'
  );
end;
$$;

revoke all on function public.insert_portal_mensagem_paciente(text, text, text) from public;
grant execute on function public.insert_portal_mensagem_paciente(text, text, text) to anon, authenticated;
