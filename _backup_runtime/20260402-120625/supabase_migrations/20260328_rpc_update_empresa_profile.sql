begin;

create or replace function public.is_admin_of_empresa(target_empresa_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.usuario_empresas ue
    where ue.usuario_id = auth.uid()
      and ue.empresa_id = target_empresa_id
      and lower(coalesce(ue.perfil, '')) = 'admin'
  );
$$;

grant execute on function public.is_admin_of_empresa(text) to authenticated;

create or replace function public.rpc_update_empresa_profile(
  p_empresa_id text,
  p_nome text,
  p_email text,
  p_telefone text,
  p_celular text,
  p_logotipo text
)
returns public.empresas
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_row public.empresas%rowtype;
begin
  if not (public.is_admin_of_empresa(p_empresa_id) or public.is_superadmin()) then
    raise exception 'Acesso negado.';
  end if;

  update public.empresas
  set
    nome = nullif(btrim(coalesce(p_nome, '')), ''),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    telefone = nullif(btrim(coalesce(p_telefone, '')), ''),
    celular = nullif(btrim(coalesce(p_celular, '')), ''),
    logotipo = nullif(btrim(coalesce(p_logotipo, '')), '')
  where id = p_empresa_id
  returning * into v_row;

  if not found then
    raise exception 'Empresa não encontrada.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.rpc_update_empresa_profile(text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
